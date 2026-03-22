import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  TournamentInvite,
  listenReceivedInvites,
  listenSentInvites,
  acceptTournamentInvite as acceptInviteService,
  rejectTournamentInvite as rejectInviteService,
  cancelTournamentInvite as cancelInviteService,
  dismissSentInvite as dismissInviteService,
  dismissReceivedInvite as dismissReceivedInviteService,
} from '../services/inviteService';

interface InvitesContextType {
  receivedInvites: TournamentInvite[];
  sentInvites: TournamentInvite[];
  pendingInviteCount: number;
  acceptInvite: (inviteId: string) => Promise<string>;
  rejectInvite: (inviteId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  dismissSentInvite: (inviteId: string) => Promise<void>;
  dismissReceivedInvite: (inviteId: string) => Promise<void>;
}

const InvitesContext = createContext<InvitesContextType | undefined>(undefined);

export const InvitesProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [receivedInvites, setReceivedInvites] = useState<TournamentInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<TournamentInvite[]>([]);

  useEffect(() => {
    if (!user) {
      setReceivedInvites([]);
      setSentInvites([]);
      return;
    }

    const unsubReceived = listenReceivedInvites(user.uid, setReceivedInvites);
    const unsubSent = listenSentInvites(user.uid, setSentInvites);

    return () => {
      unsubReceived();
      unsubSent();
    };
  }, [user]);

  const acceptInvite = useCallback(async (inviteId: string): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    return acceptInviteService(inviteId);
  }, [user]);

  const rejectInvite = useCallback(async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return rejectInviteService(inviteId);
  }, [user]);

  const cancelInvite = useCallback(async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return cancelInviteService(inviteId);
  }, [user]);

  const dismissSentInvite = useCallback(async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return dismissInviteService(inviteId);
  }, [user]);

  const dismissReceivedInvite = useCallback(async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return dismissReceivedInviteService(inviteId);
  }, [user]);

  // Exclude invites the user has persistently hidden (hiddenBy.to) from the badge count
  const pendingInviteCount = useMemo(
    () => receivedInvites.filter((i) => i.status === 'pending' && !i.hiddenBy?.to).length,
    [receivedInvites],
  );

  const value = useMemo(() => ({
    receivedInvites,
    sentInvites,
    pendingInviteCount,
    acceptInvite,
    rejectInvite,
    cancelInvite,
    dismissSentInvite,
    dismissReceivedInvite,
  }), [
    receivedInvites, sentInvites, pendingInviteCount,
    acceptInvite, rejectInvite, cancelInvite, dismissSentInvite, dismissReceivedInvite,
  ]);

  return (
    <InvitesContext.Provider value={value}>
      {children}
    </InvitesContext.Provider>
  );
};

export const useInvites = () => {
  const context = useContext(InvitesContext);
  if (context === undefined) throw new Error('useInvites must be used within InvitesProvider');
  return context;
};
