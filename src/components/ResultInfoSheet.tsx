import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { Bet, calculateOdds } from '../services/betService';

// Strip 'de ' from over/under labels: 'Más de 2.5' → 'Más 2.5'
const fmt = (s: string) =>
  s.replace(/Más de /g, 'Más ').replace(/Menos de /g, 'Menos ');

// ─── Props ────────────────────────────────────────────────────────────────────

export interface ResultInfoSheetProps {
  visible: boolean;
  onClose: () => void;
  bet: Bet;
  userSelection: string | null;
  theme: 'light' | 'dark';
  /** Optional "Home vs Away" label shown above the bet title */
  eventTitle?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ResultInfoSheet: React.FC<ResultInfoSheetProps> = ({
  visible,
  onClose,
  bet,
  userSelection,
  theme,
  eventTitle,
}) => {
  const colors = Colors[theme];

  const badgeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && userSelection && bet.status === 'settled') {
      badgeAnim.setValue(0);
      Animated.spring(badgeAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 80,
        friction: 8,
      }).start();
    }
  }, [visible]);

  if (!userSelection || bet.status !== 'settled') return null;

  // ── Win / loss logic ──────────────────────────────────────────────────────
  const isVoid = !!bet.result?.void;

  const isWinningOption = (option: string): boolean => {
    if (bet.result?.void) return false;
    if (bet.type === 'score') {
      const score = bet.result?.score;
      if (!score) return false;
      const m = option.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!m) return false;
      return parseInt(m[1], 10) === score.home && parseInt(m[2], 10) === score.away;
    }
    return !!bet.result?.winner && bet.result.winner === option;
  };

  const hasNoWinner = !bet.options.some(isWinningOption);
  const userWon  = !isVoid && !hasNoWinner && isWinningOption(userSelection);
  const userLost = !isVoid && !hasNoWinner && !isWinningOption(userSelection);
  const winnerOption = isVoid || hasNoWinner ? null : (bet.result?.winner ?? null);

  // ── Payout (fixed-stake only) ─────────────────────────────────────────────
  let payoutAmount: number | null = null;
  if (userWon && bet.stakeType === 'fixed' && (bet.stakeAmount ?? 0) > 0) {
    const odds = calculateOdds(bet);
    const n = parseFloat(odds[userSelection] ?? '') || 0;
    if (n > 0) payoutAmount = (bet.stakeAmount ?? 0) * n;
  }

  // ── Status visuals ────────────────────────────────────────────────────────
  const statusColor =
    isVoid || hasNoWinner ? '#8B8D97' : userWon ? '#10B981' : '#DC2E4B';
  const statusIcon: any =
    isVoid || hasNoWinner
      ? 'remove-circle-outline'
      : userWon
      ? 'checkmark-circle'
      : 'close-circle';
  const statusLabel =
    isVoid
      ? 'Apuesta nula'
      : hasNoWinner
      ? 'Sin resultado'
      : userWon
      ? '¡Ganaste!'
      : 'Perdiste';

  const eventTitleParts = eventTitle ? eventTitle.split(/\s+vs\.?\s+/i) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={[styles.sheet, { backgroundColor: colors.card }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>
                Tu apuesta
              </Text>
              <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
                Apuesta resuelta
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* ── Event / bet info ── */}
          <View style={styles.eventInfo}>
            {eventTitle ? (
              <View style={styles.eventTitleRow}>
                {eventTitleParts && eventTitleParts.length === 2 ? (
                  <>
                    <Text style={[styles.teamLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {eventTitleParts[0]}
                    </Text>
                    <Text style={[styles.vsLabel, { color: colors.mutedForeground }]}>vs</Text>
                    <Text style={[styles.teamLabel, { color: colors.foreground }]} numberOfLines={1}>
                      {eventTitleParts[1]}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.teamLabel, { color: colors.foreground }]} numberOfLines={1}>
                    {eventTitle}
                  </Text>
                )}
              </View>
            ) : null}
            <Text
              style={[styles.betTitle, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {bet.title}
            </Text>
          </View>

          {/* ── Status badge ── */}
          <Animated.View
            style={[
              styles.statusBlock,
              { backgroundColor: statusColor + '18' },
              {
                opacity: badgeAnim,
                transform: [{
                  scale: badgeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }),
                }],
              },
            ]}
          >
            <Ionicons name={statusIcon} size={40} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </Animated.View>

          {/* ── Selection block ── */}
          <View style={[styles.selectionBlock, { backgroundColor: colors.muted }]}>
            <View style={styles.selectionItem}>
              <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>
                Tu selección
              </Text>
              <Text
                style={[
                  styles.selectionValue,
                  {
                    color: userWon
                      ? '#10B981'
                      : userLost
                      ? '#DC2E4B'
                      : colors.foreground,
                  },
                ]}
              >
                {fmt(userSelection)}
              </Text>
            </View>

            {userLost && winnerOption ? (
              <>
                <View
                  style={[styles.selectionDivider, { backgroundColor: colors.border }]}
                />
                <View style={[styles.selectionItem, { alignItems: 'flex-end' }]}>
                  <Text style={[styles.selectionLabel, { color: colors.mutedForeground }]}>
                    Ganó
                  </Text>
                  <Text style={[styles.selectionValue, { color: '#10B981' }]}>
                    {fmt(winnerOption)}
                  </Text>
                </View>
              </>
            ) : null}
          </View>

          {/* ── Money rows (fixed-stake only) ── */}
          {bet.stakeType === 'fixed' && (bet.stakeAmount ?? 0) > 0 ? (
            <View style={styles.moneySection}>
              <View style={[styles.moneyRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>
                  Apostaste
                </Text>
                <Text style={[styles.moneyValue, { color: colors.foreground }]}>
                  ${(bet.stakeAmount ?? 0).toLocaleString('es-AR')}
                </Text>
              </View>
              {payoutAmount != null ? (
                <View style={[styles.moneyRow, { borderBottomWidth: 0 }]}>
                  <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>
                    Ganancia estimada
                  </Text>
                  <Text style={[styles.moneyValueLarge, { color: '#10B981' }]}>
                    ${payoutAmount.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Close CTA ── */}
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.primary }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeBtnText, { color: '#FFF' }]}>Cerrar</Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  headerSub: { fontSize: 12, lineHeight: 17 },
  eventInfo: { gap: 2 },
  eventTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  teamLabel: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  vsLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  betTitle: { fontSize: 12 },
  statusBlock: {
    borderRadius: BorderRadius.md,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  statusText: { fontSize: 20, fontWeight: '800' },
  selectionBlock: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectionItem: { flex: 1 },
  selectionDivider: { width: 1, height: 36, marginHorizontal: Spacing.md },
  selectionLabel: {
    fontSize: 11,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  selectionValue: { fontSize: 16, fontWeight: '700' },
  moneySection: { gap: 0 },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moneyLabel: { fontSize: 13 },
  moneyValue: { fontSize: 14, fontWeight: '600' },
  moneyValueLarge: { fontSize: 18, fontWeight: '800' },
  closeBtn: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  closeBtnText: { fontSize: 16, fontWeight: '600' },
});
