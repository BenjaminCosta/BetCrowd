import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// ─── Internal helpers ────────────────────────────────────────────────────────
/** Touch lastActivityAt on the parent tournament (best-effort, non-blocking). */
const _touchTournamentActivity = (tournamentId: string): void => {
  const ref = doc(db, 'tournaments', tournamentId);
  setDoc(ref, { lastActivityAt: serverTimestamp(), hasActivity: true }, { merge: true }).catch(() => {});
  // Also update current user's ref so home-screen sort stays fresh
  const uid = auth.currentUser?.uid;
  if (uid) {
    const userRef = doc(db, 'users', uid, 'tournamentRefs', tournamentId);
    setDoc(userRef, { lastActivityAt: serverTimestamp() }, { merge: true }).catch(() => {});
  }
};

// Bet interface with odds calculation fields
export interface Bet {
  id: string;
  title: string;
  description?: string;
  type: 'winner' | 'score' | 'over_under' | 'custom';
  options: string[]; // for winner/custom, or ["Over", "Under"] for over_under
  stakeType: 'fixed' | 'free';
  stakeAmount: number;
  status: 'pending' | 'open' | 'locked' | 'settled' | 'cancelled';
  closesAt?: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  result?: any; // filled when settled
  // For over_under type
  line?: number;
  // Odds calculation fields
  totalPot?: number; // sum of all stakes
  totalPicks?: number; // count of picks
  optionTotals?: Record<string, number>; // stake per option
}

export interface BetInput {
  title: string;
  description?: string;
  type: 'winner' | 'score' | 'over_under' | 'custom';
  options: string[];
  stakeType: 'fixed' | 'free';
  stakeAmount: number;
  closesAt?: Timestamp | null;
  line?: number;
}

// Pick interface
export interface Pick {
  uid: string;
  selection: string | any;
  stakeAmount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Set to a server timestamp when the user hides this pick from Predictions.
   * null (or absent) means the pick is visible. Hiding never touches bet totals
   * or settlement results — it is purely a display flag.
   */
  hiddenFromPredictionsAt?: any;
}

export interface PickInput {
  selection: string | any;
  stakeAmount: number;
}

/**
 * List all bets for an event, ordered by createdAt desc
 */
export const listBets = async (tournamentId: string, eventId: string): Promise<Bet[]> => {
  const betsRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets');
  const q = query(betsRef, orderBy('createdAt', 'desc'), limit(100));
  const snapshot = await getDocs(q);
  
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Bet[];
};

/**
 * Listen to bets changes in realtime
 */
export const listenBets = (
  tournamentId: string,
  eventId: string,
  callback: (bets: Bet[]) => void
): (() => void) => {
  const betsRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets');
  const q = query(betsRef, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const bets = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Bet[];
    callback(bets);
  });

  return unsubscribe;
};

/**
 * Listen to all picks for a single bet in realtime.
 * Used to derive live pool totals (totalPot, totalPicks, optionTotals) on the
 * client side when Firestore rules prevent member writes on the bet document.
 */
export const listenBetPicks = (
  tournamentId: string,
  eventId: string,
  betId: string,
  callback: (picks: Pick[]) => void,
): (() => void) => {
  const picksRef = collection(
    db,
    'tournaments', tournamentId,
    'events', eventId,
    'bets', betId,
    'picks',
  );
  return onSnapshot(picksRef, (snapshot) => {
    const picks = snapshot.docs.map((d) => ({
      uid: d.id,
      ...d.data(),
    })) as Pick[];
    callback(picks);
  });
};

/**
 * Get a single bet
 */
export const getBet = async (tournamentId: string, eventId: string, betId: string): Promise<Bet | null> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  const betDoc = await getDoc(betRef);
  
  if (!betDoc.exists()) {
    return null;
  }
  
  return {
    id: betDoc.id,
    ...betDoc.data(),
  } as Bet;
};

/**
 * Create a new bet (admin only)
 */
