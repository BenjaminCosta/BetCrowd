import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Unsubscribe, getDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
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
  // Track whether we've done the one-time stale-status verification this session
  const hasVerifiedStatuses = useRef(false);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

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
        lastActivityAt: ref.lastActivityAt || null,
        createdAt: ref.joinedAt,
        updatedAt: ref.joinedAt,
      }));

      // Sort: active/locked first (by lastActivityAt DESC, fallback joinedAt), then finished
      tournamentsData.sort((a, b) => {
        const aOrder = (a.status === 'active' || a.status === 'locked') ? 0 : 1;
        const bOrder = (b.status === 'active' || b.status === 'locked') ? 0 : 1;
        if (aOrder !== bOrder) return aOrder - bOrder;
        const aTime = a.lastActivityAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.lastActivityAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });

      setTournaments(tournamentsData);

      // Set admin statuses from roles
      const newAdminStatuses: Record<string, boolean> = {};
      refs.forEach(ref => {
        newAdminStatuses[ref.tournamentId] = ref.role === 'owner' || ref.role === 'admin';
      });
      setAdminStatuses(newAdminStatuses);

      // Always set loading to false after first data arrives
      setLoading(false);

      // One-time per session: fix stale 'deleted' status for refs that weren't
      // updated when an admin deleted the tournament (they can only update their own ref).
      if (!hasVerifiedStatuses.current) {
        hasVerifiedStatuses.current = true;
        // PERF: Parallel fetch — all tournament status checks fire simultaneously
        const activeRefs = refs.filter(r => r.status !== 'deleted');
        Promise.all(
          activeRefs.map(async (ref) => {
            try {
              const snap = await getDoc(doc(db, 'tournaments', ref.tournamentId));
              if (isMounted.current && snap.exists() && snap.data()?.status === 'deleted') {
                await setDoc(
                  doc(db, 'users', user.uid, 'tournamentRefs', ref.tournamentId),
                  { status: 'deleted' },
                  { merge: true },
                );
              }
            } catch {
              // Best-effort, never throw
            }
          })
        ).catch(() => {});
      }
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

  const value = useMemo(
    () => ({ tournaments, adminStatuses, loading, refreshing, refresh }),
    [tournaments, adminStatuses, loading, refreshing, refresh],
  );

  return (
    <TournamentsContext.Provider value={value}>
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
