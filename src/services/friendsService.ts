import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { PublicProfile } from './publicProfileService';

export interface FriendRequest {
  uid: string;
  createdAt: any;
}

export interface Friend {
  uid: string;
  createdAt: any;
}

export type FriendshipStatus = 'none' | 'friends' | 'pending_sent' | 'pending_received';

/**
 * Search users by username prefix
 */
export const searchUsersByUsernamePrefix = async (
  searchQuery: string
): Promise<PublicProfile[]> => {
  try {
    const qLower = searchQuery.toLowerCase().trim();
    if (qLower.length < 2) {
      return [];
    }

    const publicProfilesRef = collection(db, 'publicProfiles');
    const q = query(
      publicProfilesRef,
      where('usernameLower', '>=', qLower),
      where('usernameLower', '<=', qLower + '\uf8ff'),
      orderBy('usernameLower'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as PublicProfile);
  } catch (error) {
    console.error('Error searching users:', error);
    throw error;
  }
};

/**
 * Get friendship status between current user and target user
 */
export const getFriendshipStatus = async (
  currentUid: string,
  targetUid: string
): Promise<FriendshipStatus> => {
  try {
    if (currentUid === targetUid) {
      return 'none';
    }

    // Check if friends
    const friendDoc = await getDoc(
      doc(db, 'users', currentUid, 'friends', targetUid)
    );
    if (friendDoc.exists()) {
      return 'friends';
    }

    // Check if outgoing request exists (we sent)
    const outgoingDoc = await getDoc(
      doc(db, 'users', currentUid, 'outgoingRequests', targetUid)
    );
    if (outgoingDoc.exists()) {
      return 'pending_sent';
    }

    // Check if incoming request exists (they sent)
    const incomingDoc = await getDoc(
      doc(db, 'users', currentUid, 'incomingRequests', targetUid)
    );
    if (incomingDoc.exists()) {
      return 'pending_received';
    }

    return 'none';
  } catch (error) {
    console.error('Error getting friendship status:', error);
    throw error;
  }
};

/**
 * Send friend request
 * Creates outgoing request for sender and incoming request for receiver
 * Also creates a notification for the receiver
 */
export const sendFriendRequest = async (
  fromUid: string,
  toUid: string,
  fromUsername: string
): Promise<void> => {
  try {
    if (fromUid === toUid) {
      throw new Error('Cannot send friend request to yourself');
    }

    // Check if already friends or request exists
    const status = await getFriendshipStatus(fromUid, toUid);
    if (status !== 'none') {
      throw new Error('Friend request already exists or you are already friends');
    }

    const batch = writeBatch(db);

    // Create outgoing request for sender
    const outgoingRef = doc(db, 'users', fromUid, 'outgoingRequests', toUid);
    batch.set(outgoingRef, {
      uid: toUid,
      createdAt: serverTimestamp(),
    });

    // Create incoming request for receiver
    const incomingRef = doc(db, 'users', toUid, 'incomingRequests', fromUid);
    batch.set(incomingRef, {
      uid: fromUid,
      createdAt: serverTimestamp(),
    });

    // Create notification for receiver
    const notificationRef = doc(collection(db, 'users', toUid, 'notifications'));
    batch.set(notificationRef, {
      type: 'friend_request',
      title: 'Nueva solicitud de amistad',
      body: `@${fromUsername} te ha enviado una solicitud de amistad`,
      fromUid: fromUid,
      createdAt: serverTimestamp(),
      readAt: null,
      meta: {},
    });

    await batch.commit();
  } catch (error) {
    console.error('Error sending friend request:', error);
    throw error;
  }
};

/**
 * Accept friend request
 * Deletes both request docs and creates friend docs for both users
 * Also creates a notification for the requester
 */
export const acceptFriendRequest = async (
  currentUid: string,
  fromUid: string,
  currentUsername: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete incoming request
    const incomingRef = doc(db, 'users', currentUid, 'incomingRequests', fromUid);
    batch.delete(incomingRef);

    // Delete outgoing request from the sender
    const outgoingRef = doc(db, 'users', fromUid, 'outgoingRequests', currentUid);
    batch.delete(outgoingRef);

    // Create friend doc for current user
    const currentFriendRef = doc(db, 'users', currentUid, 'friends', fromUid);
    batch.set(currentFriendRef, {
      uid: fromUid,
      createdAt: serverTimestamp(),
    });

    // Create friend doc for other user
    const otherFriendRef = doc(db, 'users', fromUid, 'friends', currentUid);
    batch.set(otherFriendRef, {
      uid: currentUid,
      createdAt: serverTimestamp(),
    });

    // Create notification for the requester
    const notificationRef = doc(collection(db, 'users', fromUid, 'notifications'));
    batch.set(notificationRef, {
      type: 'friend_accepted',
      title: 'Solicitud aceptada',
      body: `@${currentUsername} aceptó tu solicitud de amistad`,
      fromUid: currentUid,
      createdAt: serverTimestamp(),
      readAt: null,
      meta: {},
    });

    await batch.commit();
  } catch (error) {
    console.error('Error accepting friend request:', error);
    throw error;
  }
};

