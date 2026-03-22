import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  Friend,
  FriendRequest,
  listenFriends,
  listenIncomingRequests,
  listenOutgoingRequests,
  sendFriendRequest as sendFriendRequestService,
  acceptFriendRequest as acceptFriendRequestService,
  rejectFriendRequest as rejectFriendRequestService,
  cancelFriendRequest as cancelFriendRequestService,
  removeFriend as removeFriendService,
  getFriendshipStatus,
  FriendshipStatus,
} from '../services/friendsService';
import { PublicProfile, getPublicProfile } from '../services/publicProfileService';
import { getUserProfile } from '../services/userService';

export interface FriendWithProfile extends Friend {
  profile?: PublicProfile;
}

export interface FriendRequestWithProfile extends FriendRequest {
  profile?: PublicProfile;
}

interface FriendsContextType {
  friends: FriendWithProfile[];
  incomingRequests: FriendRequestWithProfile[];
  outgoingRequests: FriendRequestWithProfile[];
  friendsLoading: boolean;
  sendFriendRequest: (targetUid: string) => Promise<void>;
  acceptFriendRequest: (fromUid: string) => Promise<void>;
  rejectFriendRequest: (fromUid: string) => Promise<void>;
  cancelFriendRequest: (toUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  getFriendshipStatus: (targetUid: string) => Promise<FriendshipStatus>;
}

const FriendsContext = createContext<FriendsContextType | undefined>(undefined);

export const FriendsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestWithProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestWithProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [currentUsername, setCurrentUsername] = useState<string>('');

  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(profile => {
        if (profile?.username) setCurrentUsername(profile.username);
      }).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setFriendsLoading(false);
      return;
    }

    let active = true;
    const expectedUid = user.uid;

    const unsubFriends = listenFriends(expectedUid, async (friendsData) => {
      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          try {
            const profile = await getPublicProfile(friend.uid);
            return { ...friend, profile: profile || undefined };
          } catch {
            return { ...friend };
          }
        })
      );
      if (active) {
        setFriends(friendsWithProfiles);
        setFriendsLoading(false);
      }
    });

    const unsubIncoming = listenIncomingRequests(expectedUid, async (requestsData) => {
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          try {
            const profile = await getPublicProfile(request.uid);
            return { ...request, profile: profile || undefined };
          } catch {
            return { ...request };
          }
        })
      );
      if (active) setIncomingRequests(requestsWithProfiles);
    });

    const unsubOutgoing = listenOutgoingRequests(expectedUid, async (requestsData) => {
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          try {
            const profile = await getPublicProfile(request.uid);
            return { ...request, profile: profile || undefined };
          } catch {
            return { ...request };
          }
        })
      );
      if (active) setOutgoingRequests(requestsWithProfiles);
    });

    return () => {
      active = false;
      unsubFriends();
      unsubIncoming();
      unsubOutgoing();
    };
  }, [user]);

  const sendFriendRequest = useCallback(async (targetUid: string) => {
    if (!user || !currentUsername) throw new Error('User not authenticated or username not loaded');
    await sendFriendRequestService(user.uid, targetUid, currentUsername);
  }, [user, currentUsername]);

  const acceptFriendRequest = useCallback(async (fromUid: string) => {
    if (!user || !currentUsername) throw new Error('User not authenticated or username not loaded');
    await acceptFriendRequestService(user.uid, fromUid, currentUsername);
  }, [user, currentUsername]);

  const rejectFriendRequest = useCallback(async (fromUid: string) => {
    if (!user) throw new Error('User not authenticated');
    await rejectFriendRequestService(user.uid, fromUid);
  }, [user]);

  const cancelFriendRequest = useCallback(async (toUid: string) => {
    if (!user) throw new Error('User not authenticated');
    await cancelFriendRequestService(user.uid, toUid);
  }, [user]);

  const removeFriend = useCallback(async (friendUid: string) => {
    if (!user) throw new Error('User not authenticated');
    await removeFriendService(user.uid, friendUid);
  }, [user]);

  const checkFriendshipStatus = useCallback(async (targetUid: string): Promise<FriendshipStatus> => {
    if (!user) return 'none';
    return getFriendshipStatus(user.uid, targetUid);
  }, [user]);

  const value = useMemo(() => ({
    friends,
    incomingRequests,
    outgoingRequests,
    friendsLoading,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    cancelFriendRequest,
    removeFriend,
    getFriendshipStatus: checkFriendshipStatus,
  }), [
    friends, incomingRequests, outgoingRequests, friendsLoading,
    sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
    cancelFriendRequest, removeFriend, checkFriendshipStatus,
  ]);

  return (
    <FriendsContext.Provider value={value}>
      {children}
    </FriendsContext.Provider>
  );
};

export const useFriends = () => {
  const context = useContext(FriendsContext);
  if (context === undefined) throw new Error('useFriends must be used within FriendsProvider');
  return context;
};
