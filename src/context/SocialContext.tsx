import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
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
import {
  Notification,
  listenNotifications,
  listenUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
} from '../services/notificationsService';
import { PublicProfile, getPublicProfile } from '../services/publicProfileService';
import { getUserProfile } from '../services/userService';

export interface FriendWithProfile extends Friend {
  profile?: PublicProfile;
}

export interface FriendRequestWithProfile extends FriendRequest {
  profile?: PublicProfile;
}

interface SocialContextType {
  // Friends
  friends: FriendWithProfile[];
  incomingRequests: FriendRequestWithProfile[];
  outgoingRequests: FriendRequestWithProfile[];
  friendsLoading: boolean;
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  notificationsLoading: boolean;
  
  // Actions
  sendFriendRequest: (targetUid: string) => Promise<void>;
  acceptFriendRequest: (fromUid: string) => Promise<void>;
  rejectFriendRequest: (fromUid: string) => Promise<void>;
  cancelFriendRequest: (toUid: string) => Promise<void>;
  removeFriend: (friendUid: string) => Promise<void>;
  getFriendshipStatus: (targetUid: string) => Promise<FriendshipStatus>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  
  // Refresh
  refreshFriends: () => void;
}

const SocialContext = createContext<SocialContextType | undefined>(undefined);

export const SocialProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  
  // Friends state
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequestWithProfile[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequestWithProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  
  // Notifications state
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Current user profile for username
  const [currentUsername, setCurrentUsername] = useState<string>('');

  // Load current user profile
  useEffect(() => {
    if (user) {
      getUserProfile(user.uid).then(profile => {
        if (profile?.username) {
          setCurrentUsername(profile.username);
        }
      }).catch(err => {
        console.error('Error loading user profile:', err);
      });
    }
  }, [user]);

  // Setup listeners when user is authenticated
  useEffect(() => {
    if (!user) {
      setFriends([]);
      setIncomingRequests([]);
      setOutgoingRequests([]);
      setNotifications([]);
      setUnreadCount(0);
      setFriendsLoading(false);
      setNotificationsLoading(false);
      return;
    }

    // Friends listeners
    const unsubFriends = listenFriends(user.uid, async (friendsData) => {
      const friendsWithProfiles = await Promise.all(
        friendsData.map(async (friend) => {
          try {
            const profile = await getPublicProfile(friend.uid);
            return { ...friend, profile: profile || undefined };
          } catch (error) {
            console.error('Error loading friend profile:', error);
            return { ...friend };
          }
        })
      );
      setFriends(friendsWithProfiles);
      setFriendsLoading(false);
    });

    const unsubIncoming = listenIncomingRequests(user.uid, async (requestsData) => {
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          try {
            const profile = await getPublicProfile(request.uid);
            return { ...request, profile: profile || undefined };
          } catch (error) {
            console.error('Error loading request profile:', error);
            return { ...request };
          }
        })
      );
      setIncomingRequests(requestsWithProfiles);
    });

    const unsubOutgoing = listenOutgoingRequests(user.uid, async (requestsData) => {
      const requestsWithProfiles = await Promise.all(
        requestsData.map(async (request) => {
          try {
            const profile = await getPublicProfile(request.uid);
            return { ...request, profile: profile || undefined };
          } catch (error) {
            console.error('Error loading request profile:', error);
            return { ...request };
          }
        })
      );
      setOutgoingRequests(requestsWithProfiles);
    });

    // Notifications listeners
    const unsubNotifications = listenNotifications(user.uid, (notificationsData) => {
      setNotifications(notificationsData);
      setNotificationsLoading(false);
    });

    const unsubUnreadCount = listenUnreadCount(user.uid, (count) => {
      setUnreadCount(count);
    });

    return () => {
      unsubFriends();
      unsubIncoming();
      unsubOutgoing();
      unsubNotifications();
      unsubUnreadCount();
    };
  }, [user]);

  // Action wrappers
  const sendFriendRequest = async (targetUid: string) => {
    if (!user || !currentUsername) {
      throw new Error('User not authenticated or username not loaded');
    }
    await sendFriendRequestService(user.uid, targetUid, currentUsername);
  };

  const acceptFriendRequest = async (fromUid: string) => {
    if (!user || !currentUsername) {
      throw new Error('User not authenticated or username not loaded');
    }
    await acceptFriendRequestService(user.uid, fromUid, currentUsername);
  };

  const rejectFriendRequest = async (fromUid: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await rejectFriendRequestService(user.uid, fromUid);
  };

  const cancelFriendRequest = async (toUid: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await cancelFriendRequestService(user.uid, toUid);
  };

  const removeFriend = async (friendUid: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await removeFriendService(user.uid, friendUid);
  };

  const checkFriendshipStatus = async (targetUid: string): Promise<FriendshipStatus> => {
    if (!user) {
      return 'none';
    }
    return await getFriendshipStatus(user.uid, targetUid);
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await markAsReadService(user.uid, notificationId);
  };

  const markAllAsRead = async () => {
    if (!user) {
      throw new Error('User not authenticated');
    }
    await markAllAsReadService(user.uid);
  };

  const refreshFriends = () => {
    // The listeners will automatically refresh, but this can be used to force a manual check
    setFriendsLoading(true);
  };

  return (
    <SocialContext.Provider
      value={{
        friends,
        incomingRequests,
        outgoingRequests,
        friendsLoading,
        notifications,
        unreadCount,
        notificationsLoading,
        sendFriendRequest,
        acceptFriendRequest,
        rejectFriendRequest,
        cancelFriendRequest,
        removeFriend,
        getFriendshipStatus: checkFriendshipStatus,
        markAsRead,
        markAllAsRead,
        refreshFriends,
      }}
    >
      {children}
    </SocialContext.Provider>
  );
};

export const useSocial = () => {
  const context = useContext(SocialContext);
  if (context === undefined) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return context;
};
