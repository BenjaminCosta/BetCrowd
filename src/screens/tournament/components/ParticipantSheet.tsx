import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Gradients, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card } from '../../../components/CommonComponents';
import { UserBalance, getUserPickHistory, UserPickHistory } from '../../../services/groupsService';
import { getMyTournamentRole } from '../../../services/tournamentService';
import { getInitials, formatBalance } from '../../../utils/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

type SheetView = 'summary' | 'history';
type HistoryFilter = 'won' | 'lost';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ParticipantSheetProps {
  visible: boolean;
  onClose: () => void;
  participant: UserBalance | null;
  position: number; // 1-based rank
  tournamentId: string;
}

// ─── Local helpers ──────────────────────────────────────────────────────────────────

const formatAmount = (n: number) => `$${n.toFixed(0)}`;

const getRoleInfo = (role: string | null) => {
  switch (role) {
    case 'owner': return { label: 'Organizador', color: '#F59E0B' };
    case 'admin':  return { label: 'Admin',        color: '#D7263D' };
    default:       return null;
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

const ParticipantSheet: React.FC<ParticipantSheetProps> = ({
  visible,
  onClose,
  participant,
  position,
  tournamentId,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [view, setView] = useState<SheetView>('summary');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('won');
  const [pickHistory, setPickHistory] = useState<UserPickHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [memberRole, setMemberRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);

  // ── Reset when sheet closes / participant changes ────────────────────────────────────────────
  useEffect(() => {
    if (!visible) {
      setView('summary');
      setPickHistory([]);
      setHistoryFilter('won');
      setMemberRole(null);
      setHistoryError(false);
    }
  }, [visible]);

  // ── Load role + pick history when sheet opens ────────────────────────────────
  useEffect(() => {
    if (!visible || !participant) return;
    setRoleLoading(true);
    getMyTournamentRole(tournamentId, participant.uid)
      .then((role) => setMemberRole(role))
      .catch(() => setMemberRole(null))
      .finally(() => setRoleLoading(false));
    setHistoryLoading(true);
    setHistoryError(false);
    getUserPickHistory(tournamentId, participant.uid)
      .then(setPickHistory)
      .catch((e) => {
        console.error('ParticipantSheet history:', e);
        setHistoryError(true);
      })
      .finally(() => setHistoryLoading(false));
  }, [visible, participant?.uid, tournamentId]);

  const handleViewHistory = (filter: HistoryFilter) => {
    setHistoryFilter(filter);
    setView('history');
  };

  // ── Derived stats (from pre-computed ranking data — no extra load needed) ─────
  const wonCount = participant?.wonCount ?? 0;
  const lostCount = participant?.lostCount ?? 0;
  const totalPlayed = wonCount + lostCount;
  const winRate = totalPlayed > 0 ? Math.round((wonCount / totalPlayed) * 100) : 0;

  const filteredHistory = pickHistory.filter((p) => p.result === historyFilter);

  const balanceColor =
    (participant?.netBalance ?? 0) > 0
      ? colors.success
      : (participant?.netBalance ?? 0) < 0
      ? colors.destructive
      : colors.mutedForeground;

  const roleInfo = getRoleInfo(memberRole);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

          <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* ── Header ───────────────────────────────────────────────────── */}
            <View style={styles.headerRow}>
              {view === 'history' ? (
                <TouchableOpacity
                  onPress={() => setView('summary')}
                  style={styles.navBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.foreground} />
                </TouchableOpacity>
              ) : (
                <View style={styles.navBtn} />
              )}
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                {view === 'summary'
                  ? 'Participante'
                  : historyFilter === 'won'
                  ? 'Apuestas ganadas'
                  : 'Apuestas perdidas'}
              </Text>
              <TouchableOpacity
                onPress={onClose}
                style={styles.navBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* ── Summary ──────────────────────────────────────────────────── */}
            {view === 'summary' && participant && (
              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.summaryContent}
                showsVerticalScrollIndicator={false}
              >
                {/* Hero card */}
                <Card gradient style={styles.heroCard}>
                  <View style={styles.heroRow}>
                    {participant.photoURL ? (
                      <Image source={{ uri: participant.photoURL }} style={styles.avatar} />
                    ) : (
                      <LinearGradient
                        colors={Gradients.primary as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.avatarPlaceholder}
                      >
                        <Text style={styles.avatarInitials}>
                          {getInitials(participant.username || participant.displayName)}
                        </Text>
                      </LinearGradient>
                    )}
                    <View style={styles.heroInfo}>
                      <Text style={[styles.heroHandle, { color: colors.foreground }]} numberOfLines={1}>
                        {participant.username ? `@${participant.username}` : participant.displayName}
                      </Text>
                      {!!participant.displayName && !!participant.username && (
                        <Text style={[styles.heroDisplayName, { color: colors.mutedForeground }]} numberOfLines={1}>
                          {participant.displayName}
                        </Text>
                      )}
                      <View style={styles.badgesRow}>
                        <View style={[styles.rankBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.rankBadgeText, { color: colors.primary }]}>
                            #{position}
                          </Text>
                        </View>
                        {roleLoading ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : roleInfo ? (
                          <View style={[styles.roleBadge, { backgroundColor: roleInfo.color + '22' }]}>
                            <Text style={[styles.roleText, { color: roleInfo.color }]}>
                              {roleInfo.label}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                </Card>

                {/* Balance card */}
                <Card style={styles.balanceCard}>
                  <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                    Balance del torneo
                  </Text>
                  <Text style={[styles.balanceValue, { color: balanceColor }]}>
                    {formatBalance(participant.netBalance)}
                  </Text>
                  {(participant.totalWon > 0 || participant.totalLost > 0) && (
                    <View style={styles.balanceSubRow}>
                      <View style={styles.subChip}>
                        <View style={[styles.subDot, { backgroundColor: colors.success }]} />
                        <Text style={[styles.subAmt, { color: colors.success }]}>
                          +{formatAmount(participant.totalWon)}
                        </Text>
                        <Text style={[styles.subLbl, { color: colors.mutedForeground }]}> ganado</Text>
                      </View>
                      <View style={[styles.subSep, { backgroundColor: colors.border }]} />
                      <View style={styles.subChip}>
                        <View style={[styles.subDot, { backgroundColor: colors.destructive }]} />
                        <Text style={[styles.subAmt, { color: colors.destructive }]}>
                          -{formatAmount(participant.totalLost)}
                        </Text>
                        <Text style={[styles.subLbl, { color: colors.mutedForeground }]}> perdido</Text>
                      </View>
                    </View>
                  )}
                </Card>

                {/* Stats card */}
                {totalPlayed > 0 && (
                  <Card style={styles.statsCard}>
                    <View style={styles.statsRow}>
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.foreground }]}>{winRate}%</Text>
                        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Win rate</Text>
                      </View>
                      <View style={[styles.statSep, { backgroundColor: colors.border }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.foreground }]}>{totalPlayed}</Text>
                        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Jugadas</Text>
                      </View>
                      <View style={[styles.statSep, { backgroundColor: colors.border }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statValue, { color: colors.foreground }]}>
                          {formatAmount(participant.totalWon)}
                        </Text>
                        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Ganado</Text>
                      </View>
                    </View>
                  </Card>
                )}

                {/* W/L grid */}
                <View style={styles.wlGrid}>
                  <TouchableOpacity
                    style={styles.wlCardWrapper}
                    onPress={() => handleViewHistory('won')}
                    activeOpacity={0.7}
                  >
                    <Card style={[styles.wlCard, { borderWidth: 1, borderColor: colors.success + '35' }]}>
                      <View style={[styles.wlIcon, { backgroundColor: colors.success + '18' }]}>
                        <Ionicons name="trophy-outline" size={22} color={colors.success} />
                      </View>
                      <Text style={[styles.wlBigCount, { color: colors.foreground }]}>{wonCount}</Text>
                      <Text style={[styles.wlCardLabel, { color: colors.mutedForeground }]}>Ganadas</Text>
                    </Card>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.wlCardWrapper}
                    onPress={() => handleViewHistory('lost')}
                    activeOpacity={0.7}
                  >
                    <Card style={[styles.wlCard, { borderWidth: 1, borderColor: colors.destructive + '35' }]}>
                      <View style={[styles.wlIcon, { backgroundColor: colors.destructive + '18' }]}>
                        <Ionicons name="close-circle-outline" size={22} color={colors.destructive} />
                      </View>
                      <Text style={[styles.wlBigCount, { color: colors.foreground }]}>{lostCount}</Text>
                      <Text style={[styles.wlCardLabel, { color: colors.mutedForeground }]}>Perdidas</Text>
                    </Card>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* ── History ───────────────────────────────────────────────────── */}
            {view === 'history' && (
              <View style={{ flex: 1 }}>
                <View style={[styles.segControl, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  {(['won', 'lost'] as HistoryFilter[]).map((f) => {
                    const active = historyFilter === f;
                    return (
                      <TouchableOpacity
                        key={f}
                        style={[styles.segItem, active && { backgroundColor: colors.primary }]}
                        onPress={() => setHistoryFilter(f)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.segLabel, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                          {f === 'won' ? `Ganadas ${wonCount}` : `Perdidas ${lostCount}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {historyLoading ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color={colors.primary} />
                  </View>
                ) : historyError ? (
                  <View style={styles.centered}>
                    <Ionicons name="alert-circle-outline" size={40} color={colors.destructive} />
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Error al cargar</Text>
                    <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
                      No se pudo cargar el historial
                    </Text>
                  </View>
                ) : filteredHistory.length === 0 ? (
                  <View style={styles.centered}>
                    <Ionicons
                      name={historyFilter === 'won' ? 'trophy-outline' : 'close-circle-outline'}
                      size={40}
                      color={colors.mutedForeground}
                    />
                    <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Sin registros</Text>
                    <Text style={[styles.emptyMsg, { color: colors.mutedForeground }]}>
                      {historyFilter === 'won'
                        ? 'No hay apuestas ganadas todavía'
                        : 'No hay apuestas perdidas todavía'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.historyContent}
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredHistory.map((item) => (
                      <PickHistoryItem
                        key={`${item.eventId}-${item.betId}`}
                        item={item}
                        colors={colors}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

// ─── Pick History Item ────────────────────────────────────────────────────────

interface PickHistoryItemProps {
  item: UserPickHistory;
  colors: typeof Colors['dark'];
}

const PickHistoryItem: React.FC<PickHistoryItemProps> = ({ item, colors }) => {
  const isWon = item.result === 'won';
  const accent = isWon ? colors.success : colors.destructive;

  return (
    <View
      style={[
        styles.pickItem,
        { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: accent },
      ]}
    >
      <View style={styles.pickTopRow}>
        <Text style={[styles.pickEvent, { color: colors.mutedForeground }]} numberOfLines={1}>
          {item.eventTitle}
        </Text>
        <View style={[styles.resultPill, { backgroundColor: accent + '18' }]}>
          <Text style={[styles.resultPillText, { color: accent }]}>
            {isWon ? 'Ganada' : 'Perdida'}
          </Text>
        </View>
      </View>
      <Text style={[styles.pickTitle, { color: colors.foreground }]} numberOfLines={1}>
        {item.betTitle}
      </Text>
      <View style={styles.pickBottomRow}>
        <View style={[styles.selPill, { backgroundColor: colors.muted }]}>
          <Text style={[styles.selText, { color: colors.foreground }]} numberOfLines={1}>
            {item.selection}
          </Text>
        </View>
        <Text style={[styles.pickAmt, { color: accent }]}>
          {isWon ? '+' : '-'}${item.stakeAmount.toFixed(0)}
        </Text>
      </View>
    </View>
  );
};

export default ParticipantSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Layout
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  container: {
    height: '92%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },

  // Header
  headerRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  navBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },

  // Summary scroll
  scrollView: { flex: 1 },
  summaryContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 48,
    gap: Spacing.sm,
  },

  // Hero card
  heroCard: {},
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  avatarPlaceholder: {
    width: 76, height: 76, borderRadius: 38,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  avatarInitials: { fontSize: 22, fontWeight: '800', color: '#FFF' },
  heroInfo: { flex: 1, gap: 3 },
  heroHandle: { fontSize: 17, fontWeight: '800', flexShrink: 1 },
  heroDisplayName: { fontSize: 13 },
  badgesRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  rankBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  rankBadgeText: { fontSize: 12, fontWeight: '700' },
  roleBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  roleText: { fontSize: 11, fontWeight: '700' },

  // Balance card
  balanceCard: { gap: Spacing.xs },
  balanceLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  balanceValue: { fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36 },
  balanceSubRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs },
  subChip: { flexDirection: 'row', alignItems: 'center' },
  subDot: { width: 6, height: 6, borderRadius: 3, marginRight: 4 },
  subAmt: { fontSize: 13, fontWeight: '700' },
  subLbl: { fontSize: 12 },
  subSep: { width: 1, height: 14 },

  // Stats card
  statsCard: {},
  statsRow: { flexDirection: 'row' },
  statItem: { flex: 1, alignItems: 'center' as const, gap: 4, paddingVertical: Spacing.xs },
  statSep: { width: 1 },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase' as const, letterSpacing: 0.4 },

  // W/L grid
  wlGrid: { flexDirection: 'row', gap: Spacing.sm },
  wlCardWrapper: { flex: 1 },
  wlCard: { alignItems: 'center' as const, gap: Spacing.xs, paddingVertical: Spacing.lg },
  wlIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.xs,
  },
  wlBigCount: { fontSize: 28, fontWeight: '800' },
  wlCardLabel: { fontSize: 12, fontWeight: '500' },

  // History
  segControl: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg, marginBottom: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1,
    overflow: 'hidden', height: 40,
  },
  segItem: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: BorderRadius.sm, margin: 3 },
  segLabel: { fontSize: 13, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: Spacing.sm },
  emptyTitle: { fontSize: 17, fontWeight: '700' },
  emptyMsg: { fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.xl },
  historyContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },

  // Pick item
  pickItem: { borderRadius: BorderRadius.md, borderWidth: 1, borderLeftWidth: 3, padding: Spacing.md, gap: Spacing.xs },
  pickTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  pickEvent: { fontSize: 11, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.3, flex: 1 },
  resultPill: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  resultPillText: { fontSize: 10, fontWeight: '700' },
  pickTitle: { fontSize: 14, fontWeight: '700' },
  pickBottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, marginTop: 2 },
  pickAmt: { fontSize: 16, fontWeight: '800' },
  selPill: { alignSelf: 'flex-start', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  selText: { fontSize: 12, fontWeight: '600' },
});
