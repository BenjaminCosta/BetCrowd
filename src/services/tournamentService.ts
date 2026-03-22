import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  runTransaction,
  writeBatch,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export interface CreateTournamentInput {
  name: string;
  description?: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  startDate?: string;
  endDate?: string;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  startDate?: string;
  endDate?: string;
  ownerId: string;
  inviteCode: string;
  status: string; // active | finished | deleted
  hasActivity: boolean; // true if events/bets exist
  currency?: string;
  createdAt: any;
  updatedAt: any;
  lastActivityAt?: any;
  finishedAt?: any;
  deletedAt?: any;
  deletedBy?: string;
}

export interface TournamentRef {
  tournamentId: string;
  role: string;
  joinedAt: any;
  // Denormalized fields for fast loading
  name: string;
  format: string;
  contribution: number;
  participantsEstimated: number;
  inviteCode: string;
  status: string;
  lastActivityAt?: any;
}

/**
 * Generate a unique 6-character invite code
 */
const generateInviteCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding similar looking characters
  const length = 6;
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

const updateTournamentInviteLinkStatus = async (
  tournamentId: string,
  status: 'revoked' | 'expired',
): Promise<void> => {
  try {
    const inviteLinkRef = doc(db, 'tournamentInviteLinks', tournamentId);
    await updateDoc(inviteLinkRef, {
      status,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Best-effort — never block tournament lifecycle actions on invite link status
  }
};

/**
 * Create a new tournament with invite code transaction
 * Returns { tournamentId, inviteCode }
 */
export const createTournament = async (input: CreateTournamentInput): Promise<{ tournamentId: string; inviteCode: string }> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para crear un torneo');
  }

  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    const inviteCode = generateInviteCode();
    
    try {
      const result = await runTransaction(db, async (transaction) => {
        // Check if invite code exists
        const inviteCodeRef = doc(db, 'inviteCodes', inviteCode);
        const inviteCodeDoc = await transaction.get(inviteCodeRef);

        if (inviteCodeDoc.exists()) {
          throw new Error('CODE_EXISTS');
        }

        // Create tournament document
        const tournamentRef = doc(collection(db, 'tournaments'));
        const tournamentId = tournamentRef.id;

        const tournamentData = {
          name: input.name,
          description: input.description || '',
          format: input.format,
          contribution: input.contribution,
          participantsEstimated: input.participantsEstimated,
          startDate: input.startDate || null,
          endDate: input.endDate || null,
          ownerId: user.uid,
          inviteCode,
          status: 'active',
          hasActivity: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        transaction.set(tournamentRef, tournamentData);

        // Create member entry for creator (role: admin)
        const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
        transaction.set(memberRef, {
          role: 'admin',
          joinedAt: serverTimestamp(),
        });

        // Create user tournament reference with denormalized data
        const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
        transaction.set(userTournamentRef, {
          role: 'admin',
          joinedAt: serverTimestamp(),
          // Denormalized fields for fast loading
          name: input.name,
          format: input.format,
          contribution: input.contribution,
          participantsEstimated: input.participantsEstimated,
          inviteCode,
          status: 'active',
        });

        // Create invite code index
        transaction.set(inviteCodeRef, {
          tournamentId,
          ownerId: user.uid,
          name: input.name,
          memberPreviews: [{ uid: user.uid, displayName: user.displayName || 'Usuario' }],
          createdAt: serverTimestamp(),
        });

        return { tournamentId, inviteCode };
      });

      return result;
    } catch (error: any) {
      if (error.message === 'CODE_EXISTS') {
        attempts++;
        continue;
      }
      throw error;
    }
  }

  throw new Error('No se pudo generar un código de invitación único. Intenta nuevamente.');
};

/**
 * Join tournament by invite code
 */
