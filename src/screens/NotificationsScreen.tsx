import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';

const notifications = [
  {
    id: 1,
    type: 'tournament',
    title: 'Nuevo torneo disponible',
    message: 'Final Champions League ha comenzado',
    time: 'Hace 5 min',
    read: false,
  },
  {
    id: 2,
    type: 'win',
    title: '¡Ganaste!',
    message: 'Tu predicción fue correcta. +150 monedas',
    time: 'Hace 1 hora',
    read: false,
  },
  {
    id: 3,
    type: 'reminder',
    title: 'Recordatorio',
    message: 'El torneo NBA All-Stars comienza en 1 hora',
    time: 'Hace 2 horas',
    read: true,
  },
];

const NotificationsScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const getIcon = (type: string) => {
    switch (type) {
      case 'tournament':
        return 'trophy';
      case 'win':
        return 'checkmark-circle';
      case 'reminder':
        return 'time';
      default:
        return 'notifications';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      <ScrollView style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Notificaciones
        </Text>

        <View style={styles.notificationsList}>
          {notifications.map((notif) => (
            <TouchableOpacity
              key={notif.id}
              style={[
                styles.notificationCard,
                {
                  backgroundColor: notif.read ? colors.card : colors.secondary,
                },
              ]}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Ionicons name={getIcon(notif.type) as any} size={24} color={colors.primary} />
              </View>
              
              <View style={styles.notificationContent}>
                <Text style={[styles.notificationTitle, { color: colors.foreground }]}>
                  {notif.title}
                </Text>
                <Text style={[styles.notificationMessage, { color: colors.mutedForeground }]}>
                  {notif.message}
                </Text>
                <Text style={[styles.notificationTime, { color: colors.mutedForeground }]}>
                  {notif.time}
                </Text>
              </View>

              {!notif.read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 20,
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 16,
    gap: 12,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  notificationMessage: {
    fontSize: 14,
  },
  notificationTime: {
    fontSize: 12,
    marginTop: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
});

export default NotificationsScreen;
