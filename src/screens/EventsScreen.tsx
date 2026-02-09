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
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { listMyTournaments, Tournament, isUserAdmin } from '../services/tournamentService';
import { SwipeableRow } from '../components/BetanoComponents';

const EventsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminStatuses, setAdminStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadTournaments();
  }, [user]);

  const loadTournaments = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const myTournaments = await listMyTournaments();
      const filtered = myTournaments.filter(t => t.status !== 'deleted');
      setTournaments(filtered);
      
      // Check admin status for each tournament
      const statuses: Record<string, boolean> = {};
      await Promise.all(
        filtered.map(async (tournament) => {
          const admin = await isUserAdmin(tournament.id, user.uid);
          statuses[tournament.id] = admin;
        })
      );
      setAdminStatuses(statuses);
    } catch (error) {
      console.error('Error loading tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditTournament = (tournament: Tournament) => {
    navigation.navigate('TournamentSettings', { tournamentId: tournament.id });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <ScrollView style={styles.content}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Torneos y Eventos
          </Text>
          
          {tournaments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Sin torneos
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Crea un torneo o únete a uno para ver eventos
              </Text>
            </View>
          ) : (
            <View style={styles.tournamentsList}>
              {tournaments.map((tournament) => {
                const isAdmin = adminStatuses[tournament.id] || false;
                return (
                  <SwipeableRow
                    key={tournament.id}
                    enabled={isAdmin}
                    actions={[
                      {
                        label: 'Editar',
                        icon: 'create-outline',
                        color: colors.primary,
                        onPress: () => handleEditTournament(tournament),
                      },
                    ]}
                  >
                    <TouchableOpacity
                      style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                      onPress={() => navigation.navigate('TournamentEvents', { tournamentId: tournament.id })}
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
                      
                      <View style={styles.tournamentHeader}>
                        <View style={styles.tournamentInfo}>
                          <Text style={[styles.tournamentName, { color: colors.foreground }]} numberOfLines={1}>
                            {tournament.name}
                          </Text>
                          {tournament.description && (
                            <Text style={[styles.tournamentDesc, { color: colors.mutedForeground }]} numberOfLines={1}>
                              {tournament.description}
                            </Text>
                          )}
                        </View>
                      </View>
                      
                      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                      
                      <View style={styles.tournamentFooter}>
                        <View style={styles.tournamentMeta}>
                          <View style={styles.metaItem}>
                            <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                              <Ionicons name="people" size={14} color={colors.primary} />
                            </View>
                            <Text style={[styles.metaText, { color: colors.foreground }]}>
                              {tournament.participantsEstimated || 0} participantes
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                              <Ionicons name="key" size={14} color={colors.primary} />
                            </View>
                            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                              {tournament.inviteCode}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.viewButton, { backgroundColor: colors.primary }]}>
                          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                        </View>
                      </View>
                    </TouchableOpacity>
                  </SwipeableRow>
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
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  tournamentsList: {
    gap: Spacing.md,
  },
  tournamentCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
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
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  tournamentDesc: {
    fontSize: 13,
  },
  prizeContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  prizeValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  prizeLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    marginBottom: Spacing.md,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentMeta: {
    flex: 1,
    gap: Spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EventsScreen;
