import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Unsubscribe } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import {
  Tournament,
  TournamentRef,
  listenMyTournamentRefs,
} from '../services/tournamentService';

interface TournamentsContextType {
  tournaments: Tournament[];
  adminStatuses: Record<string, boolean>;
  loading: boolean;
  refreshing: boolean;
  refresh: () => Promise<void>;
}

const TournamentsContext = createContext<TournamentsContextType | undefined>(undefined);

export const TournamentsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [adminStatuses, setAdminStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) {
      setTournaments([]);
      setAdminStatuses({});
      setLoading(false);
      return;
    }

    setLoading(true);

    // Single listener on tournamentRefs - no N+1 queries!
    const unsubscribe = listenMyTournamentRefs(user.uid, (refs: TournamentRef[]) => {
      // Convert TournamentRef to Tournament format
      const tournamentsData: Tournament[] = refs.map(ref => ({
        id: ref.tournamentId,
        name: ref.name || 'Torneo', // Fallback for old data
        description: '', // Not needed for card display
        format: ref.format || 'liga', // Fallback
        contribution: ref.contribution || 0, // Fallback
        participantsEstimated: ref.participantsEstimated || 0, // Fallback
        inviteCode: ref.inviteCode || '', // Fallback
        status: ref.status || 'active', // Fallback
        ownerId: '', // Not needed for card display
        hasActivity: false, // Not needed for card display
        createdAt: ref.joinedAt,
        updatedAt: ref.joinedAt,
      }));

      setTournaments(tournamentsData);

      // Set admin statuses from roles
      const newAdminStatuses: Record<string, boolean> = {};
      refs.forEach(ref => {
        newAdminStatuses[ref.tournamentId] = ref.role === 'owner' || ref.role === 'admin';
      });
      setAdminStatuses(newAdminStatuses);

      // Always set loading to false after first data arrives
      setLoading(false);
    }, () => {
      // Error callback: stop loading on error
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [user]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    // The listener will handle the refresh automatically
    // Just wait a moment for visual feedback
    await new Promise(resolve => setTimeout(resolve, 500));
    setRefreshing(false);
  }, []);

  return (
    <TournamentsContext.Provider
      value={{
        tournaments,
        adminStatuses,
        loading,
        refreshing,
        refresh,
      }}
    >
      {children}
    </TournamentsContext.Provider>
  );
};

export const useTournaments = () => {
  const context = useContext(TournamentsContext);
  if (context === undefined) {
    throw new Error('useTournaments must be used within TournamentsProvider');
  }
  return context;
};