export const joinTournamentByInviteCode = async (code: string): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para unirte a un torneo');

  const upperCode = code.toUpperCase();

  // ── Step 1: Resolve tournamentId from inviteCodes index ──────────────────
  // Rules allow: `allow get: if isSignedIn()` on /inviteCodes/{code}
  const inviteCodeDoc = await getDoc(doc(db, 'inviteCodes', upperCode));
  if (!inviteCodeDoc.exists()) {
    throw new Error('Código de invitación inválido');
  }
  const tournamentId: string = inviteCodeDoc.data().tournamentId;

  // ── Step 2: Check if already joined via user's own tournamentRefs ─────────
  // Rules allow: `allow read: if isMe(userId)` on /users/{uid}/tournamentRefs/*
  // This avoids reading /tournaments/{id}/members/{uid} which requires membership.
  const userRefDoc = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
  const existingRef = await getDoc(userRefDoc);
  if (existingRef.exists()) {
    // Already a member — navigate directly without re-joining
    return tournamentId;
  }

  // ── Step 3: Write member entry ────────────────────────────────────────────
  // Rules allow: user creating their own member doc with role == 'member'
  // `allow create: if isSignedIn() && request.auth.uid == uid && role == 'member'`
  const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
  await setDoc(memberRef, {
    role: 'member',
    joinedAt: serverTimestamp(),
  });
  invalidateMemberCountCache(tournamentId);

  // ── Step 4: Now as a member, read tournament for denormalization ──────────
  // Rules allow: `allow get: if isTournamentMember(tournamentId)` — we just joined
  const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
  if (!tournamentDoc.exists()) throw new Error('El torneo no existe');
  const tournamentData = tournamentDoc.data();

  // ── Step 5: Write user tournamentRef with denormalized data ───────────────
  // Rules allow: `allow create, update: if isMe(userId) && keys hasAll ['role','joinedAt']`
  await setDoc(userRefDoc, {
    role: 'member',
    joinedAt: serverTimestamp(),
    name: tournamentData.name,
    format: tournamentData.format,
    contribution: tournamentData.contribution,
    participantsEstimated: tournamentData.participantsEstimated,
    inviteCode: tournamentData.inviteCode,
    status: tournamentData.status,
  });

  // ── Step 6: Append new member preview to the inviteCodes doc (best-effort, rules-guarded) ────
  // The inviteCodes rule allows members to update only the memberPreviews field.
  try {
    const codeRef = doc(db, 'inviteCodes', upperCode);
    const codeSnap = await getDoc(codeRef);
    if (codeSnap.exists()) {
      const existing: { uid: string; displayName: string }[] =
        codeSnap.data().memberPreviews ?? [];
      const merged = [
        ...existing.filter((m) => m.uid !== user.uid),
        { uid: user.uid, displayName: user.displayName || 'Usuario' },
      ].slice(0, 5);
      await setDoc(codeRef, { memberPreviews: merged }, { merge: true });
    }
  } catch {
    // Best-effort — never fail the join if preview update errors
  }

  // ── Step 7: Notify tournament admins of the new member (best-effort) ────────────────────
  try {
    const membersSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'members'));
    const adminUids = membersSnap.docs
      .filter((d) => d.data().role === 'admin' || d.data().role === 'owner')
      .map((d) => d.id)
      .filter((uid) => uid !== user.uid); // Don't notify yourself
    if (adminUids.length > 0) {
      const joinerSnap = await getDoc(doc(db, 'publicProfiles', user.uid));
      const joinerName: string = joinerSnap.exists()
        ? (joinerSnap.data()!.displayName || joinerSnap.data()!.username || user.displayName || 'Un usuario')
        : (user.displayName || 'Un usuario');
      const notifBatch = writeBatch(db);
      adminUids.forEach((adminUid) => {
        const ref = doc(collection(db, 'users', adminUid, 'notifications'));
        notifBatch.set(ref, {
          type: 'tournament_member_joined',
          title: 'Nuevo participante',
          body: `@${joinerName} se unió al torneo`,
          fromUid: user.uid,
          tournamentId,
          meta: { tournamentId },
          createdAt: serverTimestamp(),
          readAt: null,
        });
      });
      await notifBatch.commit();
    }
  } catch {
    // Best-effort — never fail the join
  }

  return tournamentId;
};

