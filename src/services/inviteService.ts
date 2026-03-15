import {
  collection,
  doc,
  query,
  where,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
  limit,
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TournamentInvite {
  id: string;
  tournamentId: string;
  tournamentName: string;
  fromUid: string;
  fromName: string;
  toUid: string;
  toName: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
  createdAt: any;
  updatedAt: any;
  /** Up to 5 current members snapshotted at invite-send time */
  memberPreviews?: { uid: string; displayName: string }[];
  /**
   * Persistent soft-hide flags. Each actor can only set their own flag.
   * fromUid sets `from`, toUid sets `to`.
   * Invites with their flag set are filtered out in the UI and badge counts.
   */
  hiddenBy?: { from?: boolean; to?: boolean };
}

export interface TournamentCodePreview {
  tournamentId: string;
  name: string;
  inviteCode: string;
  /** Up to 5 current members snapshotted progressively as people join */
  memberPreviews?: { uid: string; displayName: string }[];
}

// ─── Send invitations ─────────────────────────────────────────────────────────

/**
 * Send tournament invitations to multiple friends.
 * Silently skips users who are already members or already have a pending invite.
 * Returns { sent, skipped } counts.
 */
export const sendTournamentInvites = async (
  tournamentId: string,
  tournamentName: string,
  toUids: string[],
  toNameMap: Record<string, string> = {},
): Promise<{ sent: number; skipped: number }> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión para enviar invitaciones');

  const fromName = user.displayName || 'Alguien';
  let sent = 0;
  let skipped = 0;

  // Pre-fetch all member and duplicate-invite checks in parallel
  const checks = await Promise.all(
    toUids.map(async (toUid) => {
      const [memberSnap, dupSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId, 'members', toUid)),
        getDocs(query(
          collection(db, 'tournamentInvites'),
          where('tournamentId', '==', tournamentId),
          where('fromUid', '==', user.uid),
          where('toUid', '==', toUid),
          where('status', '==', 'pending'),
          limit(1),
        )),
      ]);
      return { toUid, isMember: memberSnap.exists(), hasPending: !dupSnap.empty };
    })
  );

  // Fetch first 5 current members for preview (best-effort — sender is a member so this is allowed)
  let memberPreviews: { uid: string; displayName: string }[] = [];
  try {
    const membersSnap = await getDocs(
      query(collection(db, 'tournaments', tournamentId, 'members'), limit(5))
    );
    const profileSnaps = await Promise.all(
      membersSnap.docs.map((d) => getDoc(doc(db, 'publicProfiles', d.id)))
    );
    memberPreviews = profileSnaps
      .filter((p) => p.exists())
      .map((p) => ({
        uid: p.id,
        displayName: (p.data()!.displayName as string) || (p.data()!.username as string) || '',
      }))
      .filter((m) => m.displayName);
  } catch {
    // Best-effort — never fail the invite send if preview fetch errors
  }

  // Process writes sequentially for eligible recipients
  for (const { toUid, isMember, hasPending } of checks) {
    if (isMember || hasPending) { skipped++; continue; }

    // Create the invite document
    const inviteRef = await addDoc(collection(db, 'tournamentInvites'), {
      tournamentId,
      tournamentName,
      fromUid: user.uid,
      fromName,
      toUid,
      toName: toNameMap[toUid] ?? '',
      status: 'pending',
      memberPreviews,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    // Create an in-app notification (best-effort — never fail the invite)
    try {
      const notifRef = doc(collection(db, 'users', toUid, 'notifications'));
      await setDoc(notifRef, {
        type: 'tournament_invite',
        title: 'Invitación a torneo',
        body: `${fromName} te invitó a "${tournamentName}"`,
        fromUid: user.uid,
        tournamentId,
        createdAt: serverTimestamp(),
        readAt: null,
        meta: { inviteId: inviteRef.id, tournamentId },
      });
    } catch {
      // Best-effort — don't fail the invite if notification write fails
    }

    sent++;
  }

  return { sent, skipped };
};

// ─── Accept ───────────────────────────────────────────────────────────────────

/**
 * Accept a tournament invitation.
 * Adds the current user as a member and marks the invite accepted.
 * Returns the tournamentId so the caller can navigate.
 */
export const acceptTournamentInvite = async (inviteId: string): Promise<string> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const inviteRef = doc(db, 'tournamentInvites', inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error('Invitación no encontrada');

  const invite = { id: inviteSnap.id, ...inviteSnap.data() } as TournamentInvite;
  if (invite.toUid !== user.uid) throw new Error('No autorizado');
  if (invite.status !== 'pending') throw new Error('Esta invitación ya fue procesada');

  const { tournamentId } = invite;

  // Fetch tournament data first for denormalization (read before batch)
  const tSnap = await getDoc(doc(db, 'tournaments', tournamentId));

  // Perform all writes atomically in a single batch
  const batch = writeBatch(db);

  // 1. Add user as a member
  const memberRef = doc(db, 'tournaments', tournamentId, 'members', user.uid);
  batch.set(memberRef, {
    role: 'member',
    joinedAt: serverTimestamp(),
  });

  // 2. Denormalize tournament data into user's tournamentRefs
  if (tSnap.exists()) {
    const t = tSnap.data();
    const tournamentRefDoc = doc(db, 'users', user.uid, 'tournamentRefs', tournamentId);
    batch.set(tournamentRefDoc, {
      role: 'member',
      joinedAt: serverTimestamp(),
      name: t.name,
      format: t.format,
      contribution: t.contribution,
      participantsEstimated: t.participantsEstimated,
      inviteCode: t.inviteCode,
      status: t.status,
    });
  }

  // 3. Mark invite as accepted
  batch.update(inviteRef, {
    status: 'accepted',
    updatedAt: serverTimestamp(),
  });

  await batch.commit();

  // Notify tournament admins: tournament_member_joined (best-effort)
  try {
    const membersSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'members'));
    const adminUids = membersSnap.docs
      .filter((d) => d.data().role === 'admin' || d.data().role === 'owner')
      .map((d) => d.id)
      .filter((uid) => uid !== user.uid);
    if (adminUids.length > 0) {
      const joinerName = invite.toName || user.displayName || 'Un usuario';
      const notifBatch = writeBatch(db);
      adminUids.forEach((adminUid) => {
        const notifRef = doc(collection(db, 'users', adminUid, 'notifications'));
        notifBatch.set(notifRef, {
          type: 'tournament_member_joined',
          title: 'Nuevo participante',
          body: `${joinerName} se unió al torneo "${invite.tournamentName}"`,
          fromUid: user.uid,
          tournamentId,
          meta: { tournamentId },
          createdAt: serverTimestamp(),
          readAt: null,
        });
      });
      await notifBatch.commit();
    }
  } catch (err) {
    if (__DEV__) console.warn('acceptTournamentInvite: failed to notify admins', err);
  }

  return tournamentId;
};

