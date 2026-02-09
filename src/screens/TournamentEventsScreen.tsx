import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament, isUserAdmin } from '../services/tournamentService';
import { listenEvents, deleteEvent, cancelEvent, Event } from '../services/eventService';
import { listenBets, Bet, hasUserPicked, calculateOdds } from '../services/betService';
import { EventCard, SwipeableRow, BetCardCompact } from '../components/BetanoComponents';

const TournamentEventsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [eventBets, setEventBets] = useState<Record<string, Bet[]>>({});
  const [userPicks, setUserPicks] = useState<Record<string, Record<string, boolean>>>({});
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

  // Listen to bets for expanded event
  useEffect(() => {
    if (!expandedEventId || !tournamentId) return;

    const unsubscribe = listenBets(tournamentId, expandedEventId, async (bets) => {
      setEventBets((prev) => ({ ...prev, [expandedEventId]: bets }));

      // Check user picks
      if (user) {
        const picks: Record<string, boolean> = {};
        await Promise.all(
          bets.map(async (bet) => {
            const hasPick = await hasUserPicked(tournamentId, expandedEventId, bet.id, user.uid);
            picks[bet.id] = hasPick;
          })
        );
        setUserPicks((prev) => ({ ...prev, [expandedEventId]: picks }));
      }
    });

    return () => unsubscribe();
  }, [expandedEventId, tournamentId, user]);

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

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  };

  const handleCreateEvent = () => {
    navigation.navigate('CreateEvent', { tournamentId });
  };

  const handleEditEvent = (event: Event) => {
    navigation.navigate('CreateEvent', {
      tournamentId,
      eventId: event.id,
      editMode: true,
    });
  };

  const handleDeleteEvent = (event: Event) => {
    Alert.alert(
      'Eliminar evento',
      `¿Estás seguro que deseas eliminar "${event.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteEvent(tournamentId, event.id);
              Alert.alert('Éxito', 'Evento eliminado');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  const handleCancelEvent = (event: Event) => {
    Alert.alert('Cancelar evento', `¿Deseas cancelar "${event.title}"?`, [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        onPress: async () => {
          try {
            await cancelEvent(tournamentId, event.id);
            Alert.alert('Éxito', 'Evento cancelado');
          } catch (error: any) {
            Alert.alert('Error', error.message || 'No se pudo cancelar');
          }
        },
      },
    ]);
  };

  const handleCreateBet = (eventId: string) => {
    navigation.navigate('CreateBet', { tournamentId, eventId });
  };

  const handleBetOptionPress = (eventId: string, bet: Bet, option: string) => {
    navigation.navigate('BetDetails', {
      tournamentId,
      eventId,
      betId: bet.id,
    });
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />

        <ScrollView style={styles.content}>
          {/* Tournament Header */}
          {tournament && (
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Eventos del Torneo</Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {tournament.name}
              </Text>
            </View>
          )}

          {/* Create Event Button (Admin) */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={handleCreateEvent}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.foreground} />
              <Text style={[styles.createButtonText, { color: colors.foreground }]}>
                Crear Evento
              </Text>
            </TouchableOpacity>
          )}

          {/* Events List */}
          {events.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin eventos</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isAdmin ? 'Crea el primer evento del torneo' : 'No hay eventos disponibles aún'}
              </Text>
            </View>
          ) : (
            <View style={styles.eventsList}>
              {events.map((event) => {
                const isExpanded = expandedEventId === event.id;
                const bets = eventBets[event.id] || [];
                const picks = userPicks[event.id] || {};

                return (
                  <View key={event.id}>
                    {/* Event Card with Swipe Actions */}
                    <SwipeableRow
                      enabled={isAdmin}
                      actions={[
                        {
                          label: 'Editar',
                          icon: 'create-outline',
                          color: colors.primary,
                          onPress: () => handleEditEvent(event),
                        },
                        {
                          label: 'Eliminar',
                          icon: 'trash-outline',
                          color: colors.destructive,
                          onPress: () => handleDeleteEvent(event),
                        },
                      ]}
                    >
                      <EventCard
                        event={event}
                        theme={theme}
                        onPress={() => toggleEventExpansion(event.id)}
                        expanded={isExpanded}
                      />
                    </SwipeableRow>

                    {/* Expanded Bets Section */}
                    {isExpanded && (
                      <View style={[styles.betsSection, { backgroundColor: colors.secondary }]}>
                        {/* Create Bet Button */}
                        {isAdmin && (
                          <TouchableOpacity
                            style={[styles.createBetButton, { borderColor: colors.border }]}
                            onPress={() => handleCreateBet(event.id)}
                          >
                            <Ionicons name="add" size={18} color={colors.primary} />
                            <Text style={[styles.createBetText, { color: colors.primary }]}>
                              Crear Apuesta
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Bets List */}
                        {bets.length === 0 ? (
                          <Text style={[styles.noBetsText, { color: colors.mutedForeground }]}>
                            {isAdmin ? 'Crea la primera apuesta' : 'No hay apuestas disponibles'}
                          </Text>
                        ) : (
                          bets.map((bet) => (
                            <View key={bet.id} style={styles.betCardWrapper}>
                              <BetCardCompact
                                bet={bet}
                                theme={theme}
                                onOptionPress={(option) => handleBetOptionPress(event.id, bet, option)}
                                userSelection={picks[bet.id] ? '✓' : null}
                                showOdds={true}
                              />
                              {isAdmin && (
                                <TouchableOpacity
                                  style={[styles.editBetButton, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                                  onPress={() => navigation.navigate('CreateBet', { tournamentId, eventId: event.id, betId: bet.id, editMode: true })}
                                >
                                  <Ionicons name="create-outline" size={16} color={colors.primary} />
                                  <Text style={[styles.editBetText, { color: colors.primary }]}>Editar Apuesta</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          ))
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 250,
  },
  eventsList: {
    gap: 0,
  },
  betsSection: {
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: -Spacing.sm,
  },
  createBetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginBottom: Spacing.md,
    gap: 6,
  },
  createBetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noBetsText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },  betCardWrapper: {
    marginBottom: Spacing.sm,
  },
  editBetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginTop: Spacing.xs,
  },
  editBetText: {
    fontSize: 12,
    fontWeight: '600',
  },});

export default TournamentEventsScreen;
