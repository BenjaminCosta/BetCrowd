import React, { createContext, useState, useEffect, useContext, useCallback, useMemo, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import {
  Notification,
  listenNotifications,
  listenUnreadCount,
  markAsRead as markAsReadService,
  markAllAsRead as markAllAsReadService,
  deleteNotification as deleteNotificationService,
} from '../services/notificationsService';

interface NotificationsContextType {
  notifications: Notification[];
  unreadCount: number;
  notificationsLoading: boolean;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export const NotificationsProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsLoading(false);
      return;
    }

    setNotificationsLoading(true);

    let unsubNotifications: (() => void) | undefined;
    let unsubUnreadCount: (() => void) | undefined;

    try {
      unsubNotifications = listenNotifications(user.uid, (notificationsData) => {
        setNotifications(notificationsData);
        setNotificationsLoading(false);
      });

      unsubUnreadCount = listenUnreadCount(user.uid, (count) => {
        setUnreadCount(count);
      });
    } catch {
      setNotificationsLoading(false);
    }

    return () => {
      setNotificationsLoading(false);
      unsubNotifications?.();
      unsubUnreadCount?.();
    };
  }, [user]);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!user) throw new Error('User not authenticated');
    await markAsReadService(user.uid, notificationId);
  }, [user]);

  const markAllAsRead = useCallback(async () => {
    if (!user) throw new Error('User not authenticated');
    await markAllAsReadService(user.uid);
  }, [user]);

  const deleteNotification = useCallback(async (notificationId: string) => {
    if (!user) throw new Error('User not authenticated');
    await deleteNotificationService(user.uid, notificationId);
  }, [user]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  }), [notifications, unreadCount, notificationsLoading, markAsRead, markAllAsRead, deleteNotification]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationsContext);
  if (context === undefined) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
};
