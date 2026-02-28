import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Modal,
  TextInput,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Gradients } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { SwipeableRow } from '../../components/BetanoComponents';
import { SheetModal } from '../../components/SheetModal';
import CreateTournamentForm from '../../components/forms/CreateTournamentForm';
import JoinCodeForm from '../../components/forms/JoinCodeForm';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useTournaments } from '../../context/TournamentsContext';
import { getUserProfile } from '../../services/userService';
import { getTournamentMemberCount } from '../../services/tournamentService';
import { Event, listenEvents } from '../../services/eventService';
import { Bet, Pick, listBets, listenBets, getMyPick, upsertMyPick, calculateOdds, listenBetPicks } from '../../services/betService';
import { isEventToday, getEventBadgeLabel } from '../../utils/formatters';

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
    'otro': 'Otro',
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
    'otro': 'ellipsis-horizontal',
  };
  return iconMap[formatId] || 'trophy';
};


// Extended event with tournament info
interface EventWithTournament extends Event {
  tournamentId: string;
  tournamentName: string;
  primaryBet?: Bet; // La bet principal (open primero, luego locked)
}

// User bet info
interface UserBetInfo {
  eventId: string;
  betId: string;
  eventTitle: string;
  tournamentName: string;
  tournamentId: string;
  status: string;
  pickSelection?: string;
}

// Carousel layout constants
const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 10;
const PEEK = 14; // píxeles de la siguiente card visibles
const CARD_WIDTH = SCREEN_WIDTH - 14 - CARD_GAP - PEEK;

const HomeScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournaments, adminStatuses, loading: loadingTournaments, refreshing, refresh } = useTournaments();
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState<string>('');
  const [todayEvents, setTodayEvents] = useState<EventWithTournament[]>([]);
  const [userBets, setUserBets] = useState<UserBetInfo[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventWithTournament | null>(null);
  const [showQuickBetModal, setShowQuickBetModal] = useState(false);
  const [selectedOdd, setSelectedOdd] = useState<string>('');
  const [selectedBetId, setSelectedBetId] = useState<string>('');
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [betAmount, setBetAmount] = useState<string>('');
  const [confirmingBet, setConfirmingBet] = useState(false);
  const [betFeedback, setBetFeedback] = useState<string>('');
  const [selectedCurrentPick, setSelectedCurrentPick] = useState<string | null>(null);
  const [participantCounts, setParticipantCounts] = useState<Record<string, number>>({});
  const [showCreateTournamentSheet, setShowCreateTournamentSheet] = useState(false);
  const [showJoinCodeSheet, setShowJoinCodeSheet] = useState(false);

  // Live pool totals derived from picks subcollection (same pattern as TournamentScreen)
  const [liveTotals, setLiveTotals] = useState<Record<string, {
    totalPot: number;
    totalPicks: number;
    optionTotals: Record<string, number>;
  }>>({});
  const picksUnsubsRef = useRef<Record<string, () => void>>({});

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    loadUserName();
  }, [user]);

  useEffect(() => {
    if (tournaments.length > 0 && user) {
      loadTodayEvents();
      loadUserBets();
      loadParticipantCounts();
    }
  }, [tournaments, user]);

  // Cleanup picks listeners on unmount
  useEffect(() => {
    return () => { Object.values(picksUnsubsRef.current).forEach(u => { u(); }); };
  }, []);

  const loadParticipantCounts = async () => {
    const counts: Record<string, number> = {};
    for (const tournament of tournaments.slice(0, 2)) {
      try {
        const count = await getTournamentMemberCount(tournament.id);
        counts[tournament.id] = count;
      } catch (error) {
        console.error(`Error loading participant count for ${tournament.id}:`, error);
      }
    }
    setParticipantCounts(counts);
  };

  const loadUserName = async () => {
    if (!user) return;
    try {
      const profile = await getUserProfile(user.uid);
      if (profile) {
        const name = profile.fullName || profile.displayName || user.email?.split('@')[0] || 'Usuario';
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

  const loadTodayEvents = async () => {
    if (tournaments.length === 0) return;
    setLoadingEvents(true);
    
    try {
      const allEvents: EventWithTournament[] = [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Load events from active tournaments only (exclude soft-deleted)
      const tournamentsToCheck = tournaments.filter(t => t.status !== 'deleted').slice(0, 5);
      
      await Promise.all(
        tournamentsToCheck.map(async (tournament) => {
          try {
            const eventsRef = await import('../../services/eventService');
            const events = await eventsRef.listEvents(tournament.id);
            
            events.forEach((event) => {
              // Filter: upcoming or live events
              if (event.status === 'upcoming' || event.status === 'live') {
                allEvents.push({
                  ...event,
                  tournamentId: tournament.id,
                  tournamentName: tournament.name,
                });
              }
            });
          } catch (error) {
            console.error(`Error loading events for tournament ${tournament.id}:`, error);
          }
        })
      );

      // Sort by status (live first) and then by date
      allEvents.sort((a, b) => {
        if (a.status === 'live' && b.status !== 'live') return -1;
        if (a.status !== 'live' && b.status === 'live') return 1;
        if (a.startsAt && b.startsAt) {
          return a.startsAt.toMillis() - b.startsAt.toMillis();
        }
        return 0;
      });

      // For each event, find the primary bet (open first, then locked)
      const eventsWithBets = await Promise.all(
        allEvents.map(async (event) => {
          try {
            const bets = await listBets(event.tournamentId, event.id);
            const openBet = bets.find((b) => b.status === 'pending' || b.status === 'open');
            const lockedBet = bets.find((b) => b.status === 'locked');
            return { ...event, primaryBet: openBet || lockedBet || undefined };
          } catch {
            return event;
          }
        })
      );

      const eventsToShow = eventsWithBets.slice(0, 5);
      setTodayEvents(eventsToShow);

      // Refresh picks listeners for the new event list
      Object.values(picksUnsubsRef.current).forEach(u => { u(); });
      picksUnsubsRef.current = {};
      setLiveTotals({});
      for (const event of eventsToShow) {
        const bet = event.primaryBet;
        if (!bet) continue;
        if (picksUnsubsRef.current[bet.id]) continue;
        picksUnsubsRef.current[bet.id] = listenBetPicks(
          event.tournamentId, event.id, bet.id,
          (allPicks) => {
            let totalPot = 0;
            const optionTotals: Record<string, number> = {};
            allPicks.forEach(p => {
              totalPot += p.stakeAmount || 0;
              const key = typeof p.selection === 'object'
                ? JSON.stringify(p.selection) : String(p.selection);
              optionTotals[key] = (optionTotals[key] || 0) + (p.stakeAmount || 0);
            });
            setLiveTotals(prev => ({
              ...prev,
              [bet.id]: { totalPot, totalPicks: allPicks.length, optionTotals },
            }));
          },
        );
      }
    } catch (error) {
      console.error('Error loading today events:', error);
    } finally {
      setLoadingEvents(false);
    }
  };

  const loadUserBets = async () => {
    if (!user || tournaments.length === 0) return;

    try {
      const { listEvents } = await import('../../services/eventService');
      const { listBets, getMyPick } = await import('../../services/betService');
      const uid = user.uid;

      // Fetch all events for the first 3 active tournaments in parallel
      const tournamentsToCheck = tournaments.filter(t => t.status !== 'deleted').slice(0, 3);
      const eventsByTournament = await Promise.allSettled(
        tournamentsToCheck.map(async (tournament) => ({
          tournament,
          events: await listEvents(tournament.id),
        }))
      );

      // Fetch bets for first 3 events of each tournament in parallel
      const betTasks = eventsByTournament
        .filter(
          (r): r is PromiseFulfilledResult<{ tournament: any; events: any[] }> =>
            r.status === 'fulfilled'
        )
        .flatMap(({ value: { tournament, events } }) =>
          events.slice(0, 3).map(async (event) => ({
            tournament,
            event,
            bets: await listBets(tournament.id, event.id),
          }))
        );

      const betResults = await Promise.allSettled(betTasks);

      // Fetch picks for all open/locked bets in parallel
      const pickTasks = betResults
        .filter(
          (r): r is PromiseFulfilledResult<{ tournament: any; event: any; bets: any[] }> =>
            r.status === 'fulfilled'
        )
        .flatMap(({ value: { tournament, event, bets } }) =>
          bets
            .filter((b) => b.status === 'open' || b.status === 'pending')
            .map(async (bet) => {
              const pick = await getMyPick(tournament.id, event.id, bet.id, uid);
              if (!pick) return null;
              return {
                eventId: event.id,
                betId: bet.id,
                eventTitle: event.title,
                tournamentName: tournament.name,
                tournamentId: tournament.id,
                status: bet.status,
                pickSelection:
                  typeof pick.selection === 'string'
                    ? pick.selection
                    : JSON.stringify(pick.selection),
              } as UserBetInfo;
            })
        );

      const pickResults = await Promise.allSettled(pickTasks);
      const found = pickResults
        .filter(
          (r): r is PromiseFulfilledResult<UserBetInfo> =>
            r.status === 'fulfilled' && r.value !== null
        )
        .map((r) => r.value);

      setUserBets(found.slice(0, 3));
    } catch (error) {
      console.error('Error loading user bets:', error);
    }
  };

  const handleOddPress = (event: EventWithTournament, option: string, betId: string, oddValue: string) => {
    setSelectedEvent(event);
    setSelectedOption(option);
    setSelectedBetId(betId);
    setSelectedOdd(oddValue);
    setBetFeedback('');
    setBetAmount('');
    const existingBet = userBets.find((b) => b.eventId === event.id && b.betId === betId);
    setSelectedCurrentPick(existingBet?.pickSelection ?? null);
    setShowQuickBetModal(true);
  };

  const handleConfirmBet = async () => {
    if (!user || !selectedEvent || !selectedBetId || !selectedOption) return;
    setConfirmingBet(true);
    setBetFeedback('');
    try {
      const bet = selectedEvent.primaryBet;
      // Si es fixed usar stakeAmount del bet, si es free usar el monto ingresado
      const stakeAmount = (bet?.stakeType === 'fixed')
        ? (bet?.stakeAmount ?? 0)
        : (parseFloat(betAmount) || 0);
      await upsertMyPick(
        selectedEvent.tournamentId,
        selectedEvent.id,
        selectedBetId,
        user.uid,
        selectedOption,
        stakeAmount
      );
      setBetFeedback('¡Apuesta registrada!');
      await loadUserBets();
      setTimeout(() => {
        setShowQuickBetModal(false);
        setBetFeedback('');
      }, 1200);
    } catch (error: any) {
      setBetFeedback(error?.message || 'Error al registrar la apuesta');
    } finally {
      setConfirmingBet(false);
    }
  };

  const handleEditTournament = (tournament: any) => {
    navigation.navigate('TournamentSettings', { tournamentId: tournament.id });
  };

  const renderEventCard = ({ item }: { item: EventWithTournament }) => {
    const eventDisplayTitle = item.homeTeam && item.awayTeam
      ? `${item.homeTeam} vs ${item.awayTeam}`
      : item.title;

    const primaryBet = item.primaryBet;
    const mergedPrimaryBet = primaryBet && liveTotals[primaryBet.id]
      ? { ...primaryBet, ...liveTotals[primaryBet.id] }
      : primaryBet;
    const realOdds = mergedPrimaryBet ? calculateOdds(mergedPrimaryBet) : {};
    const options = primaryBet?.options?.slice(0, 3) ?? [];
    const hasOdds = options.length > 0;

    // Find the user's existing pick for this event's primary bet
    const existingUserBet = userBets.find(
      (b) => b.eventId === item.id && b.betId === primaryBet?.id
    );
    const userSelection = existingUserBet?.pickSelection;

    return (
      <TouchableOpacity
        style={[styles.eventCard, { backgroundColor: colors.card }]}
        onPress={() => navigation.navigate('Tournament', { tournamentId: item.tournamentId, openEventId: item.id })}
        activeOpacity={0.85}
      >
        <View style={styles.eventCardGradient}>
          <LinearGradient
            colors={[colors.primary + '15', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradientBackground}
          />
        </View>

        {/* Badge estado arriba a la derecha */}
        <View style={[
          styles.statusBadge,
          { backgroundColor: isEventToday(item) ? colors.success : colors.muted }
        ]}>
          {isEventToday(item) && (
            <View style={[styles.liveDot, { backgroundColor: '#FFFFFF' }]} />
          )}
          <Text style={[
            styles.statusBadgeText,
            { color: isEventToday(item) ? '#FFFFFF' : colors.mutedForeground }
          ]}>
            {getEventBadgeLabel(item)}
          </Text>
        </View>

        <View style={styles.eventCardContent}>
          {/* Fecha/hora – con ícono si no tiene fecha */}
          {item.startsAt ? (
            <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>
              {new Date(item.startsAt.toMillis()).toLocaleDateString('es-AR', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          ) : (
            <View style={styles.eventTimeRow}>
              <Ionicons name="time-outline" size={12} color={colors.mutedForeground} />
              <Text style={[styles.eventTime, { color: colors.mutedForeground }]}>Por definir</Text>
            </View>
          )}

          {/* Título del partido */}
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
            {eventDisplayTitle}
          </Text>

          {/* Torneo */}
          <View style={styles.eventCardMeta}>
            <Text style={[styles.eventTournament, { color: colors.mutedForeground, flex: 1 }]} numberOfLines={1}>
              {item.tournamentName}
            </Text>
          </View>

          {/* Tipo de apuesta */}
          <Text style={[styles.betType, { color: colors.mutedForeground }]} numberOfLines={1}>
            {primaryBet ? primaryBet.title : 'Sin cuotas disponibles'}
          </Text>

          {/* Chips de odds reales */}
{hasOdds ? (
  <View style={styles.oddsRow}>
    {options.map((option) => {
      const oddVal = realOdds[option] ?? '—';
      const isSelected = userSelection === option;
      const canPress = primaryBet?.status === 'open' || primaryBet?.status === 'pending';
      return (
        <TouchableOpacity
          key={option}
          style={[
            styles.oddsChip,
            { 
              backgroundColor: isSelected ? colors.primary + "15" : colors.muted,
              borderWidth: 2,
              borderColor: isSelected ? colors.primary : colors.border,
            }
          ]}
          onPress={() => canPress && handleOddPress(item, option, primaryBet!.id, oddVal)}
          activeOpacity={canPress ? 0.7 : 1}
          disabled={!canPress}
        >
          <Text
            style={[styles.oddsLabel, { color: isSelected ? colors.primary : colors.mutedForeground }]}
            numberOfLines={1}
          >
            {option}
          </Text>
          <Text
            style={[styles.oddsValue, { color: isSelected ? colors.foreground : oddVal === '—' ? colors.mutedForeground : colors.foreground }]}
          >
            {oddVal}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
) : (
  <View style={[styles.oddsChip, { backgroundColor: colors.muted, flex: 0, paddingHorizontal: 16 }]}>
    <Text style={[styles.oddsLabel, { color: colors.mutedForeground }]}>Sin cuotas</Text>
  </View>
)}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={isLoading} />
      
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              refresh();
              loadTodayEvents();
              loadUserBets();
              loadParticipantCounts();
            }}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
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

          {/* BLOQUE 1: HOY EN JUEGO - Sin título */}
          {loadingEvents ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : todayEvents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyCardText, { color: colors.mutedForeground }]}>
                No hay eventos para hoy
              </Text>
              <TouchableOpacity
                style={[styles.emptyCardButton, { backgroundColor: colors.primary }]}
                onPress={() => navigation.navigate('Torneos')}
              >
                <Text style={styles.emptyCardButtonText}>Ver torneos</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={todayEvents}
              renderItem={renderEventCard}
              keyExtractor={(item) => `${item.tournamentId}-${item.id}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.eventsFlatList}
              contentContainerStyle={styles.eventsListContainer}
              snapToInterval={CARD_WIDTH + CARD_GAP}
              snapToAlignment="start"
              decelerationRate="fast"
            />
          )}

          {/* BLOQUE 2: APUESTAS ACTIVAS */}
          {userBets.length > 0 && (
            <>
              <View style={[styles.sectionHeader, { marginTop: 32 }]}>
                <View style={styles.sectionTitleContainer}>
                  <Ionicons name="stats-chart" size={20} color={colors.primary} />
                  <Text style={[styles.sectionTitleCaps, { color: colors.foreground }]}>
                    APUESTAS ACTIVAS
                  </Text>
                </View>
                <TouchableOpacity 
                  style={styles.viewAll}
                  onPress={() => navigation.navigate('BetsList')}
                >
                  <Text style={[styles.viewAllText, { color: colors.primary }]}>
                    Ver todas
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.betsList}>
                {userBets.map((bet, index) => (
                  <TouchableOpacity
                    key={`${bet.eventId}-${index}`}
                    style={[styles.betCard, { backgroundColor: colors.card }]}
                    onPress={() =>
                      navigation.navigate('Tournament', {
                        tournamentId: bet.tournamentId,
                        openEventId: bet.eventId,
                      })
                    }
                    activeOpacity={0.8}
                  >
                    <View style={styles.betCardGradient}>
                      <LinearGradient
                        colors={[colors.primary + '10', 'transparent']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.gradientBackground}
                      />
                    </View>
                    <View style={styles.betCardContent}>
                      <View style={styles.betInfo}>
                        <Text style={[styles.betEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                          {bet.eventTitle}
                        </Text>
                        <Text style={[styles.betTournament, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {bet.tournamentName}
                        </Text>
                        {bet.pickSelection && (
                          <Text style={[styles.betSelection, { color: colors.primary }]} numberOfLines={1}>
                            Tu pick: {bet.pickSelection}
                          </Text>
                        )}
                      </View>
                      <View style={[
                        styles.betStatusBadge,
                        { backgroundColor:
                          bet.status === 'pending' ? '#8B8D9720' :
                          bet.status === 'open' ? colors.success : colors.warning  }
                      ]}>
                        <Text style={styles.betStatusText}>
                          {bet.status === 'pending' ? 'PENDIENTE' : bet.status === 'open' ? 'ABIERTA' : 'CERRADA'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* BLOQUE 3: TORNEOS ACTIVOS */}
          <View style={[styles.sectionHeader, { marginTop: 24 }]}>
            <View style={styles.sectionTitleContainer}>
              <Ionicons name="trophy" size={20} color={colors.primary} />
              <Text style={[styles.sectionTitleCaps, { color: colors.foreground }]}>
                TORNEOS ACTIVOS
              </Text>
            </View>
            <View style={styles.sectionActions}>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowCreateTournamentSheet(true)}
              >
                <Ionicons name="add" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowJoinCodeSheet(true)}
              >
                <Text style={[styles.viewAllText, { color: colors.primary }]}>
                  Unirse
                </Text>
              </TouchableOpacity>
            </View>
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
                style={[styles.emptyCreateButton, { backgroundColor: colors.primary }]}
                onPress={() => setShowCreateTournamentSheet(true)}
              >
                <Text style={styles.createButtonText}>Crear Torneo</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.tournamentsList}>
              {tournaments
                .filter((t) => t.status !== 'deleted')
                .slice(0, 2)
                .map((tournament) => {
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
                      onPress={() => navigation.navigate('Tournament', { tournamentId: tournament.id })}
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
                  </View>
                  
                  <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                  
                  <View style={styles.tournamentFooter}>
                    <View style={styles.tournamentMeta}>
                      <View style={styles.metaItem}>
                        <View style={[styles.metaIconCircle, { backgroundColor: colors.secondary }]}>
                          <Ionicons name="people" size={14} color={colors.primary} />
                        </View>
                        <Text style={[styles.metaText, { color: colors.foreground }]}>
                          {participantCounts[tournament.id] 
                            ? `${participantCounts[tournament.id]}/${tournament.participantsEstimated} participantes`
                            : `0/${tournament.participantsEstimated} participantes`}
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

          {/* Ver todos torneos */}
          {!loadingTournaments && (
            <TouchableOpacity
              style={styles.viewAllBottom}
              onPress={() => navigation.navigate('Torneos')}
            >
              <Text style={[styles.viewAllText, { color: colors.primary }]}>Ver todos</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Quick Bet Modal */}
      <Modal
        visible={showQuickBetModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuickBetModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackground}
            activeOpacity={1}
            onPress={() => setShowQuickBetModal(false)}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Confirmar apuesta
              </Text>
              <TouchableOpacity 
                onPress={() => setShowQuickBetModal(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {selectedEvent && (() => {
              const amountNum = parseFloat(betAmount) || 0;
              const estimatedGain = amountNum * (parseFloat(selectedOdd) || 0);
              const isFreeStake = selectedEvent.primaryBet?.stakeType !== 'fixed';
              const alreadySelected = !!selectedCurrentPick && selectedCurrentPick === selectedOption;

              return (
                <>
                  {/* Evento info */}
                  <View style={styles.modalEventInfo}>
                    <Text style={[styles.modalEventTitle, { color: colors.foreground }]} numberOfLines={1}>
                      {selectedEvent.homeTeam && selectedEvent.awayTeam
                        ? `${selectedEvent.homeTeam} vs ${selectedEvent.awayTeam}`
                        : selectedEvent.title}
                    </Text>
                    <Text style={[styles.modalBetType, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {selectedEvent.primaryBet?.title ?? 'Apuesta'}
                    </Text>
                    <Text style={[styles.modalEventTournament, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {selectedEvent.tournamentName}
                    </Text>
                  </View>

                  {/* Opción + cuota seleccionada */}
                  <View style={[styles.modalOddContainer, { backgroundColor: colors.muted }]}>
                    <View style={styles.modalOddRow}>
                      <View>
                        <Text style={[styles.modalOddLabel, { color: colors.mutedForeground }]}>
                          Tu selección
                        </Text>
                        <Text style={[styles.modalOptionText, { color: colors.foreground }]}>
                          {selectedOption}
                        </Text>
                      </View>
                      <Text style={[styles.modalOddValue, { color: colors.foreground }]}>
                        {selectedOdd}
                      </Text>
                    </View>
                  </View>

                  {/* Input de monto (solo si stakeType es libre) */}
                  {isFreeStake ? (
                    <View style={styles.modalAmountSection}>
                      <Text style={[styles.modalAmountLabel, { color: colors.mutedForeground }]}>
                        Monto a apostar
                      </Text>
                      <View style={[styles.modalAmountInputWrap, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                        <Text style={[styles.modalAmountCurrency, { color: colors.mutedForeground }]}>$</Text>
                        <TextInput
                          style={[styles.modalAmountInput, { color: colors.foreground }]}
                          value={betAmount}
                          onChangeText={setBetAmount}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor={colors.mutedForeground}
                          maxLength={10}
                        />
                      </View>
                      {/* Ganancia estimada */}
                      {amountNum > 0 && (
                        <View style={styles.modalGainRow}>
                          <Text style={[styles.modalGainLabel, { color: colors.mutedForeground }]}>
                            Ganancia estimada
                          </Text>
                          <Text style={[styles.modalGainValue, { color: colors.success }]}>
                            ${estimatedGain.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    /* Stake fijo: solo mostrar monto y ganancia */
                    <View style={styles.modalAmountSection}>
                      <View style={styles.modalGainRow}>
                        <Text style={[styles.modalGainLabel, { color: colors.mutedForeground }]}>
                          Monto fijo
                        </Text>
                        <Text style={[styles.modalGainValue, { color: colors.foreground }]}>
                          ${(selectedEvent.primaryBet?.stakeAmount ?? 0).toLocaleString('es-AR')}
                        </Text>
                      </View>
                      {(selectedEvent.primaryBet?.stakeAmount ?? 0) > 0 && (
                        <View style={styles.modalGainRow}>
                          <Text style={[styles.modalGainLabel, { color: colors.mutedForeground }]}>
                            Ganancia estimada
                          </Text>
                          <Text style={[styles.modalGainValue, { color: colors.success }]}>
                            ${((selectedEvent.primaryBet?.stakeAmount ?? 0) * (parseFloat(selectedOdd) || 0)).toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Feedback */}
                  {betFeedback !== '' && (
                    <Text style={[
                      styles.betFeedbackText,
                      { color: betFeedback.startsWith('¡') ? colors.success : colors.destructive }
                    ]}>
                      {betFeedback}
                    </Text>
                  )}

                  {/* Botón rojo primary */}
                  <TouchableOpacity
                    style={[styles.modalConfirmButton, { backgroundColor: colors.primary, opacity: (confirmingBet || alreadySelected) ? 0.45 : 1 }]}
                    onPress={handleConfirmBet}
                    activeOpacity={0.8}
                    disabled={confirmingBet || alreadySelected}
                  >
                    {confirmingBet ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : alreadySelected ? (
                      <Text style={styles.modalConfirmText}>Ya apostaste esta opción</Text>
                    ) : (
                      <Text style={styles.modalConfirmText}>Apostar ahora</Text>
                    )}
                  </TouchableOpacity>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>
      {/* Create Tournament Sheet */}
      <SheetModal visible={showCreateTournamentSheet} onClose={() => setShowCreateTournamentSheet(false)}>
        <CreateTournamentForm
          onSuccess={() => { setShowCreateTournamentSheet(false); refresh(); }}
        />
      </SheetModal>
      {/* Join Code Sheet */}
      <SheetModal visible={showJoinCodeSheet} onClose={() => setShowJoinCodeSheet(false)}>
        <JoinCodeForm
          onJoined={(tournamentId) => {
            setShowJoinCodeSheet(false);
            navigation.navigate('Tournament', { tournamentId });
          }}
        />
      </SheetModal>
      </View>
    </GestureHandlerRootView>
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
    padding: 14,
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
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitleCaps: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  createButtonLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Events styles
  eventsFlatList: {
    marginHorizontal: -16, // rompe el padding del content para ancho completo
  },
  eventsListContainer: {
    paddingLeft: 16,
    paddingRight: PEEK,
    gap: CARD_GAP,
  },
  eventCard: {
    width: CARD_WIDTH,
    minHeight: 198,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  eventCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  eventCardContent: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  eventTime: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  eventTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  eventCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  eventPozo: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  eventTitle: {
    fontSize: 19, // Más grande estilo Betano
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 8,
  },
  betType: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 10,
  },
  statusBadge: {
    position: 'absolute',
    top: 12,
    right: 12, // Derecha como solicitado
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    zIndex: 1,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  eventTournament: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  oddsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  oddsChip: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    gap: 4,
  },
  oddsLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  oddsValue: {
    fontSize: 18, // Grande como Betano
    fontWeight: '700',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 12,
  },
  emptyCardText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyCardButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  emptyCardButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // Bets styles
  betsList: {
    gap: 10,
  },
  betCard: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  betCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  betCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: 13,
  },
  betInfo: {
    flex: 1,
    gap: 4,
  },
  betEventTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  betTournament: {
    fontSize: 13,
    fontWeight: '500',
  },
  betSelection: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  betStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999, // Rounded full
  },
  betStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  // Tournaments styles
  tournamentsList: {
    gap: 12,
  },
  tournamentCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
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
    marginBottom: 12,
  },
  tournamentInfo: {
    flex: 1,
    marginRight: 12,
    gap: 6,
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
    paddingVertical: 8,
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
    marginBottom: 12,
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
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20, // Más compacto
    paddingBottom: 34,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16, // Más compacto
  },
  modalTitle: {
    fontSize: 18, // Más pequeño y compacto
    fontWeight: '700',
  },
  modalEventInfo: {
    marginBottom: 16, // Más compacto
  },
  modalEventTitle: {
    fontSize: 16, // Compacto
    fontWeight: '700',
    marginBottom: 4,
  },
  modalBetType: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  modalEventTournament: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  modalOptionText: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  betFeedbackText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  modalPozoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 2,
  },
  modalPozoLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalPozoValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  modalAmountSection: {
    marginBottom: 12,
  },
  modalAmountLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  modalAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  modalAmountCurrency: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalAmountInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    padding: 0,
  },
  modalAmountError: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  modalGainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  modalGainLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalGainValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  modalOddContainer: {
    padding: 16, // Más compacto
    borderRadius: 12,
    marginBottom: 16,
  },
  modalOddRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOddLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOddValue: {
    fontSize: 28, // Grande pero no tanto
    fontWeight: '700',
  },
  modalConfirmButton: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16, // Más compacto
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
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
  emptyCreateButton: {
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
