import { 
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  serverTimestamp,
  runTransaction,
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
  status: string; // active, archived, deleted, locked
  hasActivity: boolean; // true if events/bets exist
  currency?: string;
  createdAt: any;
  updatedAt: any;
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

        // Create member entry for owner
        const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
        transaction.set(memberRef, {
          role: 'owner',
          joinedAt: serverTimestamp(),
        });

        // Create user tournament reference with denormalized data
        const userTournamentRef = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
        transaction.set(userTournamentRef, {
          role: 'owner',
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

    // Fetch tournament details
    const tournaments: Tournament[] = [];
    
    for (const refDoc of snapshot.docs) {
      const tournamentId = refDoc.id;
      const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
      
      if (tournamentDoc.exists()) {
        tournaments.push({
          id: tournamentDoc.id,
          ...tournamentDoc.data(),
        } as Tournament);
      }
    }

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

/**
 * Get member count for a tournament
 */
export const getTournamentMemberCount = async (tournamentId: string): Promise<number> => {
  try {
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const snapshot = await getDocs(membersRef);
    return snapshot.size;
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
 * Update tournament configuration (only if hasActivity is false)
 * Also syncs denormalized data to all members
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
    // Check if tournament has activity
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      throw new Error('Torneo no encontrado');
    }

    const tournament = tournamentDoc.data() as Tournament;

    if (tournament.hasActivity) {
      throw new Error(
        'No se pueden editar estos campos porque el torneo ya tiene actividad (eventos o predicciones)'
      );
    }

    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await setDoc(
      tournamentRef,
      {
        ...config,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    // Sync denormalized data
    const denormalizedUpdates: Partial<TournamentRef> = {};
    if (config.format) denormalizedUpdates.format = config.format;
    if (config.contribution !== undefined) denormalizedUpdates.contribution = config.contribution;
    if (config.participantsEstimated !== undefined) denormalizedUpdates.participantsEstimated = config.participantsEstimated;

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

    // Update only the current user's own tournamentRef.
    // Other members will see status='archived' from the main tournament doc.
    const myRefDoc = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    await setDoc(myRefDoc, { status: 'archived' }, { merge: true }).catch(() => {});
  } catch (error: any) {
    throw new Error(error.message || 'No se pudo archivar el torneo');
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
