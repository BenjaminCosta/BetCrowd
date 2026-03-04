import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { SwipeableRow, BetCardCompact } from '../../components/BetanoComponents';
import BetModal from '../tournament/components/BetModal';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { listMyTournaments } from '../../services/tournamentService';
import {
  getMyPick,
  listBets,
  upsertMyPick,
  deleteMyPick,
  calculateOdds,
  listenBetPicks,
  type Bet,
} from '../../services/betService';
import { listEvents } from '../../services/eventService';

const TournamentPredictionsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId: routeTournamentId } = route?.params || {};

  // ── Pick lists ────────────────────────────────────────────────────────────
  const [openPicks, setOpenPicks] = useState<any[]>([]);
  const [settledPicks, setSettledPicks] = useState<any[]>([]);
  // Keys of settled picks the user has swiped away locally (tournamentId-betId)
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());

  // ── Loading ───────────────────────────────────────────────────────────────
  const [isLoading, setIsLoading] = useState(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'open' | 'settled'>('open');

  // ── BetModal ──────────────────────────────────────────────────────────────
  const [showBetModal, setShowBetModal] = useState(false);
  const [modalBet, setModalBet] = useState<Bet | null>(null);
  const [modalEvent, setModalEvent] = useState<any>(null);
  const [modalTournamentId, setModalTournamentId] = useState('');
  const [modalOption, setModalOption] = useState('');
  const [modalOdd, setModalOdd] = useState('—');
  const [betAmount, setBetAmount] = useState('');
  const [confirmingBet, setConfirmingBet] = useState(false);
  const [betFeedback, setBetFeedback] = useState('');
  const [modalCurrentPick, setModalCurrentPick] = useState<string | null>(null);
  const [modalCurrentPickStake, setModalCurrentPickStake] = useState<number>(0);

  // ── Live pool totals (same pattern as TournamentScreen) ──────────────────
  const [liveTotals, setLiveTotals] = useState<Record<string, {
    totalPot: number;
    totalPicks: number;
    optionTotals: Record<string, number>;
  }>>({});
  const picksUnsubsRef = useRef<Record<string, () => void>>({});

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Cleanup picks listeners on unmount
  useEffect(() => {
    return () => { Object.values(picksUnsubsRef.current).forEach(u => { u(); }); };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!user) return;
    try {
      const allOpenPicks: any[] = [];
      const allSettledPicks: any[] = [];
      setDismissedKeys(new Set()); // clear local dismissals on refresh

      const allTournaments = await listMyTournaments();
      const tournamentsToLoad = allTournaments.filter(
        (t) => t.status !== 'deleted' && (!routeTournamentId || t.id === routeTournamentId),
      );

      await Promise.allSettled(
        tournamentsToLoad.map(async (t) => {
          try {
            const events = await listEvents(t.id);
            await Promise.allSettled(
              events.map(async (event) => {
                try {
                  const bets = await listBets(t.id, event.id);
                  await Promise.allSettled(
                    bets.map(async (bet) => {
                      try {
                        const pick = await getMyPick(t.id, event.id, bet.id, user.uid);
                        if (pick) {
                          const pickData = {
                            tournamentId: t.id,
                            tournamentName: t.name,
                            eventId: event.id,
                            betId: bet.id,
                            pick,
                            bet,
                            event,
                          };
                          if (bet.status === 'settled' || bet.status === 'cancelled') {
                            allSettledPicks.push(pickData);
                          } else {
                            allOpenPicks.push(pickData);
                          }
                        }
                      } catch {
                        // pick doesn't exist, skip
                      }
                    }),
                  );
                } catch {
                  // no bets, skip
                }
              }),
            );
          } catch {
            // no events, skip
          }
        }),
      );

      // Reset picks listeners and subscribe to live picks for all open bets
      Object.values(picksUnsubsRef.current).forEach(u => { u(); });
      picksUnsubsRef.current = {};
      setLiveTotals({});
      for (const pd of allOpenPicks) {
        if (picksUnsubsRef.current[pd.betId]) continue;
        picksUnsubsRef.current[pd.betId] = listenBetPicks(
          pd.tournamentId, pd.eventId, pd.betId,
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
              [pd.betId]: { totalPot, totalPicks: allPicks.length, optionTotals },
            }));
          },
        );
      }

      setOpenPicks(allOpenPicks);
      setSettledPicks(allSettledPicks);
    } catch (err) {
      console.warn('TournamentPredictions loadData:', err);
    } finally {
      setInitialLoadDone(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── BetModal handlers ─────────────────────────────────────────────────────
  const openBetModal = (bet: Bet, event: any, tournamentId: string, option: string, currentSelection?: string | null, pickStake?: number) => {
    const odds = calculateOdds(bet);
    setModalBet(bet);
    setModalEvent(event);
    setModalTournamentId(tournamentId);
    setModalOption(option);
    setModalOdd(odds[option] ?? '—');
    setBetAmount('');
    setBetFeedback('');
    setModalCurrentPick(currentSelection ?? null);
    setModalCurrentPickStake(pickStake ?? 0);
    setShowBetModal(true);
  };

  const handleConfirmBet = async () => {
    if (!user || !modalBet || !modalEvent) return;
    setConfirmingBet(true);
    setBetFeedback('');
    try {
      const stake =
        modalBet.stakeType === 'fixed'
          ? (modalBet.stakeAmount ?? 0)
          : parseFloat(betAmount) || 0;
      await upsertMyPick(modalTournamentId, modalEvent.id, modalBet.id, user.uid, modalOption, stake);

      // Optimistic: update selection in state immediately so UI feels instant
      const _tId = modalTournamentId;
      const _bId = modalBet.id;
      const _opt = modalOption;
      setOpenPicks(prev =>
        prev.map(p =>
          p.tournamentId === _tId && p.betId === _bId
            ? { ...p, pick: { ...p.pick, selection: _opt } }
            : p,
        ),
      );

      setBetFeedback('¡Apuesta actualizada!');
      setTimeout(() => {
        setShowBetModal(false);
        loadData();
      }, 1200);
    } catch {
      setBetFeedback('Error al guardar. Intenta de nuevo.');
    } finally {
      setConfirmingBet(false);
    }
  };

  // ── Cancel pick ───────────────────────────────────────────────────────────
  const confirmCancel = (pickData: any) => {
    // Capture uid synchronously so the async callback is safe even if auth
    // state changes before it runs.
    const uid = user?.uid;
    Alert.alert(
      'Cancelar apuesta',
      '¿Estás seguro de que quieres cancelar esta apuesta?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            if (!uid) {
              Alert.alert('Error', 'Sesión expirada. Vuelve a iniciar sesión.');
              return;
            }
            // Optimistic: remove immediately so UI reflects the action instantly
            setOpenPicks(prev =>
              prev.filter(
                p => !(p.tournamentId === pickData.tournamentId && p.betId === pickData.betId),
              ),
            );
            try {
              await deleteMyPick(
                pickData.tournamentId,
                pickData.eventId,
                pickData.betId,
                uid,
              );
              loadData(); // background refresh for accuracy
            } catch {
              loadData(); // restore correct state on error
              Alert.alert('Error', 'No se pudo cancelar la apuesta.');
            }
          },
        },
      ],
    );
  };

  // Must be declared before any early returns to satisfy Rules of Hooks
  const currentPicks = activeTab === 'open'
    ? openPicks
    : settledPicks.filter(p => !dismissedKeys.has(`${p.tournamentId}-${p.betId}`));

  // Group picks by event so the event header shows only once per event
  const groupedPicks = useMemo(() => {
    const groupMap: Record<string, any[]> = {};
    currentPicks.forEach((p: any) => {
      if (!groupMap[p.eventId]) groupMap[p.eventId] = [];
      groupMap[p.eventId].push(p);
    });
    return Object.values(groupMap);
  }, [currentPicks]);

  // ── Loading screen ────────────────────────────────────────────────────────
  if (!initialLoadDone) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={isLoading} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={isLoading || refreshing} />

        {/* Static header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Mis Apuestas</Text>
        </View>

        {/* Static tabs */}
        <View style={[styles.tabsContainer, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'open' && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
            ]}
            onPress={() => setActiveTab('open')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'open' ? colors.primary : colors.mutedForeground },
              ]}
            >
              Activas ({openPicks.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'settled' && {
                borderBottomColor: colors.primary,
                borderBottomWidth: 2,
              },
            ]}
            onPress={() => setActiveTab('settled')}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === 'settled' ? colors.primary : colors.mutedForeground },
              ]}
            >
              Resueltas ({settledPicks.length})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >

          {/* Pick list */}
          {currentPicks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons
                name={activeTab === 'open' ? 'hourglass-outline' : 'checkmark-done-outline'}
                size={64}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {activeTab === 'open' ? 'Sin apuestas activas' : 'Sin apuestas resueltas'}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {activeTab === 'open'
                  ? 'Participa en eventos para ver tus apuestas aquí'
                  : 'Las apuestas finalizadas aparecerán aquí'}
              </Text>
            </View>
          ) : (
            groupedPicks.map((group: any[]) => {
                const firstPick = group[0];
                const { event: groupEvent } = firstPick;
                return (
                  <View key={firstPick.eventId} style={styles.eventGroup}>
                    {/* Event header — shown once per event */}
                    <TouchableOpacity
                      style={styles.eventRow}
                      onPress={() =>
                        navigation.navigate('Tournament', {
                          tournamentId: firstPick.tournamentId,
                          openEventId: firstPick.eventId,
                        })
                      }
                      activeOpacity={0.7}
                    >
                      <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
                      <Text
                        style={[styles.eventLabel, { color: colors.mutedForeground }]}
                        numberOfLines={1}
                      >
                        {groupEvent?.title ?? ''}
                        {firstPick.tournamentName ? `  ·  ${firstPick.tournamentName}` : ''}
                      </Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.mutedForeground} />
                    </TouchableOpacity>

                    {/* All bets for this event */}
                    {group.map((pickData: any, idx: number) => {
                      const { bet, pick, event } = pickData;
                      const displaySelection =
                        typeof pick.selection === 'object'
                          ? `${pick.selection.home ?? 0} - ${pick.selection.away ?? 0}`
                          : pick.selection;
                      const mergedBet = liveTotals[pickData.betId]
                        ? { ...bet, ...liveTotals[pickData.betId] }
                        : bet;
                      const isSettled = bet.status === 'settled' || bet.status === 'cancelled';
                      const pickKey = `${pickData.tournamentId}-${pickData.betId}-${idx}`;
                      const betCard = (
                        <View
                          key={pickKey}
                          style={styles.pickWrapper}
                        >
                          <BetCardCompact
                            bet={mergedBet}
                            theme={theme}
                            onOptionPress={(option: string) => {
                              if (bet.status === 'open' || bet.status === 'pending') {
                                openBetModal(mergedBet, event, pickData.tournamentId, option, displaySelection, pick.stakeAmount);
                              }
                            }}
                            userSelection={displaySelection}
                            disabled={bet.status !== 'open' && bet.status !== 'pending'}
                            showOdds
                            onCancel={(bet.status === 'open' || bet.status === 'pending') ? () => confirmCancel(pickData) : undefined}
                          />
                        </View>
                      );
                      if (isSettled) {
                        return (
                          <SwipeableRow
                            key={pickKey}
                            actions={[
                              {
                                label: 'Borrar',
                                icon: 'trash-outline',
                                color: colors.destructive,
                                onPress: () => setDismissedKeys(prev => {
                                  const s = new Set(prev);
                                  s.add(`${pickData.tournamentId}-${pickData.betId}`);
                                  return s;
                                }),
                              },
                            ]}
                          >
                            {betCard}
                          </SwipeableRow>
                        );
                      }
                      return betCard;
                    })}
                  </View>
                );
            })
          )}
        </ScrollView>

        {/* Bet confirmation modal */}
        <BetModal
          visible={showBetModal}
          bet={modalBet}
          event={modalEvent}
          option={modalOption}
          odd={modalOdd}
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          confirmingBet={confirmingBet}
          betFeedback={betFeedback}
          onClose={() => setShowBetModal(false)}
          onConfirm={handleConfirmBet}
          currentPick={modalCurrentPick}
          currentPickStake={modalCurrentPickStake}
        />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  contentContainer: { padding: 14, paddingBottom: 80 },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: 14 },
  header: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 4 },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
  },
  tabText: { fontSize: 14, fontWeight: '600' },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    gap: Spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  pickWrapper: { marginBottom: 4 },
  eventGroup: { marginBottom: 14 },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  eventLabel: { flex: 1, fontSize: 13, fontWeight: '500' },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 6,
    paddingTop: 3,
    paddingHorizontal: 4,
  },
  cancelText: { fontSize: 12, fontWeight: '500' },
});

export default TournamentPredictionsScreen;