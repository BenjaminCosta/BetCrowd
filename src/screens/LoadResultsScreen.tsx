import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Badge } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament } from '../services/tournamentService';
import { listenEvents, Event } from '../services/eventService';
import { listenBets, settleBet, Bet } from '../services/betService';

const LoadResultsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [eventBets, setEventBets] = useState<Record<string, Bet[]>>({});
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      loadTournament();
      const unsubscribe = listenEvents(tournamentId, (updatedEvents) => {
        // Only show finished events
        const finishedEvents = updatedEvents.filter(e => e.status === 'finished');
        setEvents(finishedEvents);
        setLoading(false);
      });
      return () => unsubscribe();
    }
  }, [tournamentId]);

  useEffect(() => {
    if (!expandedEventId || !tournamentId) return;

    const unsubscribe = listenBets(tournamentId, expandedEventId, (bets) => {
      // Only show locked or open bets (not yet settled)
      const unsettledBets = bets.filter(b => b.status === 'locked' || b.status === 'open');
      setEventBets((prev) => ({ ...prev, [expandedEventId]: unsettledBets }));
    });

    return () => unsubscribe();
  }, [expandedEventId, tournamentId]);

  const loadTournament = async () => {
    try {
      const tournamentData = await getTournament(tournamentId);
      setTournament(tournamentData);
    } catch (error) {
      console.error('Error loading tournament:', error);
    }
  };

  const toggleEventExpansion = (eventId: string) => {
    setExpandedEventId((prev) => (prev === eventId ? null : eventId));
  };

  const handleSettleBet = (eventId: string, bet: Bet) => {
    Alert.alert(
      'Resolver Apuesta',
      `¿Cuál es el resultado ganador de "${bet.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        ...bet.options.map(option => ({
          text: option,
          onPress: async () => {
            try {
              await settleBet(tournamentId, eventId, bet.id, { winner: option });
              Alert.alert('Éxito', `Apuesta resuelta: ${option}`);
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo resolver la apuesta');
            }
          },
        })),
      ]
    );
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Sin fecha';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      <ScrollView style={styles.content}>
        {tournament && (
          <View style={styles.header}>
            <Ionicons name="trophy" size={32} color={colors.primary} />
            <View style={styles.headerText}>
              <Text style={[styles.title, { color: colors.foreground }]}>
                Cargar Resultados
              </Text>
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {tournament.name}
              </Text>
            </View>
          </View>
        )}

        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="checkmark-done-circle-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Sin eventos finalizados
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Los eventos finalizados aparecerán aquí para cargar sus resultados
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => {
              const isExpanded = expandedEventId === event.id;
              const bets = eventBets[event.id] || [];

              return (
                <Card key={event.id} style={styles.eventCard}>
                  <TouchableOpacity onPress={() => toggleEventExpansion(event.id)}>
                    <View style={styles.eventHeader}>
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventTitle, { color: colors.foreground }]}>
                          {event.title}
                        </Text>
                        {(event.homeTeam || event.awayTeam) && (
                          <Text style={[styles.eventTeams, { color: colors.mutedForeground }]}>
                            {event.homeTeam || 'TBD'} vs {event.awayTeam || 'TBD'}
                          </Text>
                        )}
                        {event.startsAt && (
                          <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                            {formatDate(event.startsAt)}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={24}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </TouchableOpacity>

                  {isExpanded && (
                    <View style={styles.betsSection}>
                      {bets.length === 0 ? (
                        <Text style={[styles.noBetsText, { color: colors.mutedForeground }]}>
                          Todas las apuestas están resueltas
                        </Text>
                      ) : (
                        <>
                          <View style={[styles.betsSectionHeader, { borderBottomColor: colors.border }]}>
                            <Text style={[styles.betsSectionTitle, { color: colors.foreground }]}>
                              Apuestas por resolver
                            </Text>
                            <Badge variant="warning">{bets.length}</Badge>
                          </View>
                          {bets.map((bet) => (
                            <View key={bet.id} style={[styles.betCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                              <View style={styles.betHeader}>
                                <Text style={[styles.betTitle, { color: colors.foreground }]}>
                                  {bet.title}
                                </Text>
                                <Badge variant={bet.status === 'locked' ? 'warning' : 'success'}>
                                  {bet.status === 'locked' ? 'CERRADA' : 'ABIERTA'}
                                </Badge>
                              </View>
                              {bet.description && (
                                <Text style={[styles.betDescription, { color: colors.mutedForeground }]}>
                                  {bet.description}
                                </Text>
                              )}
                              <View style={styles.betMeta}>
                                <Text style={[styles.betMetaText, { color: colors.mutedForeground }]}>
                                  <Ionicons name="cash-outline" size={14} /> ${(bet.totalPot || 0).toLocaleString()}
                                </Text>
                                <Text style={[styles.betMetaText, { color: colors.mutedForeground }]}>
                                  {bet.totalPicks || 0} apuestas
                                </Text>
                              </View>
                              <TouchableOpacity
                                style={[styles.settleButton, { backgroundColor: colors.primary }]}
                                onPress={() => handleSettleBet(event.id, bet)}
                              >
                                <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                <Text style={styles.settleButtonText}>Resolver Apuesta</Text>
                              </TouchableOpacity>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </Card>
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
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  eventsList: {
    gap: Spacing.md,
  },
  eventCard: {
    marginBottom: Spacing.md,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventTeams: {
    fontSize: 13,
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 12,
  },
  betsSection: {
    marginTop: Spacing.lg,
  },
  betsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  betsSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  noBetsText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: Spacing.md,
  },
  betCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  betTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  betDescription: {
    fontSize: 13,
    marginBottom: Spacing.xs,
  },
  betMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  betMetaText: {
    fontSize: 12,
  },
  settleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  settleButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default LoadResultsScreen;