/**
 * Return a map of tournamentId -> role for the current user.
 * Reads the lightweight tournamentRefs subcollection (no N+1 reads).
 */
export const getMyRolesMap = async (): Promise<Record<string, string>> => {
  const user = auth.currentUser;
  if (!user) return {};
  try {
    const refsRef = collection(db, 'users', user.uid, 'tournamentRefs');
    const snap = await getDocs(refsRef);
    const map: Record<string, string> = {};
    snap.docs.forEach((d) => { map[d.id] = d.data().role || 'member'; });
    return map;
  } catch {
    return {};
  }
};

/**
 * List tournaments the current user is part of
 */
export const listMyTournaments = async (): Promise<Tournament[]> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para ver torneos');
  }

  try {
    // Get tournament refs from user
    const tournamentRefsRef = collection(db, 'users', user.uid, 'tournamentRefs');
    const q = query(tournamentRefsRef, orderBy('joinedAt', 'desc'));
    const snapshot = await getDocs(q);

    // PERF: Parallel fetch — replaces the old sequential for+await loop (N+1 reads).
    // All getDoc calls are fired simultaneously; total latency ≈ single round-trip
    // instead of N sequential round-trips as tournament count grows.
    const tournamentDocs = await Promise.all(
      snapshot.docs.map((refDoc) => getDoc(doc(db, 'tournaments', refDoc.id))),
    );

    const tournaments: Tournament[] = [];
    tournamentDocs.forEach((tournamentDoc) => {
      if (tournamentDoc.exists()) {
        tournaments.push({
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        } as Tournament);
      }
    });

    // Sort: active/locked first (by lastActivityAt DESC, fallback createdAt), then finished
    tournaments.sort((a, b) => {
      const aOrder = (a.status === 'active' || a.status === 'locked') ? 0 : 1;
      const bOrder = (b.status === 'active' || b.status === 'locked') ? 0 : 1;
      if (aOrder !== bOrder) return aOrder - bOrder;
      const aTime = a.lastActivityAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.lastActivityAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    return tournaments;
  } catch (error: any) {
    throw error;
  }
};

/**
 * Get a single tournament by ID
 */
export const getTournament = async (tournamentId: string): Promise<Tournament | null> => {
  try {
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      return null;
    }

    return {
      id: tournamentDoc.id,
      ...tournamentDoc.data(),
    } as Tournament;
  } catch (error) {
    console.error('Error getting tournament:', error);
    return null;
  }
};

// ─── Member count cache (TTL: 5 min) ─────────────────────────────────────────
const _memberCountCache = new Map<string, { count: number; ts: number }>();
const MEMBER_COUNT_CACHE_TTL_MS = 5 * 60 * 1000;

export const invalidateMemberCountCache = (tournamentId: string) => {
  _memberCountCache.delete(tournamentId);
};

/**
 * Get member count for a tournament (cached 5 min)
 */
export const getTournamentMemberCount = async (tournamentId: string): Promise<number> => {
  const cached = _memberCountCache.get(tournamentId);
  if (cached && Date.now() - cached.ts < MEMBER_COUNT_CACHE_TTL_MS) {
    return cached.count;
  }
  try {
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const snapshot = await getDocs(membersRef);
    const count = snapshot.size;
    _memberCountCache.set(tournamentId, { count, ts: Date.now() });
    return count;
  } catch (error) {
    console.error('Error getting member count:', error);
    return 0;
  }
};

/**
 * Get the current user's role in a tournament
 */
export const getMyTournamentRole = async (tournamentId: string, uid: string): Promise<string | null> => {
  try {
    const memberDoc = await getDoc(doc(db, 'tournaments', tournamentId, 'members', uid));
    
    if (!memberDoc.exists()) {
      return null;
    }

    return memberDoc.data()?.role || null;
  } catch (error) {
    console.error('Error getting tournament role:', error);
    return null;
  }
};

