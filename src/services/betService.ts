import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// Bet interface with odds calculation fields
export interface Bet {
  id: string;
  title: string;
  description?: string;
  type: 'winner' | 'score' | 'over_under' | 'custom';
  options: string[]; // for winner/custom, or ["Over", "Under"] for over_under
  stakeType: 'fixed' | 'free';
  stakeAmount: number;
  status: 'open' | 'locked' | 'settled' | 'cancelled';
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
  const q = query(betsRef, orderBy('createdAt', 'desc'));
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
    status: 'open' as const,
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
  
  await updateDoc(betRef, {
    status: 'settled',
    result,
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

  try {
    await runTransaction(db, async (transaction) => {
      const betDoc = await transaction.get(betRef);
      const pickDoc = await transaction.get(pickRef);
    
      if (!betDoc.exists()) {
        throw new Error('Bet not found');
      }

      const bet = betDoc.data() as Bet;
      const previousPick = pickDoc.exists() ? pickDoc.data() as Pick : null;
      
      // For score type, convert selection to string key for optionTotals
      const selectionKey = typeof selection === 'object' 
        ? JSON.stringify(selection) 
        : String(selection);

      // Calculate new totals
      let newTotalPot = bet.totalPot || 0;
      let newTotalPicks = bet.totalPicks || 0;
      const newOptionTotals = { ...(bet.optionTotals || {}) };

      // If updating existing pick, remove old values
      if (previousPick) {
        newTotalPot -= previousPick.stakeAmount;
        const oldKey = typeof previousPick.selection === 'object'
          ? JSON.stringify(previousPick.selection)
          : String(previousPick.selection);
        newOptionTotals[oldKey] = (newOptionTotals[oldKey] || 0) - previousPick.stakeAmount;
      } else {
        // New pick
        newTotalPicks += 1;
      }

      // Add new values
      newTotalPot += stakeAmount;
      newOptionTotals[selectionKey] = (newOptionTotals[selectionKey] || 0) + stakeAmount;

      // Update bet with new totals
      transaction.update(betRef, {
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
    // Handle permission errors that occur even when transaction succeeds
    if (error?.code === 'permission-denied' || error?.message?.includes('insufficient permissions')) {
      // Verify if the pick was actually created despite the error
      const pickDoc = await getDoc(pickRef);
      if (pickDoc.exists()) {
        // Operation succeeded, just update the index and return silently
        await updatePicksIndex(tournamentId, eventId, betId, uid);
        return;
      }
    }
    // Re-throw if it's an actual failure
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
 * Calculate odds for each option in a bet
 * Returns a map of option -> odds (e.g., "1.85")
 */
export const calculateOdds = (bet: Bet, fee: number = 0.05): Record<string, string> => {
  const odds: Record<string, string> = {};
  
  if (!bet.totalPot || bet.totalPot === 0 || !bet.optionTotals) {
    // No picks yet, show default odds
    bet.options.forEach(option => {
      odds[option] = '—';
    });
    return odds;
  }

  const effectivePot = bet.totalPot * (1 - fee);

  bet.options.forEach(option => {
    const amountOnOption = bet.optionTotals?.[option] || 0;
    
    if (amountOnOption === 0) {
      // No one picked this option, show max odds or placeholder
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
