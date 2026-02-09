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
import { getTournament } from '../services/tournamentService';
import { getUserPicksForTournament } from '../services/betService';
import { getEvent } from '../services/eventService';

const TournamentPredictionsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<any>(null);
  const [picks, setPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId && user) {
      loadData();
    }
  }, [tournamentId, user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load tournament
      const tournamentData = await getTournament(tournamentId);
      setTournament(tournamentData);
      
      // Load user picks
      if (user) {
        const tournamentPicks = await getUserPicksForTournament(user.uid, tournamentId);
        
        // Load event details for each pick
        const picksWithEvents = await Promise.all(
          tournamentPicks.map(async (pickData: any) => {
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
        
        setPicks(picksWithEvents);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando predicciones...
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
              Predicciones
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {tournament.name}
            </Text>
          </View>
        )}

        {picks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="stats-chart-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Sin apuestas en este torneo
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              Participa en eventos para ver tus apuestas aquí
            </Text>
          </View>
        ) : (
          picks.map((pickData: any, index: number) => {
            const { bet, pick, event } = pickData;
            
            return (
              <TouchableOpacity
                key={`${pickData.betId}-${index}`}
                style={[styles.pickCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() =>
                  navigation.navigate('BetDetails', {
                    tournamentId: pickData.tournamentId,
                    eventId: pickData.eventId,
                    betId: pickData.betId,
                  })
                }
                activeOpacity={0.7}
              >
                {event && (
                  <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                )}
                
                <Text style={[styles.betTitle, { color: colors.mutedForeground }]} numberOfLines={2}>
                  {bet.title}
                </Text>
                
                <View style={styles.pickInfo}>
                  <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>
                    Tu predicción:
                  </Text>
                  <Text style={[styles.pickValue, { color: colors.primary }]}>
                    {typeof pick.selection === 'object' ? `${pick.selection.home || 0} - ${pick.selection.away || 0}` : pick.selection}
                  </Text>
                </View>
                
                <View style={styles.footer}>
                  <Text style={[styles.amount, { color: colors.mutedForeground }]}>
                    ${pick.amount}
                  </Text>
                  <View style={[styles.statusBadge, { backgroundColor: bet.status === 'open' ? colors.primary + '20' : colors.mutedForeground + '20' }]}>
                    <Text style={[styles.statusText, { color: bet.status === 'open' ? colors.primary : colors.mutedForeground }]}>
                      {bet.status === 'open' ? 'ABIERTA' : bet.status === 'locked' ? 'CERRADA' : bet.status === 'settled' ? 'RESUELTA' : 'CANCELADA'}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
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
  pickCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  betTitle: {
    fontSize: 13,
  },
  pickInfo: {
    gap: 4,
  },
  pickLabel: {
    fontSize: 12,
  },
  pickValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  amount: {
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default TournamentPredictionsScreen;
