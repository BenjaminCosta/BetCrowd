import { 
  collection, 
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPublicProfile, PublicProfile } from './publicProfileService';
import { getUserProfile } from './userService';

export interface UserBalance {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  netBalance: number; // positive = gana, negative = pierde
  totalWon: number;
  totalLost: number;
  wonCount: number;  // number of bets won
  lostCount: number; // number of bets lost
}

export interface Debt {
  from: UserBalance; // quien debe
  to: UserBalance; // a quien se le debe
  amount: number;
}

/**
 * Calculate net balances for all users in a tournament
 * based on settled bets
 */
export const calculateTournamentBalances = async (
  tournamentId: string
): Promise<UserBalance[]> => {
  try {
    // Get all members
    const membersRef = collection(db, 'tournaments', tournamentId, 'members');
    const membersSnapshot = await getDocs(membersRef);
    
    if (membersSnapshot.empty) {
      return [];
    }

    const memberUids = membersSnapshot.docs.map(doc => doc.id);
    
    // Initialize balances map
    const balancesMap = new Map<string, { totalWon: number; totalLost: number; wonCount: number; lostCount: number }>();
    memberUids.forEach(uid => {
      balancesMap.set(uid, { totalWon: 0, totalLost: 0, wonCount: 0, lostCount: 0 });
    });

    // Get all events in tournament
    const eventsRef = collection(db, 'tournaments', tournamentId, 'events');
    const eventsSnapshot = await getDocs(eventsRef);

    // Process each event's bets
    for (const eventDoc of eventsSnapshot.docs) {
      const eventId = eventDoc.id;
      
      // Get all settled bets for this event
      const betsRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets');
      const betsQuery = query(betsRef, where('status', '==', 'settled'));
      const betsSnapshot = await getDocs(betsQuery);

      // Process each settled bet
      for (const betDoc of betsSnapshot.docs) {
        const bet = betDoc.data();
        const betId = betDoc.id;
        const result = bet.result;
        
        if (!result) continue;

        // Get all picks for this bet
        const picksRef = collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks');
        const picksSnapshot = await getDocs(picksRef);

        const picks: any[] = picksSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        }));

        // Calculate winners and losers
        const totalPot = picks.reduce((sum, pick) => sum + (pick.stakeAmount || 0), 0);
        
        let winners: any[] = [];
        let losers: any[] = [];

        // Determine winners based on bet type
        if (bet.type === 'winner' || bet.type === 'custom') {
          // Simple winner selection
          const winningOption = result.winner || result;
          winners = picks.filter(p => p.selection === winningOption);
          losers = picks.filter(p => p.selection !== winningOption);
        } else if (bet.type === 'score') {
          // Score prediction
          const correctScore = result.score || result;
          winners = picks.filter(p => {
            const pickScore = typeof p.selection === 'string' ? JSON.parse(p.selection) : p.selection;
            return pickScore.home === correctScore.home && pickScore.away === correctScore.away;
          });
          losers = picks.filter(p => {
            const pickScore = typeof p.selection === 'string' ? JSON.parse(p.selection) : p.selection;
            return !(pickScore.home === correctScore.home && pickScore.away === correctScore.away);
          });
        } else if (bet.type === 'over_under') {
          // Over/Under
          const actualTotal = result.total || 0;
          const line = bet.line || 0;
          const winningOption = actualTotal > line ? 'Over' : 'Under';
          winners = picks.filter(p => p.selection === winningOption);
          losers = picks.filter(p => p.selection !== winningOption);
        }

        // If no winners, it's a push - no one wins or loses
        if (winners.length === 0) continue;

        // Calculate winnings
        const totalWinnerStakes = winners.reduce((sum, w) => sum + (w.stakeAmount || 0), 0);
        const totalLoserStakes = losers.reduce((sum, l) => sum + (l.stakeAmount || 0), 0);

        // Each winner gets their stake back + proportional share of loser stakes
        winners.forEach(winner => {
          const stakeAmount = winner.stakeAmount || 0;
          const proportion = totalWinnerStakes > 0 ? stakeAmount / totalWinnerStakes : 0;
          const winnings = stakeAmount + (totalLoserStakes * proportion);
          
          const current = balancesMap.get(winner.uid);
          if (current) {
            current.totalWon += winnings - stakeAmount; // profit only
            current.wonCount += 1;
          }
        });

        // Each loser loses their stake
        losers.forEach(loser => {
          const stakeAmount = loser.stakeAmount || 0;
          const current = balancesMap.get(loser.uid);
          if (current) {
            current.totalLost += stakeAmount;
            current.lostCount += 1;
          }
        });
      }
    }

    // Fetch public profiles for all members in parallel
    const profilesPromises = memberUids.map(uid => getPublicProfile(uid));
    const rawProfiles = await Promise.all(profilesPromises);

    // Fallback: for members without a publicProfile doc, try users/{uid}
    const profiles = await Promise.all(
      rawProfiles.map(async (profile, i) => {
        if (profile) return profile;
        try {
          const userDoc = await getUserProfile(memberUids[i]);
          if (userDoc) {
            return {
              uid: memberUids[i],
              username: userDoc.username ?? '',
              usernameLower: (userDoc.username ?? '').toLowerCase(),
              displayName: userDoc.displayName ?? userDoc.fullName ?? userDoc.username ?? '',
              email: userDoc.email ?? '',
              photoURL: userDoc.photoURL,
              createdAt: null,
              updatedAt: null,
            } as PublicProfile;
          }
        } catch { /* ignore */ }
        return null;
      })
    );

    // Build final user balances array
    const userBalances: UserBalance[] = memberUids.map((uid, index) => {
      const balance = balancesMap.get(uid) || { totalWon: 0, totalLost: 0, wonCount: 0, lostCount: 0 };
      const profile = profiles[index];

      return {
        uid,
        username: profile?.username ?? '',
        displayName: profile?.displayName ?? profile?.username ?? '',
        photoURL: profile?.photoURL,
        totalWon: balance.totalWon,
        totalLost: balance.totalLost,
        netBalance: balance.totalWon - balance.totalLost,
        wonCount: balance.wonCount,
        lostCount: balance.lostCount,
      };
    });

    // Sort by net balance descending
    return userBalances.sort((a, b) => b.netBalance - a.netBalance);
  } catch (error) {
    console.error('Error calculating tournament balances:', error);
    throw error;
  }
};