/**
 * Reject friend request
 * Deletes both request docs
 */
export const rejectFriendRequest = async (
  currentUid: string,
  fromUid: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete incoming request
    const incomingRef = doc(db, 'users', currentUid, 'incomingRequests', fromUid);
    batch.delete(incomingRef);

    // Delete outgoing request from sender
    const outgoingRef = doc(db, 'users', fromUid, 'outgoingRequests', currentUid);
    batch.delete(outgoingRef);

    await batch.commit();
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    throw error;
  }
};

/**
 * Cancel sent friend request
 * Deletes both request docs
 */
export const cancelFriendRequest = async (
  currentUid: string,
  toUid: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete outgoing request
    const outgoingRef = doc(db, 'users', currentUid, 'outgoingRequests', toUid);
    batch.delete(outgoingRef);

    // Delete incoming request for receiver
    const incomingRef = doc(db, 'users', toUid, 'incomingRequests', currentUid);
    batch.delete(incomingRef);

    await batch.commit();
  } catch (error) {
    console.error('Error canceling friend request:', error);
    throw error;
  }
};

/**
 * Remove friend
 * Deletes friend docs for both users
 */
export const removeFriend = async (
  currentUid: string,
  friendUid: string
): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // Delete friend doc for current user
    const currentFriendRef = doc(db, 'users', currentUid, 'friends', friendUid);
    batch.delete(currentFriendRef);

    // Delete friend doc for other user
    const otherFriendRef = doc(db, 'users', friendUid, 'friends', currentUid);
    batch.delete(otherFriendRef);

    await batch.commit();
  } catch (error) {
    console.error('Error removing friend:', error);
    throw error;
  }
};

/**
 * Listen to friends list
 */
export const listenFriends = (
  uid: string,
  callback: (friends: Friend[]) => void
): Unsubscribe => {
  const friendsRef = collection(db, 'users', uid, 'friends');
  const q = query(friendsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const friends = snapshot.docs.map(doc => doc.data() as Friend);
      callback(friends);
    },
    (error) => {
      console.error('Error listening to friends:', error);
      callback([]);
    }
  );
};

/**
 * Listen to incoming friend requests
 */
export const listenIncomingRequests = (
  uid: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const requestsRef = collection(db, 'users', uid, 'incomingRequests');
  const q = query(requestsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map(doc => doc.data() as FriendRequest);
      callback(requests);
    },
    (error) => {
      console.error('Error listening to incoming requests:', error);
      callback([]);
    }
  );
};

/**
 * Listen to outgoing friend requests
 */
export const listenOutgoingRequests = (
  uid: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const requestsRef = collection(db, 'users', uid, 'outgoingRequests');
  const q = query(requestsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const requests = snapshot.docs.map(doc => doc.data() as FriendRequest);
      callback(requests);
    },
    (error) => {
      console.error('Error listening to outgoing requests:', error);
      callback([]);
    }
  );
};