export const createBet = async (
  tournamentId: string,
  eventId: string,
  input: BetInput
): Promise<string> => {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Debes iniciar sesión');
  }

  // ── Guard: verify event is still active before writing ─────────────────────
  const eventRef = doc(db, 'tournaments', tournamentId, 'events', eventId);
  const eventSnap = await getDoc(eventRef);
  if (!eventSnap.exists()) throw new Error('El evento no existe.');
  const eventData = eventSnap.data();
  if (eventData.status === 'finished' || eventData.status === 'cancelled' || eventData.status === 'locked') {
    throw new Error('No se pueden crear apuestas en eventos finalizados.');
  }
  if (eventData.date) {
    const today = new Date().toISOString().split('T')[0];
    if (eventData.date < today) {
      throw new Error('No se pueden crear apuestas en eventos finalizados.');
    }
  }

  const betRef = doc(collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets'));
  
  // Initialize optionTotals based on options
  const initialOptionTotals: Record<string, number> = {};
  (input.options || []).forEach(option => {
    initialOptionTotals[option] = 0;
  });
  
  const betData = {
    title: input.title,
    description: input.description || '',
    type: input.type,
    options: input.options || [],
    stakeType: input.stakeType,
    stakeAmount: input.stakeAmount || 0,
    status: 'pending' as const,
    closesAt: input.closesAt || null,
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    // Initialize odds fields
    totalPot: 0,
    totalPicks: 0,
    optionTotals: initialOptionTotals,
    ...(input.line !== undefined && { line: input.line }),
  };

  await setDoc(betRef, betData);
  _touchTournamentActivity(tournamentId);
  return betRef.id;
};

/**
 * Update a bet (admin only)
 */
export const updateBet = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  patch: Partial<BetInput>
): Promise<void> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  
  await updateDoc(betRef, {
    ...patch,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Delete a bet (hard delete - prefer cancel instead)
 */
export const deleteBet = async (
  tournamentId: string,
  eventId: string,
  betId: string
): Promise<void> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  await deleteDoc(betRef);
};

/**
 * Cancel a bet (soft delete)
 */
export const cancelBet = async (
  tournamentId: string,
  eventId: string,
  betId: string
): Promise<void> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  
  await updateDoc(betRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp(),
  });
};

/**
 * Lock a bet (prevent new picks)
 */
export const lockBet = async (
  tournamentId: string,
  eventId: string,
  betId: string
): Promise<void> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  
  await updateDoc(betRef, {
    status: 'locked',
    updatedAt: serverTimestamp(),
  });
};

/**
 * Settle a bet with result
 */
