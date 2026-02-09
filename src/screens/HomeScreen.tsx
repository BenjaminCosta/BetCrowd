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

// Format label mapping
const getFormatLabel = (formatId: string) => {
  const formatMap: Record<string, string> = {
    'liga': 'Liga',
    'eliminatoria': 'Eliminatoria',
    'grupos-eliminatoria': 'Grupos + Eliminatoria',
    'evento-unico': 'Evento único',
    'serie': 'Serie (Bo3/Bo5)',
    'bracket': 'Eliminación Directa',
    'points': 'Puntos',
  };
  return formatMap[formatId] || formatId;
};

const getFormatIcon = (formatId: string) => {
  const iconMap: Record<string, any> = {
    'liga': 'trophy',
    'eliminatoria': 'git-branch',
    'grupos-eliminatoria': 'grid',
    'evento-unico': 'flag',
    'serie': 'list',
    'bracket': 'git-branch',
    'points': 'analytics',
  };
  return iconMap[formatId] || 'trophy';
};

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
            <View style={styles.headerContent}>
              <View style={styles.greetingContainer}>
                <Text style={[styles.welcomeText, { color: colors.mutedForeground }]}>
                  Bienvenido de vuelta
                </Text>
                <Text style={[styles.userName, { color: colors.foreground }]}>
                  {userName || 'Usuario'}
                </Text>
              </View>
            </View>
          </View>

          {/* Stats Row */}
          <View style={styles.statsRow}>
            {stats.map((stat, index) => (
              <View
                key={stat.label}
                style={[styles.statCard, { backgroundColor: colors.card }]}
              >
                <View style={[styles.statIconCircle, { backgroundColor: colors.primary + '15' }]}>
                  <Ionicons
                    name={stat.icon as any}
                    size={22}
                    color={colors.primary}
                  />
                </View>
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
            <TouchableOpacity 
              style={styles.viewAll}
              onPress={() => navigation.navigate('Eventos')}
            >
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
          ) : tournaments.filter((t) => t.status !== 'deleted').length === 0 ? (
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
              {tournaments
                .filter((t) => t.status !== 'deleted')
                .map((tournament) => (
                <TouchableOpacity
                  key={tournament.id}
                  style={[styles.tournamentCard, { backgroundColor: colors.card }]}
                  onPress={() => navigation.navigate('TournamentDetails', { tournamentId: tournament.id })}
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
                      <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                        {tournament.name}
                      </Text>
                      <View style={styles.formatBadge}>
                        <Ionicons 
                          name={getFormatIcon(tournament.format)} 
                          size={12} 
                          color={colors.primary} 
                        />
                        <Text style={[styles.tournamentFormat, { color: colors.mutedForeground }]}>
                          {getFormatLabel(tournament.format)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.prizeContainer, { backgroundColor: colors.primary + '15' }]}>
                      <Text style={[styles.prizeValue, { color: colors.primary }]}>${tournament.contribution}</Text>
                      <Text style={[styles.prizeLabel, { color: colors.primary }]}>
                        Aporte
                      </Text>
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
                          {tournament.participantsEstimated} participantes
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
    marginBottom: 28,
    paddingTop: 8,
  },
  headerContent: {
    flex: 1,
  },
  greetingContainer: {
    gap: 4,
  },
  welcomeText: {
    fontSize: 15,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  userName: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
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
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
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
    padding: 18,
    borderRadius: 16,
    marginBottom: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
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
    marginBottom: 16,
  },
  tournamentInfo: {
    flex: 1,
    marginRight: 12,
    gap: 6,
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
    fontSize: 17,
    fontWeight: '700',
  },
  formatBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tournamentFormat: {
    fontSize: 13,
    fontWeight: '500',
  },
  prizeContainer: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    minWidth: 80,
  },
  prizeValue: {
    fontSize: 17,
    fontWeight: '700',
  },
  prizeLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  dividerLine: {
    height: 1,
    marginBottom: 16,
  },
  tournamentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  tournamentMeta: {
    flex: 1,
    gap: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  viewButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
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