// ─── Reject ───────────────────────────────────────────────────────────────────

/**
 * Reject a received tournament invitation.
 */
export const rejectTournamentInvite = async (inviteId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const inviteRef = doc(db, 'tournamentInvites', inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error('Invitación no encontrada');
  if (snap.data()?.toUid !== user.uid) throw new Error('No autorizado');
  if (snap.data()?.status !== 'pending') throw new Error('Invitación no está pendiente');

  await updateDoc(inviteRef, {
    status: 'rejected',
    updatedAt: serverTimestamp(),
  });
};

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * Cancel a sent tournament invitation (only allowed for fromUid, only if pending).
 */
export const cancelTournamentInvite = async (inviteId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const inviteRef = doc(db, 'tournamentInvites', inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) throw new Error('Invitación no encontrada');
  const data = snap.data();
  if (data?.fromUid !== user.uid) throw new Error('No autorizado');
  if (data?.status !== 'pending') throw new Error('Solo se puede cancelar si está pendiente');

  await updateDoc(inviteRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
};

// ─── Dismiss (sender) ────────────────────────────────────────────────────────

/**
 * Persistently hide a sent invite from the sender's view.
 * Uses hiddenBy.from = true instead of deleteDoc (delete is blocked by rules).
 * Only the sender (fromUid) can call this, and only on non-pending invites.
 */
export const dismissSentInvite = async (inviteId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const inviteRef = doc(db, 'tournamentInvites', inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) return; // already gone
  const data = snap.data();
  if (data?.fromUid !== user.uid) throw new Error('No autorizado');
  if (data?.status === 'pending') throw new Error('No se puede ocultar una invitación pendiente');

  await updateDoc(inviteRef, {
    'hiddenBy.from': true,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Persistently hide a received invite from the recipient's view.
 * Uses hiddenBy.to = true instead of deleteDoc (delete is blocked by rules).
 * Only the recipient (toUid) can call this, and only on non-pending invites.
 */
export const dismissReceivedInvite = async (inviteId: string): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const inviteRef = doc(db, 'tournamentInvites', inviteId);
  const snap = await getDoc(inviteRef);
  if (!snap.exists()) return; // already gone
  const data = snap.data();
  if (data?.toUid !== user.uid) throw new Error('No autorizado');
  if (data?.status === 'pending') throw new Error('No se puede ocultar una invitación pendiente');

  await updateDoc(inviteRef, {
    'hiddenBy.to': true,
    updatedAt: serverTimestamp(),
  });
};

// ─── Listeners ────────────────────────────────────────────────────────────────

/**
 * Real-time listener for invites received by the current user.
 */
export const listenReceivedInvites = (
  toUid: string,
  callback: (invites: TournamentInvite[]) => void,
): Unsubscribe => {
  // No orderBy — a compound (toUid, createdAt) composite index is required
  // by Firestore for that query and is NOT auto-created. Without it the
  // listener silently errors and returns []. Sort client-side instead.
  const q = query(
    collection(db, 'tournamentInvites'),
    where('toUid', '==', toUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TournamentInvite))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta; // newest first
        });
      callback(invites);
    },
    (err) => { console.error('listenReceivedInvites error:', err); callback([]); },
  );
};

/**
 * Real-time listener for invites sent by the current user.
 */
export const listenSentInvites = (
  fromUid: string,
  callback: (invites: TournamentInvite[]) => void,
): Unsubscribe => {
  // No orderBy — same composite index issue as listenReceivedInvites above.
  const q = query(
    collection(db, 'tournamentInvites'),
    where('fromUid', '==', fromUid),
  );
  return onSnapshot(
    q,
    (snap) => {
      const invites = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as TournamentInvite))
        .sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() ?? 0;
          const tb = b.createdAt?.toMillis?.() ?? 0;
          return tb - ta; // newest first
        });
      callback(invites);
    },
    (err) => { console.error('listenSentInvites error:', err); callback([]); },
  );
};

// ─── Tournament preview by invite code ────────────────────────────────────────

/**
 * Resolve a tournament invite code without joining.
 * Reads the inviteCodes/{code} doc which stores a denormalized name field.
 * Returns null if the code is invalid.
 */
export const getTournamentCodePreview = async (
  code: string,
): Promise<TournamentCodePreview | null> => {
  const snap = await getDoc(doc(db, 'inviteCodes', code.toUpperCase()));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    tournamentId: data.tournamentId,
    name: data.name ?? 'Torneo privado',
    inviteCode: code.toUpperCase(),
    memberPreviews: (data.memberPreviews as { uid: string; displayName: string }[] | undefined) ?? [],
  };
};