export const settleBet = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  result: any
): Promise<void> => {
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);

  // Detect bets that were never activated (fewer than 2 sides had picks).
  // These must be voided regardless of the result the admin chose.
  const betSnap = await getDoc(betRef);
  const betData = betSnap.exists() ? (betSnap.data() as Bet) : null;
  const activeSides = Object.values(betData?.optionTotals ?? {}).filter((v) => v > 0).length;
  const isNeverActivated = activeSides < 2;

  const finalResult = isNeverActivated ? { ...result, void: true } : result;

  await updateDoc(betRef, {
    status: 'settled',
    result: finalResult,
    updatedAt: serverTimestamp(),
  });
  _touchTournamentActivity(tournamentId);

  // Auto-finish the event if every bet is now settled or cancelled
  try {
    const allBetsRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets');
    const allBetsSnap = await getDocs(allBetsRef);

    // Void any pending bets (never activated — fewer than 2 sides placed picks).
    // These will never be settled normally, so clear them before the finish check.
    const pendingBetDocs = allBetsSnap.docs.filter((d) => d.data().status === 'pending');
    if (pendingBetDocs.length > 0) {
      const voidBatch = writeBatch(db);
      pendingBetDocs.forEach((bd) => {
        voidBatch.update(bd.ref, {
          status: 'settled',
          result: { void: true },
          settledAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });
      await voidBatch.commit();
    }

    const pendingIds = new Set(pendingBetDocs.map((d) => d.id));
    const hasPending = allBetsSnap.docs.some((d) => {
      const s = d.data().status;
      // pending bets were just voided above — exclude them from this check
      return (s === 'open' || s === 'locked') && !pendingIds.has(d.id);
    });
    if (!hasPending) {
      const eventRef = doc(db, 'tournaments', tournamentId, 'events', eventId);
      const eventSnap = await getDoc(eventRef);
      const eventStatus = eventSnap.data()?.status;
      if (eventStatus === 'locked' || eventStatus === 'upcoming') {
        await updateDoc(eventRef, { status: 'finished', updatedAt: serverTimestamp() });

        // Notify all members: event_resulted (best-effort)
        // Firestore rules require fromUid == request.auth.uid for cross-user
        // notification writes. Only send if a session is active.
        const _notifUid = auth.currentUser?.uid;
        if (_notifUid) {
          try {
            const eventTitle = eventSnap.data()?.title ?? 'Un evento';
            const membersSnap = await getDocs(collection(db, 'tournaments', tournamentId, 'members'));
            const memberUids = membersSnap.docs.map((d) => d.id);
            for (let i = 0; i < memberUids.length; i += 20) {
              const chunk = memberUids.slice(i, i + 20);
              const notifBatch = writeBatch(db);
              chunk.forEach((uid) => {
                const notifRef = doc(collection(db, 'users', uid, 'notifications'));
                notifBatch.set(notifRef, {
                  type: 'event_resulted',
                  title: 'Resultado cargado',
                  body: `Ya se cargó el resultado de "${eventTitle}"`,
                  fromUid: _notifUid,
                  tournamentId,
                  eventId,
                  meta: { tournamentId, eventId },
                  createdAt: serverTimestamp(),
                  readAt: null,
                });
              });
              await notifBatch.commit();
            }
          } catch (err) {
            if (__DEV__) console.warn('settleBet: failed to send event_resulted notifications', err);
          }
        }
      }
    }
  } catch {
    // Best-effort — non-critical
  }
};

/**
 * Adjust the result of an already-settled bet (admin only).
 *
 * Rules:
 * - Only allowed when bet.status === 'settled'.
 * - Not allowed when bet.status === 'cancelled'.
 *
 * The function stores a minimal audit trail and overwrites the result field.
 * Winners/losers are recalculated on the next call to calculateTournamentBalances
 * (which is always a fresh read), so the adjustment is idempotent.
 */
export const adjustBetResult = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  newResult: any,
): Promise<void> => {
  const user = auth.currentUser;
  if (!user) throw new Error('Debes iniciar sesión');

  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  const betDoc = await getDoc(betRef);
  if (!betDoc.exists()) throw new Error('Apuesta no encontrada');

  const bet = betDoc.data() as Bet;
  if (bet.status === 'cancelled') {
    throw new Error('No se puede ajustar una apuesta cancelada');
  }
  if (bet.status !== 'settled') {
    throw new Error('Solo se puede ajustar el resultado de apuestas liquidadas');
  }

  const prevRevision = (bet as any).resultRevision ?? 0;
  await updateDoc(betRef, {
    result: newResult,
    resultUpdatedAt: serverTimestamp(),
    resultUpdatedBy: user.uid,
    resultRevision: prevRevision + 1,
    updatedAt: serverTimestamp(),
  });
};

// ========== PICKS ==========

/**
 * Get user's pick for a bet
 */
export const getMyPick = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string
): Promise<Pick | null> => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);
  const pickDoc = await getDoc(pickRef);
  
  if (!pickDoc.exists()) {
    return null;
  }
  
  return pickDoc.data() as Pick;
};

/**
 * Hide a settled pick from the Predictions screen.
 * Only sets a display flag — pick data, bet totals, and results are untouched.
 */
export const hideMyPick = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string,
): Promise<void> => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);
  await updateDoc(pickRef, {
    hiddenFromPredictionsAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
};

/**
 * Restore a previously-hidden pick back to the Predictions screen.
 */
export const restoreMyPick = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string,
): Promise<void> => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);
  await updateDoc(pickRef, {
    hiddenFromPredictionsAt: null,
    updatedAt: serverTimestamp(),
  });
};

/**
 * Create or update user's pick with transaction to update bet odds
 */
