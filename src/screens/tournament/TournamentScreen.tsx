import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { SheetModal } from '../../components/SheetModal';
import CreateEventForm from '../../components/forms/CreateEventForm';
import LoadResultsForm from '../../components/forms/LoadResultsForm';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import {
  getTournament,
  getTournamentMemberCount,
  getMyTournamentRole,
  isUserAdmin,
  archiveTournament,
  deleteTournamentSoft,
  Tournament,
} from '../../services/tournamentService';
import { listenEvents, deleteEvent, updateEvent, Event } from '../../services/eventService';
import {
  listenBets,
  listenBetPicks,
  listBets,
  getMyPick,
  lockBet,
  Bet,
  Pick,
} from '../../services/betService';
import { calculateTournamentBalances, UserBalance } from '../../services/groupsService';

// Sub-components
import EventsTab, { EventFilter } from './tabs/EventsTab';
import RankingTab from './tabs/RankingTab';
import InfoTab from './tabs/InfoTab';
import EventBottomSheet from './components/EventBottomSheet';
import ParticipantSheet from './components/ParticipantSheet';
import InviteFriendsSheet from './components/InviteFriendsSheet';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'events' | 'ranking' | 'info';

const TABS: { key: Tab; label: string }[] = [
  { key: 'events', label: 'Eventos' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'info', label: 'Info' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getTournamentStatusBadgeColor = (status: string): string => {
  switch (status) {
    case 'active': return Colors.dark.success;
    case 'archived':
    case 'locked':
    default: return Colors.dark.warning;
  }
};

const getTournamentStatusLabel = (status: string): string => {
  switch (status) {
    case 'active': return 'ACTIVO';
    case 'archived': return 'FINALIZADO';
    case 'locked': return 'BLOQUEADO';
    default: return status.toUpperCase();
  }
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const TournamentScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId, openEventId, openInviteSheet } = route.params ?? {};

  // ── Shared state ────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('events');
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadingHeader, setLoadingHeader] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [memberCount, setMemberCount] = useState(0);

  // ── Events tab state ────────────────────────────────────────────────────────
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsRefreshing, setEventsRefreshing] = useState(false);
  const [eventFilter, setEventFilter] = useState<EventFilter>('open');
  const isFirstFocusRef = useRef(true);
  const eventsUnsubRef = useRef<(() => void) | null>(null);
  const autoOpenDoneRef = useRef(false);
  // Captured once at mount time from route.params so the ref is stable
  // even if setParams clears the value later.
  const openInviteSheetRef = useRef(openInviteSheet === true);

  // ── Bottom sheet state ───────────────────────────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [showEventSheet, setShowEventSheet] = useState(false);
  const [sheetBets, setSheetBets] = useState<Bet[]>([]);
  const [sheetBetsLoading, setSheetBetsLoading] = useState(false);
  const [userPicks, setUserPicks] = useState<Record<string, Pick | null>>({});
  const sheetBetsUnsubRef = useRef<(() => void) | null>(null);
  const [eventPicks, setEventPicks] = useState<Record<string, boolean>>({});

  // Live pool totals derived from picks subcollection (avoids Firestore rules
  // blocking member writes on the bet document).
  const [liveTotals, setLiveTotals] = useState<Record<string,
    { totalPot: number; totalPicks: number; optionTotals: Record<string, number> }
  >>({});
  const picksUnsubsRef = useRef<Record<string, () => void>>({});

  // ── Create event/bet sheet state ────────────────────────────────────────────
  const [showCreateEventSheet, setShowCreateEventSheet] = useState(false);
  const [createEventEditMode, setCreateEventEditMode] = useState(false);
  const [createEventId, setCreateEventId] = useState<string | undefined>(undefined);
  const [showLoadResultsSheet, setShowLoadResultsSheet] = useState(false);
  // ── Ranking tab state ────────────────────────────────────────────────────────
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingRefreshing, setRankingRefreshing] = useState(false);
  const [rankingLastFetched, setRankingLastFetched] = useState(0);

  // ── Participant sheet state ──────────────────────────────────────────────────
  const [showParticipantSheet, setShowParticipantSheet] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<UserBalance | null>(null);
  const [selectedParticipantIndex, setSelectedParticipantIndex] = useState(0);
  // ── Invite sheet state ─────────────────────────────────────────────────────
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [isInvitePostCreation, setIsInvitePostCreation] = useState(false);
  // ── Info tab state ───────────────────────────────────────────────────────────
  const [savingInfo, setSavingInfo] = useState(false);

  // ─────────────────────────────────────────────────────────────────────────────
  // DATA LOADING
  // ─────────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!tournamentId || !user) return;
    loadHeaderData();
    subscribeEvents();
    return () => { eventsUnsubRef.current?.(); };
  }, [tournamentId, user]);

  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusRef.current) { isFirstFocusRef.current = false; return; }
      if (!tournamentId) return;
      setEventsRefreshing(true);
      subscribeEvents();
    }, [tournamentId])
  );

  // Auto-open InviteFriendsSheet when arriving from CreateTournamentScreen.
  // Using useEffect (mount-only) + InteractionManager ensures we wait for the
  // full navigation slide-in animation before presenting the Modal, avoiding
  // the iOS “cannot present while transitioning” silent failure.
  useEffect(() => {
    if (!openInviteSheetRef.current) return;
    openInviteSheetRef.current = false; // fire exactly once
    Keyboard.dismiss();
    const task = InteractionManager.runAfterInteractions(() => {      setIsInvitePostCreation(true);      setShowInviteSheet(true);
      // Clear param so Back→Forward doesn’t re-open the sheet
      navigation.setParams({ openInviteSheet: undefined });
    });
    return () => task.cancel();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadHeaderData = useCallback(async () => {
    try {
      const [data, count, adminStatus] = await Promise.all([
        getTournament(tournamentId),
        getTournamentMemberCount(tournamentId),
        user ? isUserAdmin(tournamentId, user.uid) : Promise.resolve(false),
      ]);
      setTournament(data);
      setMemberCount(count);
      setIsAdmin(adminStatus);
    } catch (e) {
      console.error('TournamentScreen loadHeaderData:', e);
    } finally {
      setLoadingHeader(false);
    }
  }, [tournamentId, user]);

  const subscribeEvents = useCallback(() => {
    eventsUnsubRef.current?.();
    const unsub = listenEvents(tournamentId, (updated) => {
      setEvents(updated);
      setEventsLoading(false);
      setEventsRefreshing(false);
    });
    eventsUnsubRef.current = unsub;
  }, [tournamentId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // EVENTS HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const filteredEvents = events.filter((e) => {
    if (eventFilter === 'open') return e.status === 'live' || e.status === 'upcoming' || e.status === 'locked';
    if (eventFilter === 'upcoming') return e.status === 'upcoming';
    if (eventFilter === 'finished') return e.status === 'finished' || e.status === 'cancelled';
    return true;
  });

  const handleEventPress = useCallback(async (event: Event) => {
    setSelectedEvent(event);
    setShowEventSheet(true);
    setSheetBetsLoading(true);
    setUserPicks({});

    // Reset live totals and per-bet picks listeners for the new event
    setLiveTotals({});
    Object.values(picksUnsubsRef.current).forEach(u => u());
    picksUnsubsRef.current = {};

    sheetBetsUnsubRef.current?.();
    const unsub = listenBets(tournamentId, event.id, async (bets) => {
      setSheetBets(bets);
      setSheetBetsLoading(false);
      if (!user) return;

      // Set up per-bet picks listeners IMMEDIATELY (before the slower getMyPick calls).
      // This ensures we don't miss pick changes that happen during the await below.
      bets.forEach(bet => {
        if (picksUnsubsRef.current[bet.id]) return; // already subscribed
        picksUnsubsRef.current[bet.id] = listenBetPicks(
          tournamentId, event.id, bet.id,
          (allPicks) => {
            // Derive live pool totals from all picks
            let totalPot = 0;
            const optionTotals: Record<string, number> = {};
            let myPick: Pick | null = null;
            allPicks.forEach(p => {
              totalPot += p.stakeAmount || 0;
              const key = typeof p.selection === 'object'
                ? JSON.stringify(p.selection)
                : String(p.selection);
              optionTotals[key] = (optionTotals[key] || 0) + (p.stakeAmount || 0);
              if (p.uid === user.uid) myPick = p;
            });
            setLiveTotals(prev => ({
              ...prev,
              [bet.id]: { totalPot, totalPicks: allPicks.length, optionTotals },
            }));
            // Keep userPicks in sync so selection highlight updates immediately
            // without waiting for the listenBets → getMyPick round-trip.
            setUserPicks(prev => ({ ...prev, [bet.id]: myPick }));
            setEventPicks(prev => ({ ...prev, [event.id]: myPick !== null || Object.values(prev).some(Boolean) }));
          },
        );
      });

      // Fetch the current user's picks (slower, but gives the initial state)
      const picks: Record<string, Pick | null> = {};
      await Promise.all(
        bets.map(async (bet) => {
          picks[bet.id] = await getMyPick(tournamentId, event.id, bet.id, user.uid);
        })
      );
      setUserPicks(picks);
      const hasPick = Object.values(picks).some((p) => p !== null);
      setEventPicks((prev) => ({ ...prev, [event.id]: hasPick }));
    });
    sheetBetsUnsubRef.current = unsub;
  }, [tournamentId, user]);

  // Auto-open event sheet when navigated from TournamentPredictionsScreen
  useEffect(() => {
    if (!openEventId || events.length === 0 || showEventSheet || autoOpenDoneRef.current) return;
    const ev = events.find((e) => e.id === openEventId);
    if (ev) {
      autoOpenDoneRef.current = true;
      setActiveTab('events');
      handleEventPress(ev);
    }
  }, [events, openEventId, handleEventPress]);

  const closeSheet = () => {
    sheetBetsUnsubRef.current?.();
    Object.values(picksUnsubsRef.current).forEach(u => u());
    picksUnsubsRef.current = {};
    setLiveTotals({});
    setShowEventSheet(false);
    setSelectedEvent(null);
    setSheetBets([]);
  };

  // Merge live picks-derived totals into sheetBets so BetCardCompact always
  // shows up-to-date pool / odds regardless of whether the bet doc was updated.
  const mergedSheetBets = useMemo(
    () => sheetBets.map(bet =>
      liveTotals[bet.id] ? { ...bet, ...liveTotals[bet.id] } : bet,
    ),
    [sheetBets, liveTotals],
  );

  const handleDeleteEvent = (event: Event) => {
    Alert.alert('Eliminar evento', `¿Eliminar "${event.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try { await deleteEvent(tournamentId, event.id); }
          catch (e: any) { Alert.alert('Error', e.message || 'No se pudo eliminar'); }
        },
      },
    ]);
  };

  const handleEditEvent = (event: Event) => {
    setCreateEventId(event.id);
    setCreateEventEditMode(true);
    setShowCreateEventSheet(true);
  };

  const handleCloseEvent = (event: Event) => {
    Alert.alert(
      'Cerrar apuestas',
      `¿Estás seguro de cerrar las apuestas de "${event.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar apuestas',
          style: 'destructive',
          onPress: async () => {
            try {
              // Block if no bets exist — nothing to lock
              const bets = await listBets(tournamentId, event.id);
              const lockable = bets.filter((b) => b.status === 'open' || b.status === 'pending');
              if (lockable.length === 0) {
                Alert.alert(
                  'Sin apuestas',
                  'Este evento no tiene apuestas abiertas para cerrar.',
                );
                return;
              }
              // Lock individual bets first — if this fails, the event status
              // won't be changed, preventing a partially-locked state.
              await Promise.all(lockable.map((b) => lockBet(tournamentId, event.id, b.id)));
              await updateEvent(tournamentId, event.id, { status: 'locked' });
            } catch (e: any) {
              Alert.alert('Error', e.message || 'No se pudo cerrar el evento');
            }
          },
        },
      ],
    );
  };

  const handleLoadResults = (_event: Event) => {
    setShowLoadResultsSheet(true);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RANKING HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const loadRanking = async (refreshing = false) => {
    if (refreshing) setRankingRefreshing(true); else setRankingLoading(true);
    try {
      const data = await calculateTournamentBalances(tournamentId);
      setBalances(data);
      setRankingLastFetched(Date.now());
    } catch (e) { console.error('Ranking error:', e); }
    finally { setRankingLoading(false); setRankingRefreshing(false); }
  };

  useEffect(() => {
    const isStale = Date.now() - rankingLastFetched > 60000;
    if (activeTab === 'ranking' && (balances.length === 0 || isStale)) loadRanking();
  }, [activeTab]);

  // ─────────────────────────────────────────────────────────────────────────────
  // INFO HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleArchiveTournament = () => {
    Alert.alert('Archivar torneo', '¿Archivar este torneo?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Archivar', style: 'destructive',
        onPress: async () => {
          try {
            setSavingInfo(true);
            await archiveTournament(tournamentId);
            await loadHeaderData();
          } catch (e: any) { Alert.alert('Error', e.message); }
          finally { setSavingInfo(false); }
        },
      },
    ]);
  };

  const handleDeleteTournament = () => {
    Alert.alert(
      'Eliminar torneo',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              setSavingInfo(true);
              await deleteTournamentSoft(tournamentId);
              navigation.goBack();
            } catch (e: any) { Alert.alert('Error', e.message); setSavingInfo(false); }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SEGMENTED CONTROL
  // ─────────────────────────────────────────────────────────────────────────────

  const renderSegmentedControl = () => (
    <View style={[styles.segmentedControl, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.key;
        if (isActive) {
          return (
            <View
              key={tab.key}
              style={[styles.segmentItem, { backgroundColor: colors.primary }]}
            >
              <TouchableOpacity onPress={() => setActiveTab(tab.key)} style={styles.segmentTouchable}>
                <Text style={styles.segmentLabelActive}>{tab.label}</Text>
              </TouchableOpacity>
            </View>
          );
        }
        return (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.segmentItem}>
            <Text style={[styles.segmentLabel, { color: colors.mutedForeground }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <LoadingBar isLoading={loadingHeader || eventsRefreshing} />

        {loadingHeader ? (
          <View style={styles.headerSkeleton}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={2}>
                {tournament?.name ?? '—'}
              </Text>
              <View style={styles.headerRight}>
                {isAdmin && (
                  <TouchableOpacity
                    style={[styles.inviteBtn, { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' }]}
                    onPress={() => setShowInviteSheet(true)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="person-add-outline" size={14} color={colors.primary} />
                    <Text style={[styles.inviteBtnText, { color: colors.primary }]}>Invitar</Text>
                  </TouchableOpacity>
                )}
                {tournament && (
                  <View style={[styles.statusBadge, { backgroundColor: getTournamentStatusBadgeColor(tournament.status) }]}>
                    <Text style={styles.statusBadgeText}>
                      {getTournamentStatusLabel(tournament.status)}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        {renderSegmentedControl()}

        {/* Tab content */}
        {activeTab === 'events' && (
          <EventsTab
            filteredEvents={filteredEvents}
            eventsLoading={eventsLoading}
            eventsRefreshing={eventsRefreshing}
            eventFilter={eventFilter}
            isAdmin={isAdmin}
            eventPicks={eventPicks}
            onEventPress={handleEventPress}
            onEditEvent={handleEditEvent}
            onDeleteEvent={handleDeleteEvent}
            onFilterChange={setEventFilter}
            onRefresh={() => { setEventsRefreshing(true); subscribeEvents(); }}
            onCloseEvent={handleCloseEvent}
            onLoadResults={handleLoadResults}
          />
        )}

        {activeTab === 'ranking' && (
          <RankingTab
            balances={balances}
            rankingLoading={rankingLoading}
            rankingRefreshing={rankingRefreshing}
            currentUserId={user?.uid ?? ''}
            onRefresh={() => loadRanking(true)}
            onParticipantPress={(balance, index) => {
              setSelectedParticipant(balance);
              setSelectedParticipantIndex(index);
              setShowParticipantSheet(true);
            }}
          />
        )}

        {activeTab === 'info' && tournament && (
          <InfoTab
            tournament={tournament}
            memberCount={memberCount}
            isAdmin={isAdmin}
            savingInfo={savingInfo}
            tournamentId={tournamentId}
            onArchive={handleArchiveTournament}
            onDelete={handleDeleteTournament}
          />
        )}

        {/* FAB for creating events */}
        {activeTab === 'events' && isAdmin && (
          <FloatingActionButton
            onPress={() => {
              setCreateEventId(undefined);
              setCreateEventEditMode(false);
              setShowCreateEventSheet(true);
            }}
          />
        )}

        {/* Event bottom sheet */}
        <EventBottomSheet
          visible={showEventSheet}
          event={selectedEvent}
          sheetBets={mergedSheetBets}
          sheetBetsLoading={sheetBetsLoading}
          userPicks={userPicks}
          isAdmin={isAdmin}
          tournamentId={tournamentId}
          tournamentName={tournament?.name}
          onClose={closeSheet}
        />

        {/* Create Event Sheet */}
        <SheetModal visible={showCreateEventSheet} onClose={() => setShowCreateEventSheet(false)}>
          <CreateEventForm
            tournamentId={tournamentId}
            eventId={createEventId}
            editMode={createEventEditMode}
            onSuccess={() => setShowCreateEventSheet(false)}
          />
        </SheetModal>

        {/* Load Results Sheet */}
        <SheetModal visible={showLoadResultsSheet} onClose={() => setShowLoadResultsSheet(false)}>
          <LoadResultsForm tournamentId={tournamentId} />
        </SheetModal>

        {/* Participant detail sheet */}
        <ParticipantSheet
          visible={showParticipantSheet}
          onClose={() => {
            setShowParticipantSheet(false);
            setSelectedParticipant(null);
          }}
          participant={selectedParticipant}
          position={selectedParticipantIndex + 1}
          tournamentId={tournamentId}
        />

        {/* Invite Friends Sheet */}
        <InviteFriendsSheet
          visible={showInviteSheet}
          onClose={() => { setShowInviteSheet(false); setIsInvitePostCreation(false); }}
          tournamentId={tournamentId}
          tournamentName={tournament?.name ?? ''}
          isPostCreation={isInvitePostCreation}
        />

      </View>
    </GestureHandlerRootView>
  );
};

export default TournamentScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSkeleton: { height: 72, justifyContent: 'center', alignItems: 'center' },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusBadge: { height: 28, paddingHorizontal: 10, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  statusBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  inviteBtnText: { fontSize: 12, fontWeight: '700' },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    height: 44,
  },
  segmentItem: { flex: 1 },
  segmentTouchable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentLabel: { fontSize: 14, fontWeight: '600', textAlign: 'center', lineHeight: 44 },
  segmentLabelActive: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
