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
                      style={[styles.tournamentCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => navigation.navigate('TournamentEvents', { tournamentId: tournament.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.tournamentHeader}>
                        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                          <Ionicons name="trophy" size={20} color={colors.primary} />
                        </View>
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
                        <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
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
    borderWidth: 1,
  },
  tournamentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tournamentInfo: {
    flex: 1,
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  tournamentDesc: {
    fontSize: 13,
  },
});

export default EventsScreen;
