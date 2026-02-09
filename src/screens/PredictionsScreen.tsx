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
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getUserPicksForTournament, type Bet } from '../services/betService';
import { getEvent, type Event } from '../services/eventService';
import { listMyTournaments } from '../services/tournamentService';

interface PickWithDetails {
  tournamentId: string;
  eventId: string;
  betId: string;
  pick: any;
  bet: Bet;
  event?: Event;
}

const PredictionsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  
  const [picks, setPicks] = useState<PickWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPicks();
  }, [user]);

  const loadPicks = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Load all user's tournaments
      const tournaments = await listMyTournaments();
      
      // Load picks from all tournaments
      const allPicks: PickWithDetails[] = [];
      
      for (const tournament of tournaments) {
        const tournamentPicks = await getUserPicksForTournament(user.uid, tournament.id);
        
        // Load event details for each pick
        const picksWithEvents = await Promise.all(
          tournamentPicks.map(async (pickData) => {
            try {
              const event = await getEvent(pickData.tournamentId, pickData.eventId);
              return {
                ...pickData,
                event,
              };
            } catch (error) {
              console.error('Error loading event:', error);
              return pickData;
            }
          })
        );
        
        allPicks.push(...picksWithEvents);
      }

      setPicks(allPicks);
    } catch (error) {
      console.error('Error loading picks:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return colors.accent;
      case 'locked':
        return '#F59E0B';
      case 'settled':
        return colors.success;
      case 'cancelled':
        return colors.mutedForeground;
      default:
        return colors.mutedForeground;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'open':
        return 'Pendiente';
      case 'locked':
        return 'Cerrada';
      case 'settled':
        return 'Resuelta';
      case 'cancelled':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const formatSelection = (selection: any, bet: Bet) => {
    if (typeof selection === 'object') {
      // Score type
      return `${selection.home || 0} - ${selection.away || 0}`;
    }
    return String(selection);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando apuestas...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Mis Apuestas
          </Text>
        </View>

        {picks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cash-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Sin apuestas activas
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Participa en eventos de tus torneos para ver tus apuestas aquí
            </Text>
            <TouchableOpacity
              style={[styles.exploreButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('Eventos')}
            >
              <Text style={styles.exploreButtonText}>Explorar Eventos</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.predictionsList}>
            {picks.map((pickData, index) => {
              const { bet, pick, event } = pickData;
              const statusColor = getStatusColor(bet.status);
              
              return (
                <TouchableOpacity
                  key={`${pickData.betId}-${index}`}
                  style={[styles.predictionCard, { backgroundColor: colors.card }]}
                  onPress={() =>
                    navigation.navigate('BetDetails', {
                      tournamentId: pickData.tournamentId,
                      eventId: pickData.eventId,
                      betId: pickData.betId,
                    })
                  }
                  activeOpacity={0.7}
                >
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.eventInfo}>
                        {event && (
                          <Text style={[styles.eventTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                            {event.title}
                          </Text>
                        )}
                        {event?.startsAt && (
                          <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
                            {formatDate(event.startsAt)}
                          </Text>
                        )}
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
                        <Text style={[styles.statusText, { color: statusColor }]}>
                          {getStatusText(bet.status)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.betTitle, { color: colors.foreground }]} numberOfLines={2}>
                      {bet.title}
                    </Text>
                  </View>

                  <View style={styles.predictionInfo}>
                    <View style={styles.predictionRow}>
                      <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                        Tu predicción:
                      </Text>
                      <Text style={[styles.predictionValue, { color: colors.primary }]}>
                        {formatSelection(pick.selection, bet)}
                      </Text>
                    </View>

                    {bet.stakeAmount > 0 && (
                      <View style={styles.predictionRow}>
                        <Text style={[styles.predictionLabel, { color: colors.mutedForeground }]}>
                          Apostado:
                        </Text>
                        <Text style={[styles.predictionValue, { color: colors.foreground }]}>
                          ${pick.stakeAmount.toLocaleString('es-AR')}
                        </Text>
                      </View>
                    )}

                    {bet.status === 'settled' && bet.result && (
                      <View style={[styles.resultBanner, { backgroundColor: colors.success + '15' }]}>
                        <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                        <Text style={[styles.resultText, { color: colors.success }]}>
                          Resultado: {formatSelection(bet.result, bet)}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    <View style={styles.potInfo}>
                      <Ionicons name="cash-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.potText, { color: colors.mutedForeground }]}>
                        Pozo: ${(bet.totalPot || 0).toLocaleString('es-AR')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                  </View>
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
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  exploreButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  exploreButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  predictionsList: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  predictionCard: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  eventInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  eventTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  eventDate: {
    fontSize: 11,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  betTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  predictionInfo: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 13,
  },
  predictionValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xs,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    paddingTop: 0,
  },
  potInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  potText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default PredictionsScreen;
