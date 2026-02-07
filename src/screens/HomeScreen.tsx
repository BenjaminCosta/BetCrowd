import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { LoadingBar } from '../components/LoadingBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getUserProfile } from '../services/userService';
import { listMyTournaments, Tournament } from '../services/tournamentService';

const stats = [
  { label: 'Victorias', value: '12', icon: 'trophy' },
  { label: 'Efectividad', value: '68%', icon: 'trending-up' },
  { label: 'Ranking', value: '#42', icon: 'star' },
];

const HomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingTournaments, setLoadingTournaments] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadUserName();
  }, [user]);

  // Refresh tournaments when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      loadTournaments();
    }, [user])
  );

  const loadUserName = async () => {
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        const name = profile.fullName || profile.displayName || user.email?.split('@')[0] || 'Usuario';
        // Get first name only
        const firstName = name.split(' ')[0];
        setUserName(firstName);
      } else {
        const name = user.displayName || user.email?.split('@')[0] || 'Usuario';
        const firstName = name.split(' ')[0];
        setUserName(firstName);
      }
    } catch (error) {
      console.error('Error loading user name:', error);
      setUserName('Usuario');
    }
  };

  const loadTournaments = async () => {
    if (!user) return;
    try {
      setLoadingTournaments(true);
      const myTournaments = await listMyTournaments();
      setTournaments(myTournaments);
    } catch (error) {
      console.error('Error loading tournaments:', error);
      // Show empty state on error
      setTournaments([]);
    } finally {
      setLoadingTournaments(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar />
      <LoadingBar isLoading={isLoading} />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
                Bienvenido de vuelta
              </Text>
              <Text style={[styles.userName, { color: colors.foreground }]}>
                {userName || 'Usuario'}
              </Text>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={[styles.statCard, { backgroundColor: colors.secondary }]}
              >
                <Ionicons
                  name={stat.icon as any}
                  size={20}
                  color="#FF8C00"
                  style={styles.statIcon}
                />
                <Text style={[styles.statValue, { color: colors.foreground }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Active Tournaments */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
              Torneos Activos
            </Text>
            <TouchableOpacity style={styles.viewAll}>
              <Text style={[styles.viewAllText, { color: colors.primary }]}>
                Ver Todos
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Tournaments List */}
          {loadingTournaments ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                Cargando torneos...
              </Text>
            </View>
          ) : tournaments.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="trophy-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Sin torneos
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                Crea tu primer torneo o únete usando un código de invitación
              </Text>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('CreateTournament')}
              >
                <Text style={styles.createButtonText}>Crear Torneo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tournamentsList}>
              {tournaments.map((tournament) => (
                <TouchableOpacity
                  key={tournament.id}
                  style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                  onPress={() => navigation.navigate('TournamentDetails', { tournamentId: tournament.id })}
                >
                  <View style={styles.tournamentHeader}>
                    <View style={styles.tournamentInfo}>
                      <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                        {tournament.name}
                      </Text>
                      <Text style={[styles.tournamentFormat, { color: colors.mutedForeground }]}>
                        {tournament.format === 'bracket' ? 'Eliminación Directa' : 'Puntos'}
                      </Text>
                    </View>
                    <View style={styles.prizeContainer}>
                      <Text style={styles.prizeValue}>${tournament.contribution}</Text>
                      <Text style={[styles.prizeLabel, { color: colors.mutedForeground }]}>
                        Aporte
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.tournamentFooter}>
                    <View style={styles.tournamentMeta}>
                      <View style={styles.metaItem}>
                        <Ionicons name="people" size={16} color={colors.mutedForeground} />
                        <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                          0 / {tournament.participantsEstimated}
                        </Text>
                      </View>
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        Código: {tournament.inviteCode}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.actionButton, { backgroundColor: colors.primary }]}
                      onPress={() => navigation.navigate('TournamentDetails', { tournamentId: tournament.id })}
                    >
                      <Text style={styles.actionButtonText}>Ver</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  welcomeText: {
    fontSize: 14,
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInitials: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  statIcon: {
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tournamentsList: {
    gap: 12,
  },
  tournamentCard: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  tournamentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tournamentInfo: {
    flex: 1,
    gap: 8,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 46, 75, 0.2)',
    gap: 4,
  },
  liveBadgeText: {
    color: '#DC2E4B',
    fontSize: 10,
    fontWeight: '700',
  },
  upcomingBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 140, 0, 0.2)',
  },
  upcomingBadgeText: {
    color: '#FF8C00',
    fontSize: 10,
    fontWeight: '700',
  },
  tournamentName: {
    fontSize: 16,
    fontWeight: '700',
  },
  tournamentFormat: {
    fontSize: 12,
    marginTop: 4,
  },
  prizeContainer: {
    alignItems: 'flex-end',
  },
  prizeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#DC2E4B',
  },
  prizeLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tournamentMeta: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadingContainer: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyContainer: {
    paddingVertical: 48,
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
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default HomeScreen;
