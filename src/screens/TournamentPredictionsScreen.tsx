import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { LoadingBar } from '../components/LoadingBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament, listMyTournaments } from '../services/tournamentService';
import { getMyPick, getBet, listBets, type Bet } from '../services/betService';
import { listEvents } from '../services/eventService';

const TournamentPredictionsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId: routeTournamentId } = route?.params || {};

  const [tournaments, setTournaments] = useState<any[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(routeTournamentId || null);
  const [tournament, setTournament] = useState<any>(null);
  const [openPicks, setOpenPicks] = useState<any[]>([]);
  const [settledPicks, setSettledPicks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'open' | 'settled'>('open');

  useEffect(() => {
    loadTournaments();
  }, [user]);

  useEffect(() => {
    if (selectedTournamentId && user) {
      // Si ya hay datos, solo mostrar loading bar (cambio de filtro)
      if (openPicks.length > 0 || settledPicks.length > 0) {
        setFilterLoading(true);
      } else {
        // Primera carga, mostrar loading completo
        setLoading(true);
      }
      loadData();
    }
  }, [selectedTournamentId, user]);

  // Refresh when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (selectedTournamentId && user) {
        loadData();
      }
    }, [selectedTournamentId, user])
  );

  const loadTournaments = async () => {
    if (!user) return;
    try {
      const myTournaments = await listMyTournaments();
      setTournaments(myTournaments.filter(t => t.status !== 'deleted'));
      
      // Auto-select first tournament if none selected
      if (!selectedTournamentId && myTournaments.length > 0) {
        setSelectedTournamentId(myTournaments[0].id);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const loadData = async () => {
    if (!user || !selectedTournamentId) return;
    
    // Only show loading on first load
    if (openPicks.length === 0 && settledPicks.length === 0) {
      setLoading(true);
    }
    
    try {
      // Load tournament
      const tournamentData = await getTournament(selectedTournamentId);
      setTournament(tournamentData);
      
      // Load picks directly from events/bets
      const allOpenPicks: any[] = [];
      const allSettledPicks: any[] = [];
      
      try {
        const events = await listEvents(selectedTournamentId);
        
        for (const event of events) {
          try {
            const bets = await listBets(selectedTournamentId, event.id);
            
            for (const bet of bets) {
              try {
                const pick = await getMyPick(selectedTournamentId, event.id, bet.id, user.uid);
                
                if (pick) {
                  const pickData = {
                    tournamentId: selectedTournamentId,
                    eventId: event.id,
                    betId: bet.id,
                    pick,
                    bet,
                    event,
                  };
                  
                  // Dividir en abiertas y resueltas
                  if (bet.status === 'settled' || bet.status === 'cancelled') {
                    allSettledPicks.push(pickData);
                  } else {
                    allOpenPicks.push(pickData);
                  }
                }
              } catch (pickError) {
                // Pick doesn't exist, skip
                continue;
              }
            }
          } catch (betError) {
            continue;
          }
        }
      } catch (eventError) {
        // Silent fail
      }
      
      setOpenPicks(allOpenPicks);
      setSettledPicks(allSettledPicks);
    } catch (error) {
      // Silent fail
    } finally {
      setLoading(false);
      setFilterLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTournaments(), loadData()]);
    setRefreshing(false);
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

  const currentPicks = activeTab === 'open' ? openPicks : settledPicks;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      <LoadingBar isLoading={filterLoading} />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Mis Apuestas
          </Text>
        </View>

        {/* Tournament Selector */}
        {tournaments.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tournamentSelector}>
            {tournaments.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={[
                  styles.tournamentChip,
                  { 
                    backgroundColor: selectedTournamentId === t.id ? colors.primary : colors.card,
                    borderColor: colors.border,
                  }
                ]}
                onPress={() => setSelectedTournamentId(t.id)}
              >
                <Text style={[
                  styles.tournamentChipText,
                  { color: selectedTournamentId === t.id ? '#FFFFFF' : colors.foreground }
                ]}>
                  {t.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {tournament && (
          <View style={styles.tournamentInfo}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              {tournament.name}
            </Text>
          </View>
        )}

        {/* Tabs: Abiertas / Resueltas */}
        <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'open' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('open')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'open' ? colors.primary : colors.mutedForeground }
            ]}>
              Abiertas ({openPicks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'settled' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('settled')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'settled' ? colors.primary : colors.mutedForeground }
            ]}>
              Resueltas ({settledPicks.length})
            </Text>
          </TouchableOpacity>
        </View>

        {currentPicks.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons 
              name={activeTab === 'open' ? 'hourglass-outline' : 'checkmark-done-outline'} 
              size={64} 
              color={colors.mutedForeground} 
            />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              {activeTab === 'open' ? 'Sin apuestas abiertas' : 'Sin apuestas resueltas'}
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {activeTab === 'open' 
                ? 'Participa en eventos para ver tus apuestas aquí'
                : 'Las apuestas finalizadas aparecerán aquí'}
            </Text>
          </View>
        ) : (
          currentPicks.map((pickData: any, index: number) => {
            const { bet, pick, event } = pickData;
            
            return (
              <TouchableOpacity
                key={`${pickData.betId}-${index}`}
                style={[styles.pickCard, { backgroundColor: colors.card }]}
                onPress={() =>
                  navigation.navigate('BetDetails', {
                    tournamentId: pickData.tournamentId,
                    eventId: pickData.eventId,
                    betId: pickData.betId,
                  })
                }
                activeOpacity={0.7}
              >
                <View style={styles.cardGradientOverlay}>
                  <LinearGradient
                    colors={[colors.primary + '10', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gradientBackground}
                  />
                </View>

                {event && (
                  <View style={styles.eventHeader}>
                    <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                    <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {event.title}
                    </Text>
                  </View>
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
                  <Text style={[styles.amount, { color: colors.foreground }]}>
                    ${pick.stakeAmount || 0}
                  </Text>
                  <View style={[styles.statusBadge, { 
                    backgroundColor: bet.status === 'open' ? '#10B981':  
                                   bet.status === 'settled' ? '#10B981': 
                                   bet.status === 'cancelled' ? colors.destructive:
                                   colors.mutedForeground + '20' 
                  }]}>
                    <Text style={[styles.statusText, { 
                      color:colors.foreground, 
                    }]}>
                      {bet.status === 'open' ? 'ABIERTA' : 
                       bet.status === 'locked' ? 'CERRADA' : 
                       bet.status === 'settled' ? 'RESUELTA' : 'CANCELADA'}
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
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
  },
  tournamentSelector: {
    marginBottom: Spacing.lg,
  },
  tournamentChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginRight: Spacing.sm,
    borderWidth: 1,
  },
  tournamentChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  tournamentInfo: {
    marginBottom: Spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
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
  pickCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    flex: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  betTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickInfo: {
    gap: 4,
    marginTop: Spacing.xs,
  },
  pickLabel: {
    fontSize: 12,
  },
  pickValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default TournamentPredictionsScreen;
