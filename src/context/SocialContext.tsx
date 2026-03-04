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
  deleteNotification as deleteNotificationService,
} from '../services/notificationsService';
import {
  TournamentInvite,
  listenReceivedInvites,
  listenSentInvites,
  acceptTournamentInvite as acceptInviteService,
  rejectTournamentInvite as rejectInviteService,
  cancelTournamentInvite as cancelInviteService,
  dismissSentInvite as dismissInviteService,
} from '../services/inviteService';
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

  // Tournament Invites
  receivedInvites: TournamentInvite[];
  sentInvites: TournamentInvite[];
  pendingInviteCount: number;

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
  deleteNotification: (notificationId: string) => Promise<void>;
  // Invite actions
  acceptInvite: (inviteId: string) => Promise<string>;
  rejectInvite: (inviteId: string) => Promise<void>;
  cancelInvite: (inviteId: string) => Promise<void>;
  dismissSentInvite: (inviteId: string) => Promise<void>;

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

  // Tournament Invites state
  const [receivedInvites, setReceivedInvites] = useState<TournamentInvite[]>([]);
  const [sentInvites, setSentInvites] = useState<TournamentInvite[]>([]);

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
      setReceivedInvites([]);
      setSentInvites([]);
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

    // Tournament invite listeners
    const unsubReceivedInvites = listenReceivedInvites(user.uid, setReceivedInvites);
    const unsubSentInvites = listenSentInvites(user.uid, setSentInvites);

    return () => {
      unsubFriends();
      unsubIncoming();
      unsubOutgoing();
      unsubNotifications();
      unsubUnreadCount();
      unsubReceivedInvites();
      unsubSentInvites();
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

  const deleteNotification = async (notificationId: string) => {
    if (!user) throw new Error('User not authenticated');
    await deleteNotificationService(user.uid, notificationId);
  };

  const acceptInvite = async (inviteId: string): Promise<string> => {
    if (!user) throw new Error('User not authenticated');
    return acceptInviteService(inviteId);
  };

  const rejectInvite = async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return rejectInviteService(inviteId);
  };

  const cancelInvite = async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return cancelInviteService(inviteId);
  };

  const dismissSentInvite = async (inviteId: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated');
    return dismissInviteService(inviteId);
  };

  const refreshFriends = () => {
    // The listeners will automatically refresh, but this can be used to force a manual check
    setFriendsLoading(true);
  };

  const pendingInviteCount = receivedInvites.filter((i) => i.status === 'pending').length;

  return (
    <SocialContext.Provider
      value={{
        friends,
        incomingRequests,
        outgoingRequests,
        friendsLoading,
        receivedInvites,
        sentInvites,
        pendingInviteCount,
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
        deleteNotification,
        acceptInvite,
        rejectInvite,
        cancelInvite,
        dismissSentInvite,
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