export const upsertMyPick = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string,
  selection: string | any,
  stakeAmount: number
): Promise<void> => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);

  // Compute selectionKey here so the permission-error fallback can also use it
  const selectionKey = typeof selection === 'object'
    ? JSON.stringify(selection)
    : String(selection);

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      const pickDoc = await transaction.get(pickRef);
    
      if (!betDoc.exists()) {
        throw new Error('Bet not found');
      }

      const bet = betDoc.data() as Bet;
      const previousPick = pickDoc.exists() ? pickDoc.data() as Pick : null;
      
      // selectionKey is computed in the outer scope

      // Calculate new totals
      let newTotalPot = bet.totalPot || 0;
      let newTotalPicks = bet.totalPicks || 0;
      const newOptionTotals = { ...(bet.optionTotals || {}) };

      // If updating existing pick, remove old values
      if (previousPick) {
        newTotalPot = Math.max(0, newTotalPot - previousPick.stakeAmount);
        const oldKey = typeof previousPick.selection === 'object'
          ? JSON.stringify(previousPick.selection)
          : String(previousPick.selection);
        newOptionTotals[oldKey] = Math.max(0, (newOptionTotals[oldKey] || 0) - previousPick.stakeAmount);
      } else {
        // New pick
        newTotalPicks += 1;
      }

      // Add new values
      newTotalPot += stakeAmount;
      newOptionTotals[selectionKey] = (newOptionTotals[selectionKey] || 0) + stakeAmount;

      // Recalculate status: pending ↔ open based on how many sides now have picks
      const newStatus = computeBetStatusFromOptionTotals(bet.status, newOptionTotals);
      const statusTransition = newStatus !== bet.status ? { status: newStatus } : {};

      // Update bet with new totals
      transaction.update(betRef, {
        ...statusTransition,
        totalPot: newTotalPot,
        totalPicks: newTotalPicks,
        optionTotals: newOptionTotals,
        updatedAt: serverTimestamp(),
      });

      // Update or create pick
      const pickData = {
        uid,
        selection,
        stakeAmount: stakeAmount || 0,
        updatedAt: serverTimestamp(),
      };

      if (pickDoc.exists()) {
        transaction.update(pickRef, pickData);
      } else {
        transaction.set(pickRef, {
          ...pickData,
          createdAt: serverTimestamp(),
        });
      }
    });

    // Also update picks index for PredictionsScreen
    await updatePicksIndex(tournamentId, eventId, betId, uid);
  } catch (error: any) {
    const isPermissionError =
      error?.code === 'permission-denied' ||
      error?.message?.includes('insufficient permissions') ||
      error?.message?.includes('Missing or insufficient permissions');

    if (isPermissionError) {
      // Read old pick BEFORE overwriting so we can compute the delta for bet totals.
      // NOTE: This non-transactional fallback may produce slightly inaccurate totals
      // under concurrent updates, but listenBetPicks-derived client totals will
      // eventually converge to the correct values.
      const existingDoc = await getDoc(pickRef);
      const existingPick = existingDoc.exists() ? (existingDoc.data() as Pick) : null;

      // Write/update the pick directly (users always have write access to their own pick)
      await setDoc(
        pickRef,
        {
          uid,
          selection,
          stakeAmount: stakeAmount || 0,
          updatedAt: serverTimestamp(),
          ...(existingPick ? {} : { createdAt: serverTimestamp() }),
        },
        { merge: true },
      );

      // Attempt to update bet totals so odds reflect the new pick.
      // This may still fail if Firestore rules deny member writes on the bet doc,
      // but it will succeed if rules are more permissive.
      try {
        const currentBetDoc = await getDoc(betRef);
        if (currentBetDoc.exists()) {
          const currentBet = currentBetDoc.data() as Bet;
          let newTotalPot = currentBet.totalPot || 0;
          let newTotalPicks = currentBet.totalPicks || 0;
          const newOptionTotals = { ...(currentBet.optionTotals || {}) };

          if (existingPick) {
            // Subtract old pick contribution
            const oldKey =
              typeof existingPick.selection === 'object'
                ? JSON.stringify(existingPick.selection)
                : String(existingPick.selection);
            newTotalPot -= existingPick.stakeAmount || 0;
            newOptionTotals[oldKey] = Math.max(
              0,
              (newOptionTotals[oldKey] || 0) - (existingPick.stakeAmount || 0),
            );
          } else {
            newTotalPicks += 1;
          }

          newTotalPot = Math.max(0, newTotalPot + stakeAmount);
          newOptionTotals[selectionKey] = (newOptionTotals[selectionKey] || 0) + stakeAmount;

          const newStatus = computeBetStatusFromOptionTotals(currentBet.status, newOptionTotals);
          const fallbackStatusTransition = newStatus !== currentBet.status ? { status: newStatus } : {};

          await updateDoc(betRef, {
            ...fallbackStatusTransition,
            totalPot: newTotalPot,
            totalPicks: newTotalPicks,
            optionTotals: newOptionTotals,
            updatedAt: serverTimestamp(),
          });
        }
      } catch { /* Bet totals update not permitted — odds will reflect on next full recalc */ }

      try { await updatePicksIndex(tournamentId, eventId, betId, uid); } catch { /* ignore */ }
      return;
    }
    // Re-throw any other error
    throw error;
  }
};