/**
 * Calculate minimum debts (min cash flow algorithm)
 * Returns list of transfers needed to settle all debts
 */
export const calculateDebts = (balances: UserBalance[]): Debt[] => {
  // Filter to only users with non-zero balances
  const creditors = balances.filter(b => b.netBalance > 0).map(b => ({ ...b }));
  const debtors = balances.filter(b => b.netBalance < 0).map(b => ({ 
    ...b, 
    netBalance: Math.abs(b.netBalance) 
  }));

  const debts: Debt[] = [];

  // Greedy algorithm to minimize number of transactions
  let i = 0; // creditor index
  let j = 0; // debtor index

  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];

    const amountToSettle = Math.min(creditor.netBalance, debtor.netBalance);

    if (amountToSettle > 0.01) { // ignore tiny amounts
      debts.push({
        from: { ...debtor, netBalance: -debtor.netBalance }, // restore original sign
        to: creditor,
        amount: amountToSettle,
      });
    }

    creditor.netBalance -= amountToSettle;
    debtor.netBalance -= amountToSettle;

    if (creditor.netBalance <= 0.01) {
      i++;
    }
    if (debtor.netBalance <= 0.01) {
      j++;
    }
  }

  return debts;
};

// ─── Pick History ─────────────────────────────────────────────────────────────

export interface UserPickHistory {
  eventId: string;
  eventTitle: string;
  betId: string;
  betTitle: string;
  betType: string;
  /** User's selection as a display string */
  selection: string;
  result: 'won' | 'lost';
  stakeAmount: number;
}

/**
 * Fetch all settled-bet picks for a specific user in a tournament.
 * Capped at MAX_HISTORY_ITEMS to bound Firestore read cost.
 */
const MAX_HISTORY_ITEMS = 50;

export const getUserPickHistory = async (
  tournamentId: string,
  uid: string
): Promise<UserPickHistory[]> => {
  const history: UserPickHistory[] = [];

  const eventsSnap = await getDocs(
    collection(db, 'tournaments', tournamentId, 'events')
  );

  for (const eventDoc of eventsSnap.docs) {
    if (history.length >= MAX_HISTORY_ITEMS) break;
    const eventId = eventDoc.id;
    const eventTitle = (eventDoc.data().title as string) || 'Evento';

    const betsSnap = await getDocs(
      query(
        collection(db, 'tournaments', tournamentId, 'events', eventId, 'bets'),
        where('status', '==', 'settled')
      )
    );

    for (const betDoc of betsSnap.docs) {
      if (history.length >= MAX_HISTORY_ITEMS) break;
      const bet = betDoc.data();
      const betId = betDoc.id;
      const result = bet.result;
      if (!result) continue;

      // Read only this user's pick (single doc, permission-safe)
      const pickSnap = await getDoc(
        doc(db, 'tournaments', tournamentId, 'events', eventId, 'bets', betId, 'picks', uid)
      );
      if (!pickSnap.exists()) continue;

      const pick = pickSnap.data();
      const selection = pick.selection;
      const stakeAmount: number = pick.stakeAmount || 0;

      // Determine win/loss using same logic as calculateTournamentBalances
      let isWinner = false;
      if (bet.type === 'score') {
        const correctScore = result.score ?? result;
        let pickScore: any = null;
        try {
          pickScore = typeof selection === 'string' ? JSON.parse(selection) : selection;
        } catch (parseErr) {
          console.warn('getUserPickHistory: malformed score selection', selection, parseErr);
        }
        isWinner =
          pickScore != null &&
          pickScore.home === correctScore.home &&
          pickScore.away === correctScore.away;
      } else if (bet.type === 'over_under') {
        const winningOption = (result.total || 0) > (bet.line || 0) ? 'Over' : 'Under';
        isWinner = selection === winningOption;
      } else {
        // 'winner' | 'custom' and any unknown type
        const winningOption = result.winner ?? result;
        isWinner = selection === winningOption;
      }

      // Format selection for display
      const displaySelection =
        typeof selection === 'object' ? JSON.stringify(selection) : String(selection);

      history.push({
        eventId,
        eventTitle,
        betId,
        betTitle: (bet.title as string) || 'Apuesta',
        betType: (bet.type as string) || 'custom',
        selection: displaySelection,
        result: isWinner ? 'won' : 'lost',
        stakeAmount,
      });
    }
  }

  return history;
};
