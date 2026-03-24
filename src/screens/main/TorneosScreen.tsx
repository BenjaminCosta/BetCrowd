import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTooltip } from '../../hooks/useTooltip';
import { ContextualTooltip } from '../../components/ContextualTooltip';
import {
  Alert,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Animated,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { LoadingBar } from '../../components/LoadingBar';
import { EmptyState } from '../../components/CommonComponents';
import { SwipeableRow, SwipeableRowHandle } from '../../components/BetanoComponents';
import { FloatingActionButton } from '../../components/FloatingActionButton';
import { SheetModal } from '../../components/SheetModal';
import CreateTournamentForm from '../../components/forms/CreateTournamentForm';
import JoinCodeForm from '../../components/forms/JoinCodeForm';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { useTournaments } from '../../context/TournamentsContext';
import {
  getTournamentMemberCount,
  deleteTournamentSoft,
  Tournament,
} from '../../services/tournamentService';
import { LinearGradient } from 'expo-linear-gradient';

// ─── Types ────────────────────────────────────────────────────────────────────

type TorneoFilter = 'active' | 'finished';

const FILTER_LABELS: { key: TorneoFilter; label: string }[] = [
  { key: 'active', label: 'Activos' },
  { key: 'finished', label: 'Finalizados' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  liga: 'Liga',
  eliminatoria: 'Eliminatoria',
  'grupos-eliminatoria': 'Grupos + Eliminatoria',
  'evento-unico': 'Evento único',
  serie: 'Serie (Bo3/Bo5)',
  bracket: 'Eliminación Directa',
  points: 'Puntos',
  otro: 'Otro',
};

const getFormatLabel = (formatId: string) => FORMAT_LABELS[formatId] || formatId;

const getFormatIcon = (formatId: string): string => {
  const icons: Record<string, string> = {
    liga: 'trophy',
    eliminatoria: 'git-branch',
    'grupos-eliminatoria': 'grid',
    'evento-unico': 'flag',
    serie: 'list',
    bracket: 'git-branch',
    points: 'analytics',
    otro: 'ellipsis-horizontal',
  };
  return icons[formatId] || 'trophy';
};

// ─── Main Screen ─────────────────────────────────────────────────────────────

const TorneosScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
  const { tournaments, adminStatuses, loading, refreshing, refresh } = useTournaments();

  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState<TorneoFilter>('active');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showJoinCodeSheet, setShowJoinCodeSheet] = useState(false);

  // ── T-01: swipe admin tooltip ─────────────────────────────────────────────
  const { seen: swipeTipSeen, markSeen: markSwipeSeen, loaded: swipeTipLoaded } =
    useTooltip('swipe_torneo_admin');
  const [showSwipeTooltip, setShowSwipeTooltip] = useState(false);
  const firstAdminCardRef = useRef<any>(null);
  const firstAdminSwipeRef = useRef<SwipeableRowHandle>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const tooltipFade = useRef(new Animated.Value(0)).current;
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overdueButtonRefs = useRef<Record<string, any>>({});

  // ── Member counts (lazy, cached) ──────────────────────────────────────────

  useEffect(() => {
    if (tournaments.length === 0) return;
    let cancelled = false;
    const active = tournaments.filter((t) => t.status !== 'deleted');
    const counts: Record<string, number> = {};
    Promise.all(
      active.map(async (t) => {
        try { counts[t.id] = await getTournamentMemberCount(t.id); }
        catch { counts[t.id] = 0; }
      }),
    ).then(() => { if (!cancelled) setMemberCounts(counts); }).catch(() => {});
    return () => { cancelled = true; };
  }, [tournaments]);

  const onRefresh = () => refresh();

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filteredTournaments = useMemo(() => {
    const list = tournaments.filter((t) => {
      if (filter === 'active') return t.status === 'active' || t.status === 'locked';
      if (filter === 'finished') return t.status === 'finished';
      return false;
    });
    list.sort((a, b) => {
      const aTime = (a as any).lastActivityAt?.toMillis?.() ?? (a as any).createdAt?.toMillis?.() ?? 0;
      const bTime = (b as any).lastActivityAt?.toMillis?.() ?? (b as any).createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    return list;
  }, [tournaments, filter]);

  // The id of the first admin tournament in the filtered list so renderTournamentCard
  // can attach firstAdminCardRef without mutating a ref during render.
  const firstAdminId = useMemo(
    () => filteredTournaments.find((t) => adminStatuses[t.id])?.id ?? null,
    [filteredTournaments, adminStatuses],
  );

  // Show T-01 swipe tooltip once the first admin card is on screen
  useEffect(() => {
    if (swipeTipSeen || !swipeTipLoaded) return;
    const hasAdmin = filteredTournaments.some((t) => adminStatuses[t.id]);
    if (!hasAdmin) return;
    const timer = setTimeout(() => setShowSwipeTooltip(true), 700);
    return () => clearTimeout(timer);
  }, [swipeTipSeen, swipeTipLoaded, filteredTournaments, adminStatuses]);

  // Auto-swipe demo: when tooltip shows, open then close the first admin card
  useEffect(() => {
    if (!showSwipeTooltip) return;
    const t1 = setTimeout(() => firstAdminSwipeRef.current?.openRight(), 900);
    const t2 = setTimeout(() => firstAdminSwipeRef.current?.close(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [showSwipeTooltip]);

  // ── Swipe actions ─────────────────────────────────────────────────────────

  const handleEdit = (t: Tournament) => {
    navigation.navigate('TournamentSettings', { tournamentId: t.id });
  };

  const handleDelete = (t: Tournament) => {
    Alert.alert(
      'Eliminar torneo',
      `¿Estás seguro que deseas eliminar "${t.name}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTournamentSoft(t.id);
              // El listener de TournamentsContext actualizará la lista automáticamente
            } catch (e: any) {
              showToast({ type: 'error', message: e.message || 'No se pudo eliminar el torneo' });
            }
          },
        },
      ]
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const renderTabsControl = () => {
    const activeCount = tournaments.filter(
      (t) => t.status === 'active' || t.status === 'locked',
    ).length;
    const finishedCount = tournaments.filter((t) => t.status === 'finished').length;
    const counts: Record<TorneoFilter, number> = { active: activeCount, finished: finishedCount };

    return (
      <View style={[styles.tabsBar, { borderBottomColor: colors.border }]}>
        {FILTER_LABELS.map(({ key, label }) => {
          const isActive = filter === key;
          return (
            <TouchableOpacity
              key={key}
              style={[
                styles.tabItem,
                isActive && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setFilter(key)}
            >
              <Text
                style={[
                  styles.tabItemText,
                  { color: isActive ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label} ({counts[key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const showOverdueTooltip = (tournamentId: string) => {
    const ref = overdueButtonRefs.current[tournamentId];
    if (!ref) return;
    ref.measureInWindow((x: number, y: number, w: number, _h: number) => {
      // Tooltip más centrado a la izquierda - reducimos el offset y aseguramos que no se salga
      const left = Math.max(5, Math.min(x - 200 + w / 2, 120));
      setTooltipPos({ top: y - 70, left });
      setTooltipVisible(true);
      tooltipFade.setValue(0);
      Animated.timing(tooltipFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(() => {
        Animated.timing(tooltipFade, { toValue: 0, duration: 150, useNativeDriver: true }).start(() =>
          setTooltipVisible(false)
        );
      }, 3000);
    });
  };

  const getRoleInfo = (tournamentId: string) => {
    const isAdmin = adminStatuses[tournamentId] ?? false;
    if (isAdmin) return { label: 'Admin',   icon: 'shield-checkmark-outline' as const, color: colors.mutedForeground };
    return           { label: 'Miembro', icon: 'person-outline' as const,           color: colors.mutedForeground };
  };

  const renderTournamentCard = useCallback(({ item: t }: { item: Tournament }) => {
    const isOwner = adminStatuses[t.id] ?? false;
    const count = memberCounts[t.id] ?? 0;
    const max = Math.max(t.participantsEstimated || 1, 1);
    const roleInfo = getRoleInfo(t.id);
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = t.status === 'active' && !!t.endDate && t.endDate < today;

    // Attach ref to the first admin card for the swipe tooltip spotlight
    const isFirstAdmin = t.id === firstAdminId;

    return (
      <SwipeableRow
        ref={isFirstAdmin ? firstAdminSwipeRef : undefined}
        enabled={isOwner}
        actions={[
          {
            label: 'Editar',
            icon: 'create-outline',
            color: colors.primary,
            onPress: () => handleEdit(t),
          },
          {
            label: 'Eliminar',
            icon: 'trash-outline',
            color: colors.destructive,
            onPress: () => handleDelete(t),
          },
        ]}
      >
        <TouchableOpacity
          ref={isFirstAdmin ? firstAdminCardRef : undefined}
          style={[styles.card, { backgroundColor: colors.card }]}
          onPress={() => navigation.navigate('Tournament', { tournamentId: t.id })}
          activeOpacity={0.7}
        >
          {/* Gradient overlay */}
          <LinearGradient
            colors={[colors.primary + '10', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />

          {/* Header: name + format badge */}
          <View style={styles.cardHeader}>
            <View style={styles.cardInfo}>
              <Text style={[styles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                {t.name}
              </Text>
              <View style={styles.cardFormatRow}>
                <Ionicons name={getFormatIcon(t.format) as any} size={12} color={colors.primary} />
                <Text style={[styles.cardFormat, { color: colors.mutedForeground }]}>
                  {getFormatLabel(t.format)}
                </Text>
              </View>
            </View>
            <View style={[styles.cardRoleBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <Ionicons name={roleInfo.icon} size={13} color={roleInfo.color} />
              <Text style={[styles.cardRoleText, { color: roleInfo.color }]}>{roleInfo.label}</Text>
            </View>
          </View>

          <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

          {/* Footer: participants + finalizado badge + overdue indicator */}
          <View style={styles.cardFooter}>
            <View style={styles.cardMeta}>
              <View style={styles.cardMetaItem}>
                <View style={[styles.cardMetaIconCircle, { backgroundColor: colors.secondary }]}>
                  <Ionicons name="people" size={14} color={colors.primary} />
                </View>
                <Text style={[styles.cardMetaText, { color: colors.foreground }]}>
                  {count}/{max} participantes
                </Text>
              </View>
            </View>
            {t.status === 'finished' && (
              <View
                style={[
                  styles.cardFinishedBadge,
                  { backgroundColor: colors.primary + '18', borderColor: colors.primary + '40' },
                ]}
              >
                <Text style={[styles.cardFinishedText, { color: colors.primary }]}>FINALIZADO</Text>
              </View>
            )}
            {isOverdue && (
              <TouchableOpacity
                ref={(r) => { overdueButtonRefs.current[t.id] = r; }}
                onPress={() => showOverdueTooltip(t.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </SwipeableRow>
    );
  }, [memberCounts, adminStatuses, firstAdminId, navigation, handleEdit, handleDelete, showOverdueTooltip, colors]);

  const renderEmpty = () => (
    <View style={styles.emptyWrapper}>
      <EmptyState
        iconName="trophy-outline"
        title={filter === 'active' ? 'Sin torneos activos' : 'Sin torneos finalizados'}
        message={
          filter === 'active'
            ? 'Crea un torneo o únete a uno con un código de invitación'
            : 'Los torneos finalizados aparecer\u00e1n aqu\u00ed'
        }
      />
      {filter === 'active' && (
        <>
          <TouchableOpacity
            style={[styles.ctaButton, { backgroundColor: colors.primary }]}
            onPress={() => setShowCreateSheet(true)}
          >
            <Text style={styles.ctaButtonText}>Crear torneo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.ctaButtonOutline, { borderColor: colors.border }]}
            onPress={() => setShowJoinCodeSheet(true)}
          >
            <Text style={[styles.ctaButtonOutlineText, { color: colors.foreground }]}>
              Unirme con código
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando torneos...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <LoadingBar isLoading={refreshing} />

        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>Torneos</Text>
          <TouchableOpacity
            style={[styles.joinBtn, { backgroundColor: colors.primary + '07', borderColor: colors.primary + '40' , borderWidth: 1 }]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            onPress={() => setShowJoinCodeSheet(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="key-outline" size={14} color={colors.primary} />
            <Text style={[styles.joinBtnText, { color: colors.primary }]} >Unirse con código</Text>
          </TouchableOpacity>
        </View>

        {renderTabsControl()}

        <FlatList
          data={filteredTournaments}
          keyExtractor={(item) => item.id}
          renderItem={renderTournamentCard}
          contentContainerStyle={[
            styles.listContent,
            filteredTournaments.length === 0 && styles.listContentEmpty,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={renderEmpty}
          showsVerticalScrollIndicator={false}
        />

        {/* FAB — Crear torneo */}
        <FloatingActionButton onPress={() => setShowCreateSheet(true)} />

        {/* Floating overdue tooltip - AHORA MÁS CENTRADO A LA IZQUIERDA */}
        <Modal visible={tooltipVisible} transparent animationType="none" statusBarTranslucent>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setTooltipVisible(false)}>
            <Animated.View
              style={[
                styles.floatingTooltip,
                {
                  top: tooltipPos.top,
                  left: tooltipPos.left,
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  opacity: tooltipFade,
                },
              ]}
            >
              <Ionicons name="time-outline" size={13} color={colors.mutedForeground} />
              <Text style={[styles.floatingTooltipText, { color: colors.mutedForeground }]}>
                Este torneo superó su fecha de cierre. 
              </Text>
            </Animated.View>
          </TouchableOpacity>
        </Modal>
      </View>

      {/* Create Tournament Sheet */}
      <SheetModal
        visible={showCreateSheet}
        onClose={() => setShowCreateSheet(false)}
      >
        <CreateTournamentForm
          onSuccess={() => setShowCreateSheet(false)}
        />
      </SheetModal>
      {/* Join Code Sheet */}
      <SheetModal
        visible={showJoinCodeSheet}
        onClose={() => setShowJoinCodeSheet(false)}
      >
        <JoinCodeForm
          onJoined={(tournamentId) => {
            setShowJoinCodeSheet(false);
            navigation.navigate('Tournament', { tournamentId });
          }}
        />
      </SheetModal>

      {/* T-01: swipe tooltip for admin tournament cards */}
      <ContextualTooltip
        visible={showSwipeTooltip}
        onDismiss={() => { setShowSwipeTooltip(false); markSwipeSeen(); }}
        title="Gestionar torneo"
        message="Deslizá una tarjeta hacia la izquierda para editarla o eliminarla."
        targetRef={firstAdminCardRef}
        bubblePosition="bottom"
        showSwipeHint
      />
    </GestureHandlerRootView>
  );
};

export default TorneosScreen;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: { fontSize: 14 },

  // Header
  header: {
    paddingHorizontal: 14,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 28, fontWeight: '700', marginBottom: Spacing.sm },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  joinBtnText: { fontSize: 12, fontWeight: '700' },

  // Tabs underline (same style as TournamentPredictionsScreen)
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 14,
    marginBottom: Spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabItemText: {
    fontSize: 14,
    fontWeight: '600',
  },

  // FlatList
  listContent: { padding: 14, paddingBottom: 100 },
  listContentEmpty: { flex: 1, justifyContent: 'center' as const },

  // Empty state
  emptyWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButton: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  ctaButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  ctaButtonOutline: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  ctaButtonOutlineText: { fontSize: 15, fontWeight: '600' },

  // Tournament card
  card: {
    borderRadius: 16,
    padding: 14,
    marginBottom: 13,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardTitle: { flex: 1, fontSize: 17, fontWeight: '700' },
  cardFormat: { fontSize: 13, fontWeight: '500' },
  cardDivider: { height: 1, marginBottom: 10 },

  // Card layout
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardInfo: { flex: 1, marginRight: 12, gap: 4 },
  cardFormatRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  cardRoleText: { fontSize: 11, fontWeight: '500' },
  cardBadgeStack: { alignItems: 'flex-end', gap: 4 },
  cardFinishedBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  cardFinishedText: { fontSize: 10, fontWeight: '700' },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  cardMeta: { flex: 1, gap: 6 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardMetaIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardMetaText: { fontSize: 13, fontWeight: '500' },
  floatingTooltip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxWidth: 260,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 10,
  },
  floatingTooltipText: { flex: 1, fontSize: 12, lineHeight: 16 },
});