/**
 * Check if user is admin (owner or admin role)
 */
export const isUserAdmin = async (tournamentId: string, uid: string): Promise<boolean> => {
  const role = await getMyTournamentRole(tournamentId, uid);
  return role === 'owner' || role === 'admin';
};

/**
 * Listen to user's tournament refs in real-time
 * Returns unsubscribe function
 * Now returns denormalized data directly from tournamentRefs
 */
export const listenMyTournamentRefs = (
  uid: string,
  callback: (refs: TournamentRef[]) => void,
  onError?: (error: Error) => void
): Unsubscribe => {
  const tournamentRefsRef = collection(db, 'users', uid, 'tournamentRefs');
  const q = query(tournamentRefsRef, orderBy('joinedAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const refs: TournamentRef[] = snapshot.docs.map(doc => ({
        tournamentId: doc.id,
        role: doc.data().role || 'member',
        joinedAt: doc.data().joinedAt,
        // Denormalized fields
        name: doc.data().name || '',
        format: doc.data().format || '',
        contribution: doc.data().contribution || 0,
        participantsEstimated: doc.data().participantsEstimated || 0,
        inviteCode: doc.data().inviteCode || '',
        status: doc.data().status || 'active',
        lastActivityAt: doc.data().lastActivityAt || null,
      }));

      // Check if any refs are missing denormalized data or have mismatched status and fix them
      refs.forEach(async (ref) => {
        if (!ref.name || !ref.status) {
          try {
            const tournamentDoc = await getDoc(doc(db, 'tournaments', ref.tournamentId));
            if (tournamentDoc.exists()) {
              const tournamentData = tournamentDoc.data();
              const userTournamentRef = doc(db, 'users', uid, 'tournamentRefs', ref.tournamentId);
              await setDoc(userTournamentRef, {
                name: tournamentData.name,
                format: tournamentData.format,
                contribution: tournamentData.contribution,
                participantsEstimated: tournamentData.participantsEstimated,
                inviteCode: tournamentData.inviteCode,
                status: tournamentData.status || 'active',
                lastActivityAt: tournamentData.lastActivityAt || null,
              }, { merge: true });
            }
          } catch (error) {
            // Silent fail for migration
          }
        }
      });

      callback(refs);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
    }
  );
};

/**
 * Listen to a single tournament in real-time
 * Returns unsubscribe function
 */
export const listenTournament = (
  tournamentId: string,
  callback: (tournament: Tournament | null) => void
): Unsubscribe => {
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  return onSnapshot(tournamentRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({
        id: snapshot.id,
        ...snapshot.data(),
      } as Tournament);
    } else {
      callback(null);
    }
  });
};

/**
 * Listen to user's role in a tournament in real-time
 * Returns unsubscribe function
 */
export const listenMyRole = (
  tournamentId: string,
  uid: string,
  callback: (role: string | null) => void
): Unsubscribe => {
  const memberRef = doc(db, 'tournaments', tournamentId, 'members', uid);

  return onSnapshot(memberRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.data()?.role || null);
    } else {
      callback(null);
    }
  });
};

/**
 * Helper: Sync denormalized tournament data to all members' tournamentRefs
 * Call this after updating tournament fields that are denormalized
 */
const syncDenormalizedData = async (
  tournamentId: string,
  updates: Partial<Pick<TournamentRef, 'name' | 'format' | 'contribution' | 'participantsEstimated' | 'inviteCode' | 'status'>>
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) return;

  // Always update the current user's own ref (guaranteed to succeed)
  try {
    const myRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(myRef, updates, { merge: true });
  } catch {
    // Current user might not have a ref yet (edge case)
  }

  // Best-effort: try updating other members' refs.
  // This will only succeed for the current user's own doc (already done above)
  // and may fail for others due to rules — that's OK. Their refs will self-heal
  // when they next load their tournaments via listMyTournaments/listenMyTournamentRefs.
  try {
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const membersSnapshot = await getDocs(membersRef);

    const otherMembers = membersSnapshot.docs.filter((d) => d.id !== user.uid);
    await Promise.allSettled(
      otherMembers.map((memberDoc) => {
        const userTournamentRef = doc(db, 'users', memberDoc.id, 'tournamentRefs', tournamentId);
        return setDoc(userTournamentRef, updates, { merge: true });
      })
    );
  } catch {
    // Silent — self-healing in listenMyTournamentRefs covers stale refs
  }
};

