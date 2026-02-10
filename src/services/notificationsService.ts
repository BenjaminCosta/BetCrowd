import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  onSnapshot,
  updateDoc,
  writeBatch,
  serverTimestamp,
  Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface Notification {
  id: string;
  type: 'friend_request' | 'friend_accepted' | 'tournament_invite';
  title: string;
  body: string;
  fromUid: string;
  tournamentId?: string;
  createdAt: any;
  readAt: any | null;
  meta?: Record<string, any>;
}

/**
 * Listen to notifications for a user
 */
export const listenNotifications = (
  uid: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe => {
  const notificationsRef = collection(db, 'users', uid, 'notifications');
  const q = query(
    notificationsRef,
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      callback(notifications);
    },
    (error) => {
      console.error('Error listening to notifications:', error);
      callback([]);
    }
  );
};

/**
 * Listen to unread notification count
 * Note: We only use where clause without orderBy to avoid needing a composite index
 */
export const listenUnreadCount = (
  uid: string,
  callback: (count: number) => void
): Unsubscribe => {
  const notificationsRef = collection(db, 'users', uid, 'notifications');
  const q = query(
    notificationsRef,
    where('readAt', '==', null)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.size);
    },
    (error) => {
      console.error('Error listening to unread count:', error);
      callback(0);
    }
  );
};

/**
 * Mark a single notification as read
 */
export const markAsRead = async (
  uid: string,
  notificationId: string
): Promise<void> => {
  try {
    const notificationRef = doc(db, 'users', uid, 'notifications', notificationId);
    await updateDoc(notificationRef, {
      readAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Mark all notifications as read
 */
export const markAllAsRead = async (uid: string): Promise<void> => {
  try {
    const notificationsRef = collection(db, 'users', uid, 'notifications');
    const q = query(
      notificationsRef,
      where('readAt', '==', null)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach(docSnapshot => {
      batch.update(docSnapshot.ref, {
        readAt: serverTimestamp(),
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
};
