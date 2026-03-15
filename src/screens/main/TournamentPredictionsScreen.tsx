import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { SwipeableRow, BetCardCompact } from '../../components/BetanoComponents';
import BetModal from '../tournament/components/BetModal';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
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

/**
 * Minimum time (ms) the loading bar stays visible after loadData completes.
 * Prevents flicker when the network responds faster than a single render frame.
 */
const MIN_LOADING_MS = 600;

const TournamentPredictionsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
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
  // Ref for debouncing background refreshes after optimistic actions (confirm / cancel pick)
  const deferredRefreshRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted dismissed keys when user is known
  useEffect(() => {
    if (!user) return;
    const storageKey = `dismissed_picks_${user.uid}`;
    AsyncStorage.getItem(storageKey).then((val) => {
      if (val) {
        try { setDismissedKeys(new Set(JSON.parse(val))); } catch {}
      }
    }).catch(() => {});
  }, [user?.uid]);

  // Persist dismissed keys whenever they change
  useEffect(() => {
    if (!user) return;
    AsyncStorage.setItem(
      `dismissed_picks_${user.uid}`,
      JSON.stringify([...dismissedKeys]),
    ).catch(() => {});
  }, [dismissedKeys, user]);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  // Cleanup picks listeners and any pending deferred refresh on unmount
  useEffect(() => {
    return () => {
      Object.values(picksUnsubsRef.current).forEach(u => { u(); });
      if (deferredRefreshRef.current) clearTimeout(deferredRefreshRef.current);
    };
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  const loadData = async () => {
    if (!user) return;
    // PERF: isLoading is now tied to the real data cycle instead of a fixed timer.
    // The loading bar stays visible until data is fully fetched and state is set.
    setIsLoading(true);
    const _loadStart = Date.now(); // used in finally to enforce MIN_LOADING_MS
    try {
      const allOpenPicks: any[] = [];
      const allSettledPicks: any[] = [];
      // NOTE: do NOT reset dismissedKeys here — they are persisted across reloads

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

      // ── Smart listener diffing ─────────────────────────────────────────────
      // PERF: Instead of tearing down ALL listeners and recreating them on every
      // loadData(), we compute a diff: unsub only bets that left the open list,
      // subscribe only to bets that are newly open. Unchanged bets keep their
      // existing listener without any interruption.
      const newOpenBetIds = new Set(allOpenPicks.map((pd: any) => pd.betId as string));
      const existingBetIds = Object.keys(picksUnsubsRef.current);

      // Unsubscribe listeners for bets no longer in the open list
      existingBetIds.forEach(betId => {
        if (!newOpenBetIds.has(betId)) {
          picksUnsubsRef.current[betId]?.();
          delete picksUnsubsRef.current[betId];
        }
      });

      // Remove stale liveTotals entries to keep state consistent
      setLiveTotals(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(betId => {
          if (!newOpenBetIds.has(betId)) delete next[betId];
        });
        return next;
      });

      // Subscribe only to bets not already being listened to
      for (const pd of allOpenPicks) {
        if (picksUnsubsRef.current[pd.betId]) continue; // already subscribed — skip
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
      // Enforce minimum visible loading time to avoid flicker on fast networks
      const elapsed = Date.now() - _loadStart;
      const remaining = MIN_LOADING_MS - elapsed;
      if (remaining > 0) await new Promise<void>(res => setTimeout(res, remaining));
      setIsLoading(false);        // ← tied to real data cycle, not an arbitrary timer
      setInitialLoadDone(true);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  // ── Deferred background refresh ───────────────────────────────────────────
  // PERF: Debounces loadData so rapid optimistic actions (confirm / cancel pick)
  // don't stack multiple full reloads. The 1.5 s window lets the user interact
  // immediately after an action while still syncing state from Firestore.
  const scheduleDeferredRefresh = () => {
    if (deferredRefreshRef.current) clearTimeout(deferredRefreshRef.current);
    deferredRefreshRef.current = setTimeout(() => { loadData(); }, 1500);
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
        // Deferred refresh — optimistic pick update already applied above;
        // background sync runs 1.5 s after modal closes to avoid blocking UX.
        scheduleDeferredRefresh();
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
              showToast({ type: 'error', message: 'Sesión expirada. Vuelve a iniciar sesión.' });
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
              // Deferred refresh — optimistic removal already updated the UI;
              // background sync reconciles state without blocking interaction.
              scheduleDeferredRefresh();
            } catch {
              loadData(); // immediate reload to restore correct state after error
              showToast({ type: 'error', message: 'No se pudo cancelar la apuesta.' });
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

  // Group picks by event so the event header shows only once per event.
  // Groups are sorted by most-recent activity desc; picks within each group too.
  const groupedPicks = useMemo(() => {
    // Use compound key to avoid collisions across tournaments with same eventId
    const groupMap: Record<string, any[]> = {};
    currentPicks.forEach((p: any) => {
      const key = `${p.tournamentId}__${p.eventId}`;
      if (!groupMap[key]) groupMap[key] = [];
      groupMap[key].push(p);
    });

    /** Safe ms extractor for Firestore Timestamp, plain object, or null */
    const getTs = (v: any): number => {
      if (!v) return 0;
      if (typeof v.toMillis === 'function') return v.toMillis();
      if (v.seconds) return v.seconds * 1000;
      return 0;
    };

    /** Activity timestamp for a single pick entry depending on active tab */
    const getPickTs = (p: any): number => {
      if (activeTab === 'settled') {
        // Prioritise result update time so newly-resolved bets float to the top
        return (
          getTs(p.bet?.resultUpdatedAt) ||
          getTs(p.bet?.updatedAt) ||
          getTs(p.pick?.updatedAt)
        );
      }
      // Open tab: use the latest of pick, bet, or event update
      return Math.max(
        getTs(p.pick?.updatedAt),
        getTs(p.bet?.updatedAt),
        getTs(p.event?.updatedAt),
      );
    };

    const groups = Object.values(groupMap);

    // Sort picks within each group newest-activity first
    groups.forEach((group) => {
      group.sort((a: any, b: any) => getPickTs(b) - getPickTs(a));
    });

    // Sort groups by the highest activity timestamp in the group
    groups.sort((gA: any[], gB: any[]) => {
      const tsA = gA.reduce((m, p) => Math.max(m, getPickTs(p)), 0);
      const tsB = gB.reduce((m, p) => Math.max(m, getPickTs(p)), 0);
      return tsB - tsA;
    });

    return groups;
  }, [currentPicks, activeTab]);

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
                  <View key={`${firstPick.tournamentId}-${firstPick.eventId}`} style={styles.eventGroup}>
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
                                onPress: () => {
                                  const key = `${pickData.tournamentId}-${pickData.betId}`;
                                  setDismissedKeys(prev => {
                                    const s = new Set(prev);
                                    s.add(key);
                                    return s;
                                  });
                                },
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