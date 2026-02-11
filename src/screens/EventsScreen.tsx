import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { LoadingBar } from '../components/LoadingBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { listMyTournaments, getTournament, Tournament, isUserAdmin } from '../services/tournamentService';
import { listEvents, deleteEvent, cancelEvent } from '../services/eventService';
import { SwipeableRow } from '../components/BetanoComponents';

const EventsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId: routeTournamentId } = route?.params || {};
  
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournamentId, setSelectedTournamentId] = useState<string | null>(routeTournamentId || null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Initial loading bar - only on first mount
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadTournaments();
  }, [user]);

  useEffect(() => {
    if (selectedTournamentId && user) {
      // Show filter loading bar when switching tournaments (after initial load)
      if (initialLoadDone) {
        setFilterLoading(true);
      }
      loadData();
      checkAdminStatus();
    }
  }, [selectedTournamentId, user]);

  const loadTournaments = async () => {
    if (!user) return;
    
    try {
      const myTournaments = await listMyTournaments();
      const filtered = myTournaments.filter(t => t.status !== 'deleted');
      setTournaments(filtered);
      
      // Auto-select first tournament if none selected
      if (!selectedTournamentId && filtered.length > 0) {
        setSelectedTournamentId(filtered[0].id);
      }
    } catch (error) {
      // Silent fail
    }
  };

  const loadData = async () => {
    if (!user || !selectedTournamentId) return;
    
    try {
      // Load tournament
      const tournamentData = await getTournament(selectedTournamentId);
      setTournament(tournamentData);
      
      // Load events - this will update in real-time via Firestore cache
      const eventsList = await listEvents(selectedTournamentId);
      setEvents(eventsList);
    } catch (error) {
      // Silent fail
    } finally {
      setInitialLoadDone(true);
      setFilterLoading(false);
    }
  };

  // Periodically refresh to ensure we have latest data
  useEffect(() => {
    if (!selectedTournamentId || !user || !initialLoadDone) return;
    
    // Set up periodic refresh every 5 seconds when screen is active
    const interval = setInterval(() => {
      loadData();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [selectedTournamentId, user, initialLoadDone]);

  const checkAdminStatus = async () => {
    if (!user || !selectedTournamentId) return;
    try {
      const admin = await isUserAdmin(selectedTournamentId, user.uid);
      setIsAdmin(admin);
    } catch (error) {
      // Silent fail
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadTournaments(), loadData()]);
    setRefreshing(false);
  };

  const handleEditEvent = (event: any) => {
    navigation.navigate('CreateEvent', {
      tournamentId: selectedTournamentId,
      eventId: event.id,
      editMode: true,
    });
  };

  const handleDeleteEvent = (event: any) => {
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
              await deleteEvent(selectedTournamentId!, event.id);
              Alert.alert('Éxito', 'Evento eliminado');
              loadData();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo eliminar');
            }
          },
        },
      ]
    );
  };

  // Show full loading screen on first real load
  if (!initialLoadDone) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={isLoading} />
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
        <TopBar />
        <LoadingBar isLoading={isLoading || filterLoading} />
        
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
            Eventos
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

        {events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color={colors.mutedForeground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Sin eventos
            </Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {tournaments.length === 0 
                ? 'Crea un torneo o únete a uno para ver eventos'
                : 'Este torneo aún no tiene eventos'}
            </Text>
          </View>
        ) : (
          <View style={styles.eventsList}>
            {events.map((event) => (
              <SwipeableRow
                key={event.id}
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
                <TouchableOpacity
                  style={[styles.eventCard, { backgroundColor: colors.card }]}
                  onPress={() => navigation.navigate('BetsList', { 
                    tournamentId: selectedTournamentId, 
                    eventId: event.id 
                  })}
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
                
                <View style={styles.eventHeader}>
                  <View style={styles.eventInfo}>
                    <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {event.title}
                    </Text>
                    {event.description && (
                      <Text style={[styles.eventDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {event.description}
                      </Text>
                    )}
                  </View>
                </View>
                
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                
                <View style={styles.eventFooter}>
                  <View style={styles.eventMeta}>
                    <View style={styles.metaItem}>
                      <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                        <Ionicons name="calendar" size={14} color={colors.primary} />
                      </View>
                      <Text style={[styles.metaText, { color: colors.foreground }]}>
                        {new Date(event.startDate?.seconds * 1000 || Date.now()).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>
                    <View style={styles.metaItem}>
                      <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                        <Ionicons 
                          name={event.status === 'upcoming' ? 'time-outline' : 
                                event.status === 'live' ? 'play-circle' : 
                                'checkmark-circle'} 
                          size={14} 
                          color={colors.primary} 
                        />
                      </View>
                      <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                        {event.status === 'upcoming' ? 'Próximo' : 
                         event.status === 'live' ? 'En vivo' : 
                         'Finalizado'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.viewButton, { backgroundColor: colors.primary }]}>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </View>
                </View>
              </TouchableOpacity>
            </SwipeableRow>
            ))}
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
  eventsList: {
    gap: Spacing.md,
  },
  eventCard: {
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
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventDesc: {
    fontSize: 13,
  },
  dividerLine: {
    height: 1,
    marginBottom: Spacing.md,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventMeta: {
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