/**
 * Listen to user's pick changes in realtime
 */
export const listenMyPick = (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string,
  callback: (pick: Pick | null) => void
): (() => void) => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);

  const unsubscribe = onSnapshot(pickRef, (snapshot) => {
    if (!snapshot.exists()) {
      callback(null);
      return;
    }
    callback(snapshot.data() as Pick);
  });

  return unsubscribe;
};

/**
 * Get all picks for a bet (admin only, for settling)
 */
export const getAllPicks = async (
  tournamentId: string,
  eventId: string,
  betId: string
): Promise<Pick[]> => {
  const picksRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks');
  const snapshot = await getDocs(picksRef);
  
  return snapshot.docs.map((doc) => doc.data()) as Pick[];
};

/**
 * Check if user has already placed a pick
 */
export const hasUserPicked = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string
): Promise<boolean> => {
  const pick = await getMyPick(tournamentId, eventId, betId, uid);
  return pick !== null;
};

/**
 * Delete user's pick and update bet totals
 */
export const deleteMyPick = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string
): Promise<void> => {
  const pickRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid);
  const betRef = doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId);
  const indexRef = doc(db, 'users', uid, 'picksIndex', `${tournamentId}_${eventId}_${betId}`);

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      const pickDoc = await transaction.get(pickRef);

      if (!pickDoc.exists()) return; // Nothing to delete

      if (!betDoc.exists()) throw new Error('Bet not found');

      const bet = betDoc.data() as Bet;
      const previousPick = pickDoc.data() as Pick;

      const selectionKey =
        typeof previousPick.selection === 'object'
          ? JSON.stringify(previousPick.selection)
          : String(previousPick.selection);

      const newTotalPot = Math.max(0, (bet.totalPot || 0) - previousPick.stakeAmount);
      const newTotalPicks = Math.max(0, (bet.totalPicks || 0) - 1);
      const newOptionTotals = { ...(bet.optionTotals || {}) };
      newOptionTotals[selectionKey] = Math.max(
        0,
        (newOptionTotals[selectionKey] || 0) - previousPick.stakeAmount,
      );

      const newStatus = computeBetStatusFromOptionTotals(bet.status, newOptionTotals);
      const deleteStatusTransition = newStatus !== bet.status ? { status: newStatus } : {};

      transaction.update(betRef, {
        ...deleteStatusTransition,
        totalPot: newTotalPot,
        totalPicks: newTotalPicks,
        optionTotals: newOptionTotals,
        updatedAt: serverTimestamp(),
      });

      transaction.delete(pickRef);
    });
  } catch (error: any) {
    const isPermissionError =
      error?.code === 'permission-denied' ||
      error?.message?.includes('insufficient permissions') ||
      error?.message?.includes('Missing or insufficient permissions');

    if (isPermissionError) {
      // Fallback for members who can't write the bet document:
      // read the existing pick, delete it, and attempt to update bet totals separately.
      const existingDoc = await getDoc(pickRef);
      if (!existingDoc.exists()) return; // Nothing to delete

      const previousPick = existingDoc.data() as Pick;
      const selectionKey =
        typeof previousPick.selection === 'object'
          ? JSON.stringify(previousPick.selection)
          : String(previousPick.selection);

      await deleteDoc(pickRef);

      try {
        const currentBetDoc = await getDoc(betRef);
        if (currentBetDoc.exists()) {
          const currentBet = currentBetDoc.data() as Bet;
          const newTotalPot = Math.max(0, (currentBet.totalPot || 0) - (previousPick.stakeAmount || 0));
          const newTotalPicks = Math.max(0, (currentBet.totalPicks || 0) - 1);
          const newOptionTotals = { ...(currentBet.optionTotals || {}) };
          newOptionTotals[selectionKey] = Math.max(
            0,
            (newOptionTotals[selectionKey] || 0) - (previousPick.stakeAmount || 0),
          );
          const newStatus = computeBetStatusFromOptionTotals(currentBet.status, newOptionTotals);
          const deleteStatusTransition = newStatus !== currentBet.status ? { status: newStatus } : {};
          await updateDoc(betRef, {
            ...deleteStatusTransition,
            totalPot: newTotalPot,
            totalPicks: newTotalPicks,
            optionTotals: newOptionTotals,
            updatedAt: serverTimestamp(),
          });
        }
      } catch { /* Bet totals update not permitted — totals may be stale */ }

      try { await deleteDoc(indexRef); } catch { }
      return;
    }

    throw error;
  }

  // Clean up picks index (best effort)
  try {
    await deleteDoc(indexRef);
  } catch {
    // Ignore index cleanup errors
  }
};

