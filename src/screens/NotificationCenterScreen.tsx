import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, EmptyState } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useSocial } from '../context/SocialContext';
import { Notification } from '../services/notificationsService';

const NotificationCenterScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const {
    notifications,
    notificationsLoading,
    markAsRead,
    markAllAsRead,
  } = useSocial();

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'friend_request':
        return 'person-add';
      case 'friend_accepted':
        return 'checkmark-circle';
      case 'tournament_invite':
        return 'trophy';
      default:
        return 'notifications';
    }
  };

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read if not already read
    if (!notification.readAt) {
      try {
        await markAsRead(notification.id);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on type
    switch (notification.type) {
      case 'friend_request':
        navigation.navigate('Friends');
        break;
      case 'friend_accepted':
        navigation.navigate('Friends');
        break;
      case 'tournament_invite':
        if (notification.tournamentId) {
          navigation.navigate('TournamentDetails', { tournamentId: notification.tournamentId });
        }
        break;
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setActionLoading('mark-all');
      await markAllAsRead();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo marcar como leídas');
    } finally {
      setActionLoading(null);
    }
  };

  const renderNotification = (notification: Notification) => {
    const isUnread = !notification.readAt;

    return (
      <TouchableOpacity
        key={notification.id}
        onPress={() => handleNotificationPress(notification)}
        activeOpacity={0.7}
      >
        <Card
          style={[
            styles.notificationCard,
            isUnread && { backgroundColor: colors.muted },
          ]}
        >
          <View style={styles.notificationRow}>
            {/* Icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isUnread ? colors.primary : colors.secondary,
                },
              ]}
            >
              <Ionicons
                name={getNotificationIcon(notification.type) as any}
                size={20}
                color={isUnread ? '#FFF' : colors.foreground}
              />
            </View>

            {/* Content */}
            <View style={styles.notificationContent}>
              <Text
                style={[
                  styles.notificationTitle,
                  { color: colors.foreground },
                  isUnread && styles.unreadText,
                ]}
              >
                {notification.title}
              </Text>
              <Text
                style={[
                  styles.notificationBody,
                  { color: colors.mutedForeground },
                ]}
                numberOfLines={2}
              >
                {notification.body}
              </Text>
              <Text style={[styles.notificationTime, { color: colors.mutedForeground }]}>
                {formatDate(notification.createdAt)}
              </Text>
            </View>

            {/* Unread indicator */}
            {isUnread && (
              <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const unreadCount = notifications.filter(n => !n.readAt).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.title, { color: colors.foreground }]}>Notificaciones</Text>
          {unreadCount > 0 && (
            <View style={[styles.headerBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            disabled={actionLoading === 'mark-all'}
            style={styles.markAllButton}
          >
            {actionLoading === 'mark-all' ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.markAllText, { color: colors.primary }]}>
                Marcar leídas
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {notificationsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : notifications.length === 0 ? (
          <EmptyState
            iconName="notifications-outline"
            title="No hay notificaciones"
            message="Te avisaremos cuando tengas algo nuevo"
          />
        ) : (
          notifications.map(notification => renderNotification(notification))
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  headerBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  headerBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  notificationCard: {
    padding: Spacing.sm,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  unreadText: {
    fontWeight: '700',
  },
  notificationBody: {
    fontSize: 14,
    lineHeight: 18,
  },
  notificationTime: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 4,
  },
});

export default NotificationCenterScreen;