/**
 * Update basic tournament fields (always allowed)
 * Also syncs denormalized data to all members
 */
export const updateTournamentBasic = async (
  tournamentId: string,
  updates: { name?: string; description?: string }
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para editar el torneo');
  }

  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        ...updates,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Sync denormalized data if name changed
    if (updates.name) {
      await syncDenormalizedData(tournamentId, { name: updates.name });
    }
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo actualizar el torneo');
  }
};

/**
 * Update tournament configuration with date-aware rules:
 * - Blocked entirely if status is finished / deleted / archived.
 * - startDate is blocked once today >= current startDate.
 * - endDate and participantsEstimated are always editable while not finished.
 * Also syncs denormalized data to all members.
 */
export const updateTournamentConfig = async (
  tournamentId: string,
  config: {
    format?: string;
    contribution?: number;
    currency?: string;
    startDate?: string;
    endDate?: string;
    participantsEstimated?: number;
  }
): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para editar el torneo');
  }

  try {
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));

    if (!tournamentDoc.exists()) {
      throw new Error('Torneo no encontrado');
    }

    const tournament = tournamentDoc.data() as Tournament;

    // Block all edits on closed tournaments
    if (['finished', 'deleted', 'archived'].includes(tournament.status)) {
      throw new Error('No se puede editar un torneo finalizado o archivado.');
    }

    const today = new Date().toISOString().split('T')[0];

    // Validate startDate: reject the change if the tournament has already started
    if (config.startDate !== undefined) {
      const currentStart = tournament.startDate;
      if (currentStart && today >= currentStart) {
        throw new Error('No se puede cambiar la fecha de inicio porque el torneo ya comenzó.');
      }
    }

    // Build the allowed update object (strip undefined values)
    const allowedUpdate: Record<string, any> = {};
    if (config.participantsEstimated !== undefined) allowedUpdate.participantsEstimated = config.participantsEstimated;
    if (config.endDate !== undefined) allowedUpdate.endDate = config.endDate;
    if (config.startDate !== undefined) allowedUpdate.startDate = config.startDate;
    if (config.contribution !== undefined) allowedUpdate.contribution = config.contribution;
    if (config.format !== undefined) allowedUpdate.format = config.format;
    if (config.currency !== undefined) allowedUpdate.currency = config.currency;

    if (Object.keys(allowedUpdate).length === 0) return;

    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      { ...allowedUpdate, updatedAt: serverTimestamp() },
      { merge: true }
    );

    // Sync denormalized data
    const denormalizedUpdates: Partial<TournamentRef> = {};
    if (allowedUpdate.format) denormalizedUpdates.format = allowedUpdate.format;
    if (allowedUpdate.contribution !== undefined) denormalizedUpdates.contribution = allowedUpdate.contribution;
    if (allowedUpdate.participantsEstimated !== undefined) denormalizedUpdates.participantsEstimated = allowedUpdate.participantsEstimated;

    if (Object.keys(denormalizedUpdates).length > 0) {
      await syncDenormalizedData(tournamentId, denormalizedUpdates);
    }
  } catch (error: any) {
    throw error;
  }
};

/**
 * Archive a tournament (soft delete with status=archived)
 * Also syncs status to all members
 */
export const archiveTournament = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para archivar el torneo');
  }

  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        status: 'archived',
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await updateTournamentInviteLinkStatus(tournamentId, 'revoked');

    // Update only the current user's own tournamentRef.
    // Other members will see status='archived' from the main tournament doc.
    const myRefDoc = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(myRefDoc, { status: 'archived' }, { merge: true }).catch(() => {});
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo archivar el torneo');
  }
};