/**
 * Recompute bet status from current optionTotals.
 * Only transitions between 'pending' and 'open'.
 * Leaves 'locked', 'settled', and 'cancelled' untouched.
 */
export const computeBetStatusFromOptionTotals = (
  currentStatus: Bet['status'],
  optionTotals: Record<string, number>,
): Bet['status'] => {
  if (currentStatus !== 'pending' && currentStatus !== 'open') return currentStatus;
  const sidesWithPicks = Object.values(optionTotals).filter((v) => v > 0).length;
  return sidesWithPicks >= 2 ? 'open' : 'pending';
};

/**
 * Calculate odds for each option in a bet
 * Returns a map of option -> odds (e.g., "1.85")
 *
 * @param fee Commission rate applied to the pot (0 = no commission, 0.05 = 5%).
 *            Currently set to 0 — activate when real commission is in place.
 */
export const calculateOdds = (bet: Bet, fee: number = 0): Record<string, string> => {
  const odds: Record<string, string> = {};
  
  if (!bet.totalPot || bet.totalPot <= 0 || !bet.optionTotals) {
    // No picks yet, show default odds
    bet.options.forEach(option => {
      odds[option] = '—';
    });
    return odds;
  }

  const effectivePot = bet.totalPot * (1 - fee);

  bet.options.forEach(option => {
    const amountOnOption = bet.optionTotals?.[option] || 0;
    
    if (amountOnOption <= 0) {
      // No one picked this option (or stale negative value), show placeholder
      odds[option] = '—';
    } else {
      const calculatedOdds = effectivePot / amountOnOption;
      // Cap at 99.99 for display
      const cappedOdds = Math.min(calculatedOdds, 99.99);
      odds[option] = cappedOdds.toFixed(2);
    }
  });

  return odds;
};

/**
 * Calculate estimated odds for a specific option INCLUDING the user's own stake.
 * Correctly handles the edit scenario by first undoing the existing pick, then
 * applying the new one — matching exactly what upsertMyPick writes to Firestore.
 *
 * @param existingPickOption - The option key of the user's current pick (if editing).
 * @param existingPickStake  - The stake of the user's current pick (if editing).
 */
