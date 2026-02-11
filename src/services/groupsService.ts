import { 
  collection, 
  doc, 
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getPublicProfile, PublicProfile } from './publicProfileService';

export interface UserBalance {
  uid: string;
  username: string;
  displayName: string;
  photoURL?: string;
  netBalance: number; // positive = gana, negative = pierde
  totalWon: number;
  totalLost: number;
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
    const balancesMap = new Map<string, { totalWon: number; totalLost: number }>();
    memberUids.forEach(uid => {
      balancesMap.set(uid, { totalWon: 0, totalLost: 0 });
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
          }
        });

        // Each loser loses their stake
        losers.forEach(loser => {
          const stakeAmount = loser.stakeAmount || 0;
          const current = balancesMap.get(loser.uid);
          if (current) {
            current.totalLost += stakeAmount;
          }
        });
      }
    }

    // Fetch public profiles for all members in parallel
    const profilesPromises = memberUids.map(uid => getPublicProfile(uid));
    const profiles = await Promise.all(profilesPromises);

    // Build final user balances array
    const userBalances: UserBalance[] = memberUids.map((uid, index) => {
      const balance = balancesMap.get(uid) || { totalWon: 0, totalLost: 0 };
      const profile = profiles[index];
      
      return {
        uid,
        username: profile?.username || 'Usuario',
        displayName: profile?.displayName || profile?.username || 'Usuario',
        photoURL: profile?.photoURL,
        totalWon: balance.totalWon,
        totalLost: balance.totalLost,
        netBalance: balance.totalWon - balance.totalLost,
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