/**
 * Touch lastActivityAt on a tournament.
 * Call after creating events, bets, or resolving results.
 */
export const touchLastActivity = async (tournamentId: string): Promise<void> => {
  try {
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(tournamentRef, {
      lastActivityAt: serverTimestamp(),
      hasActivity: true,
    }, { merge: true });
  } catch {
    // Silent — non-critical
  }
};

/**
 * Finish a tournament (admin only).
 * Validates that ALL events are finished or cancelled first.
 */
export const finishTournament = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para finalizar el torneo');

  // Read events directly from Firestore (avoids circular import with eventService)
  const eventsRef = collection(db, 'tournaments', tournamentId, 'events');
  const eventsSnap = await getDocs(eventsRef);

  // Block on upcoming/live (not yet happened).
  // For locked events: block only if they still have unsettled bets.
  const hardBlockers = eventsSnap.docs.filter((d) => {
    const s = d.data().status;
    return s === 'upcoming' || s === 'live';
  });
  if (hardBlockers.length > 0) {
    throw new Error(
      'No pod\u00e9s finalizar el torneo porque todav\u00eda hay eventos sin resolver.',
    );
  }

  // Check locked events for unsettled bets
  const lockedEvents = eventsSnap.docs.filter((d) => d.data().status === 'locked');
  for (const ev of lockedEvents) {
    const betsSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'events', ev.id, 'bets'));
    const hasPending = betsSnap.docs.some((b) => {
      const s = b.data().status;
      return s === 'open' || s === 'locked';
    });
    if (hasPending) {
      throw new Error(
        'No pod\u00e9s finalizar el torneo porque todav\u00eda hay apuestas sin resolver en algunos eventos.',
      );
    }
  }

  const tournamentRef = doc(db, 'tournaments', tournamentId);
  await setDoc(tournamentRef, {
    status: 'finished',
    finishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  await updateTournamentInviteLinkStatus(tournamentId, 'expired');
  await syncDenormalizedData(tournamentId, { status: 'finished' });

  // Notify all members: tournament_finished (best-effort)
  try {
    const [tSnap, membersSnap] = await Promise.all([
      getDoc(tournamentRef),
      getDocs(collection(db, 'tournaments', tournamentId, 'members')),
    ]);
    const tournamentName: string = tSnap.exists() ? (tSnap.data()?.name ?? 'El torneo') : 'El torneo';
    const memberUids = membersSnap.docs.map((d) => d.id);
    for (let i = 0; i < memberUids.length; i += 20) {
      const chunk = memberUids.slice(i, i + 20);
      const notifBatch = writeBatch(db);
      chunk.forEach((uid) => {
        const ref = doc(collection(db, 'users', uid, 'notifications'));
        notifBatch.set(ref, {
          type: 'tournament_finished',
          title: 'Torneo finalizado',
          body: `"${tournamentName}" finalizó`,
          fromUid: user.uid,
          tournamentId,
          meta: { tournamentId },
          createdAt: serverTimestamp(),
          readAt: null,
        });
      });
      await notifBatch.commit();
    }
  } catch {
    // Best-effort — never fail the finish
  }
};

/**
 * Soft delete a tournament (status=deleted)
 * Also syncs status to all members
 */
export const deleteTournamentSoft = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para eliminar el torneo');
  }

  try {
    // 1. Mark tournament as deleted
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        status: 'deleted',
        deletedAt: serverTimestamp(),
        deletedBy: user.uid,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    await updateTournamentInviteLinkStatus(tournamentId, 'revoked');

    // 2. Update only the current user's own tournamentRef
    //    (Rules only allow writing to your own /users/{uid}/ subcollection.)
    //    Other members will see status='deleted' from the main tournament doc.
    const myRefDoc = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(myRefDoc, { status: 'deleted' }, { merge: true }).catch(() => {});

    // 3. Best-effort: cancel any pending invitations for this tournament
    try {
      const pendingInvites = await getDocs(
        query(
          collection(db, 'tournamentInvites'),
          where('tournamentId', '==', tournamentId),
          where('fromUid', '==', user.uid),
          where('status', '==', 'pending'),
        )
      );
      await Promise.allSettled(
        pendingInvites.docs.map((d) =>
          setDoc(d.ref, { status: 'cancelled', updatedAt: serverTimestamp() }, { merge: true })
        )
      );
    } catch {
      // Best-effort — never fail the delete if invite cancellation errors
    }
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo eliminar el torneo');
  }
};