export const calculateEstimatedOdds = (
  bet: Bet,
  selectedOption: string,
  stakeAmount: number,
  existingPickOption?: string | null,
  existingPickStake?: number,
  fee: number = 0, // Commission rate — currently 0, activate when charging real commission
): string => {
  const hasExistingPick = !!existingPickOption && (existingPickStake ?? 0) > 0;

  // Free-stake: no amount entered yet — fall back to current odds
  if (stakeAmount <= 0 && !hasExistingPick) {
    return calculateOdds(bet, fee)[selectedOption] ?? '—';
  }

  // Project new state, mirroring upsertMyPick's transaction logic exactly
  let newPot = bet.totalPot || 0;
  const newOptionTotals: Record<string, number> = { ...(bet.optionTotals || {}) };

  // Step 1: undo existing pick (edit scenario)
  if (hasExistingPick) {
    newPot = Math.max(0, newPot - existingPickStake!);
    newOptionTotals[existingPickOption!] = Math.max(
      0,
      (newOptionTotals[existingPickOption!] || 0) - existingPickStake!,
    );
  }

  // Step 2: apply new pick
  if (stakeAmount > 0) {
    newPot += stakeAmount;
    newOptionTotals[selectedOption] = (newOptionTotals[selectedOption] || 0) + stakeAmount;
  }

  // Market must have picks on at least 2 different sides to produce real odds
  const sidesWithPicks = Object.values(newOptionTotals).filter((v) => v > 0).length;
  if (sidesWithPicks < 2) return '—';

  const newOptionTotal = newOptionTotals[selectedOption] || 0;
  if (newOptionTotal <= 0) return '—';

  const effectivePot = newPot * (1 - fee);
  return Math.min(effectivePot / newOptionTotal, 99.99).toFixed(2);
};

// ─── Bet Status Helpers ───────────────────────────────────────────────────────

export type BetStatus = Bet['status'];

/** Status is one of the "active" (not yet resolved) states */
export const isActiveBet = (status: BetStatus): boolean =>
  status === 'pending' || status === 'open' || status === 'locked';

/** User can still place a new pick */
export const canPlacePick = (status: BetStatus): boolean =>
  status === 'pending' || status === 'open';

/** User can change their existing pick */
export const canEditPick = (status: BetStatus): boolean =>
  status === 'pending' || status === 'open';

/** User can cancel/delete their existing pick */
export const canCancelPick = (status: BetStatus): boolean =>
  status === 'pending' || status === 'open';

/** Admin action buttons (edit/delete/close/results) are available */
export const adminActionsVisible = (status: BetStatus): boolean =>
  status !== 'cancelled';

/**
 * Update user's picks index for PredictionsScreen
 */
const updatePicksIndex = async (
  tournamentId: string,
  eventId: string,
  betId: string,
  uid: string
): Promise<void> => {
  const indexRef = doc(db, 'users', uid, 'picksIndex', `${tournamentId}_${eventId}_${betId}`);
  
  await setDoc(indexRef, {
    tournamentId,
    eventId,
    betId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
};

/**
 * Get user's picks across a tournament (for PredictionsScreen)
 */
export const getUserPicksForTournament = async (
  uid: string,
  tournamentId: string
): Promise<Array<{
  tournamentId: string;
  eventId: string;
  betId: string;
  pick?: Pick;
  bet?: Bet;
}>> => {
  const indexRef = collection(db, 'users', uid, 'picksIndex');
  const q = query(indexRef, orderBy('updatedAt', 'desc'));
  const snapshot = await getDocs(q);
  
  const picks: Array<any> = [];
  
  for (const indexDoc of snapshot.docs) {
    const data = indexDoc.data();
    
    // Filter by tournament
    if (data.tournamentId !== tournamentId) continue;
    
    // Get the actual pick and bet data
    const pickData = await getMyPick(data.tournamentId, data.eventId, data.betId, uid);
    const betData = await getBet(data.tournamentId, data.eventId, data.betId);
    
    if (pickData && betData) {
      picks.push({
        tournamentId: data.tournamentId,
        eventId: data.eventId,
        betId: data.betId,
        pick: pickData,
        bet: betData,
      });
    }
  }
  
  return picks;
};

/**
 * Get the set of eventIds where the current user has at least one pick
 * in a given tournament. Uses the picksIndex subcollection for a single
 * filtered read instead of N+1 per-event queries.
 */
export const getPickedEventIds = async (
  uid: string,
  tournamentId: string,
): Promise<Set<string>> => {
  const indexRef = collection(db, 'users', uid, 'picksIndex');
  const q = query(indexRef, where('tournamentId', '==', tournamentId));
  const snapshot = await getDocs(q);
  const eventIds = new Set<string>();
  snapshot.docs.forEach((d) => {
    const data = d.data();
    if (data.eventId) eventIds.add(data.eventId as string);
  });
  return eventIds;
};
