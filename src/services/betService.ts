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
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

// Bet interface
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
 * Create or update user's pick
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
  const pickDoc = await getDoc(pickRef);
  
  const pickData = {
    uid,
    selection,
    stakeAmount: stakeAmount || 0,
    updatedAt: serverTimestamp(),
  };

  if (pickDoc.exists()) {
    // Update existing pick
    await updateDoc(pickRef, pickData);
  } else {
    // Create new pick
    await setDoc(pickRef, {
      ...pickData,
      createdAt: serverTimestamp(),
    });
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