/**
 * Search tournaments by name (searches all tournaments the user has access to)
 * Excludes deleted tournaments
 */
export const searchTournaments = async (searchQuery: string): Promise<Tournament[]> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión para buscar torneos');
  }

  try {
    // Get all user's tournaments
    const myTournaments = await listMyTournaments();
    
    // Filter by search query (case insensitive) and exclude deleted tournaments
    const searchLower = searchQuery.toLowerCase();
    const filtered = myTournaments.filter(tournament => 
      tournament.status !== 'deleted' &&
      (tournament.name.toLowerCase().includes(searchLower) ||
      tournament.description?.toLowerCase().includes(searchLower) ||
      tournament.inviteCode.toLowerCase().includes(searchLower))
    );

    return filtered;
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo buscar torneos');
  }
};

/**
 * Utility function to fix desynchronized tournament refs
 * Syncs tournament status from main document to all members' refs
 * Useful after database updates or migrations
 */
export const syncTournamentRefsFromMain = async (tournamentId: string): Promise<void> => {
  const user = auth.currentUser;

  if (!user) {
    throw new Error('Debes iniciar sesión');
  }

  try {
    // Get main tournament document
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      throw new Error('Torneo no encontrado');
    }

    const tournamentData = tournamentDoc.data() as Tournament;

    // Sync all denormalized fields to members
    await syncDenormalizedData(tournamentId, {
      name: tournamentData.name,
      format: tournamentData.format,
      contribution: tournamentData.contribution,
      participantsEstimated: tournamentData.participantsEstimated,
      inviteCode: tournamentData.inviteCode,
      status: tournamentData.status,
    });

    console.log(`✅ Synced tournament ${tournamentId} refs successfully`);
  } catch (error: any) {
    console.error('Error syncing tournament refs:', error);
    throw error;
  }
};

/**
 * Migrate a member's role from 'owner' to 'admin' in a tournament.
 * Idempotent — no-op if role is already 'admin' or something else.
 * Called on TournamentScreen load for incremental, zero-downtime migration.
 */
export const migrateOwnerToAdmin = async (tournamentId: string, uid: string): Promise<void> => {
  try {
    const memberRef = doc(db, 'tournaments', tournamentId, 'members', uid);
    const memberDoc = await getDoc(memberRef);
    if (!memberDoc.exists() || memberDoc.data().role !== 'owner') return;
    await setDoc(memberRef, { role: 'admin' }, { merge: true });
    await setDoc(doc(db, 'users', uid, 'tournamentRefs', tournamentId), { role: 'admin' }, { merge: true });
    if (__DEV__) console.log(`[migrateOwnerToAdmin] uid=${uid} migrated in tournament ${tournamentId}`);
  } catch (e) {
    if (__DEV__) console.warn('[migrateOwnerToAdmin] Failed (best-effort):', e);
  }
};

/**
 * Check if the current user has been removed from a tournament.
 */
export const isMemberRemoved = async (tournamentId: string, uid: string): Promise<boolean> => {
  try {
    const memberDoc = await getDoc(doc(db, 'tournaments', tournamentId, 'members', uid));
    if (!memberDoc.exists()) return false;
    return memberDoc.data().status === 'removed';
  } catch {
    return false;
  }
};

