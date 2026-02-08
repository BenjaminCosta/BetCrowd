import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament, isUserAdmin } from '../services/tournamentService';
import { listenEvents, Event } from '../services/eventService';

const TournamentEventsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId && user) {
      loadTournament();
      checkAdminStatus();
    }
  }, [tournamentId, user]);

  useEffect(() => {
    if (!tournamentId) return;

    const unsubscribe = listenEvents(tournamentId, (updatedEvents) => {
      setEvents(updatedEvents);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [tournamentId]);

  const loadTournament = async () => {
    try {
      const tournamentData = await getTournament(tournamentId);
      setTournament(tournamentData);
    } catch (error) {
      console.error('Error loading tournament:', error);
    }
  };

  const checkAdminStatus = async () => {
    if (!user) return;
    try {
      const admin = await isUserAdmin(tournamentId, user.uid);
      setIsAdmin(admin);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      upcoming: { label: 'PRÓXIMO', color: '#FF8C00' },
      live: { label: 'EN VIVO', color: '#DC2E4B' },
      finished: { label: 'FINALIZADO', color: '#6B7280' },
      cancelled: { label: 'CANCELADO', color: '#6B7280' },
    };
    return statusMap[status] || { label: status.toUpperCase(), color: '#6B7280' };
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando eventos...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content}>
        {tournament && (
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Eventos del Torneo
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {tournament.name}
            </Text>
          </View>
        )}

        {/* Create Event Button - Only for admins */}
        {isAdmin && (
          <TouchableOpacity
            onPress={() => navigation.navigate('CreateEvent', { tournamentId })}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.createButton}
            >
              <Ionicons name="add-circle" size={20} color="#FFFFFF" />
              <Text style={styles.createButtonText}>
                Crear Evento
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Events List */}
        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Todavía no hay eventos
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {isAdmin 
                ? 'Crea el primer evento para que los participantes puedan hacer predicciones' 
                : 'El administrador aún no ha creado eventos para este torneo'}
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => {
              const badge = getStatusBadge(event.status);
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, { backgroundColor: colors.card }]}
                  onPress={() => navigation.navigate('EventDetails', { tournamentId, eventId: event.id })}
                >
                  <View style={styles.eventHeader}>
                    <View style={styles.eventInfo}>
                      <Text style={[styles.eventTitle, { color: colors.foreground }]}>
                        {event.title}
                      </Text>
                      {event.homeTeam && event.awayTeam && (
                        <Text style={[styles.eventTeams, { color: colors.mutedForeground }]}>
                          {event.homeTeam} vs {event.awayTeam}
                        </Text>
                      )}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.color + '20' }]}>
                      <Text style={[styles.statusBadgeText, { color: badge.color }]}>
                        {badge.label}
                      </Text>
                    </View>
                  </View>
                  
                  {event.startsAt && (
                    <View style={styles.eventFooter}>
                      <Ionicons name="time-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
                        {event.startsAt.toDate().toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginBottom: 32,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  eventsList: {
    gap: 12,
  },
  eventCard: {
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventTeams: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eventTime: {
    fontSize: 12,
  },
});

export default TournamentEventsScreen;