/** Internal helper: recompute bet status from optionTotals (pending ↔ open only). */
const _computeBetStatus = (
  currentStatus: string,
  optionTotals: Record<string, number>,
): string => {
  if (currentStatus !== 'pending' && currentStatus !== 'open') return currentStatus;
  return Object.values(optionTotals).filter((v) => v > 0).length >= 2 ? 'open' : 'pending';
};

/**
 * Remove a member from a tournament (admin only).
 *
 * Rules:
 * - Target must not be admin/owner.
 * - Target must not have picks in locked/settled bets.
 * - Picks in pending/open bets are deleted and bet aggregates reverted atomically.
 * - Member doc is soft-removed: status='removed' (not hard-deleted).
 */
export const removeMemberFromTournament = async (
  tournamentId: string,
  targetUid: string,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');
  if (targetUid === user.uid) throw new Error('No puedes quitarte a ti mismo');

  const targetMemberRef = doc(db, 'tournaments', tournamentId, 'members', targetUid);
  const targetMemberDoc = await getDoc(targetMemberRef);
  if (!targetMemberDoc.exists()) throw new Error('El usuario no es miembro de este torneo');

  const { role: targetRole, status: targetStatus } = targetMemberDoc.data() as {
    role: string;
    status?: string;
  };
  if (targetRole === 'admin' || targetRole === 'owner') {
    throw new Error('No se puede quitar a un administrador del torneo');
  }
  if (targetStatus === 'removed') {
    throw new Error('El usuario ya fue removido de este torneo');
  }

  // ── Scan all events / bets for this target's picks ─────────────────────────
  type PickEntry = {
    betRef: any;
    betData: any;
    pickRef: any;
    pickData: any;
  };

  const eventsSnapshot = await getDocs(
    collection(db, 'tournaments', tournamentId, 'events'),
  );

  const picksToDelete: PickEntry[] = [];

  for (const eventDoc of eventsSnapshot.docs) {
    const eventId = eventDoc.id;
    const betsSnapshot = await getDocs(
      collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets'),
    );
    for (const betDoc of betsSnapshot.docs) {
      const betData = betDoc.data();
      if (betData.status === 'cancelled') continue;

      const pickRef = doc(
        db,
        'tournaments', tournamentId,
        'events', eventId,
        'bets', betDoc.id,
        'picks', targetUid,
      );
      const pickDoc = await getDoc(pickRef);
      if (!pickDoc.exists()) continue;

      if (betData.status === 'locked' || betData.status === 'settled') {
        throw new Error('No se puede quitar: ya participó en apuestas cerradas.');
      }

      picksToDelete.push({
        betRef: doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betDoc.id),
        betData,
        pickRef,
        pickData: pickDoc.data(),
      });
    }
  }

  // ── Build and commit write batch ────────────────────────────────────────────
  const batch = writeBatch(db);

  for (const { betRef, betData, pickRef, pickData } of picksToDelete) {
    batch.delete(pickRef);

    const stake = pickData.stakeAmount || 0;
    const selectionKey =
      typeof pickData.selection === 'object'
        ? JSON.stringify(pickData.selection)
        : String(pickData.selection);

    const newTotalPot = Math.max(0, (betData.totalPot || 0) - stake);
    const newTotalPicks = Math.max(0, (betData.totalPicks || 0) - 1);
    const newOptionTotals: Record<string, number> = { ...(betData.optionTotals || {}) };
    newOptionTotals[selectionKey] = Math.max(0, (newOptionTotals[selectionKey] || 0) - stake);

    const newStatus = _computeBetStatus(betData.status, newOptionTotals);
    batch.update(betRef, {
      ...(newStatus !== betData.status ? { status: newStatus } : {}),
      totalPot: newTotalPot,
      totalPicks: newTotalPicks,
      optionTotals: newOptionTotals,
      updatedAt: serverTimestamp(),
    });
  }

  // Soft-remove the member (never hard-delete)
  batch.set(
    targetMemberRef,
    { status: 'removed', removedAt: serverTimestamp(), removedBy: user.uid },
    { merge: true },
  );

  await batch.commit();
  invalidateMemberCountCache(tournamentId);
};
