import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Bet, calculateEstimatedOdds } from '../../../services/betService';
import { Event } from '../../../services/eventService';


// ─── Props ────────────────────────────────────────────────────────────────────

interface BetModalProps {
  visible: boolean;
  bet: Bet | null;
  event: Event | null;
  option: string;
  odd: string;
  betAmount: string;
  setBetAmount: (v: string) => void;
  confirmingBet: boolean;
  betFeedback: string;
  onClose: () => void;
  onConfirm: () => void;
  currentPick?: string | null;
  currentPickStake?: number;
}

// ─── Tooltip messages ─────────────────────────────────────────────────────────

const TOOLTIPS = {
  odd: 'La cuota puede cambiar según las apuestas de otros participantes.',
  payout: 'El pago final se define al cerrar el evento y puede variar.',
} as const;
type TooltipKey = keyof typeof TOOLTIPS;

// ─── Component ────────────────────────────────────────────────────────────────

const BetModal: React.FC<BetModalProps> = ({
  visible,
  bet,
  event,
  option,
  odd,
  betAmount,
  setBetAmount,
  confirmingBet,
  betFeedback,
  onClose,
  onConfirm,
  currentPick,
  currentPickStake,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [activeTooltip, setActiveTooltip] = useState<TooltipKey | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ top: 0 });
  const tooltipAnim = useRef(new Animated.Value(0)).current;
  const updatedAnim = useRef(new Animated.Value(0)).current;
  const oddInfoRef = useRef<any>(null);
  const payoutInfoRef = useRef<any>(null);
  const prevPayoutRef = useRef<number | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animatingRef = useRef(false);

  // Derived values (safe defaults when bet/event is null)
  const isFreeStake = bet?.stakeType !== 'fixed';
  const amountNum = parseFloat(betAmount) || 0;
  const userStake = isFreeStake ? amountNum : (bet?.stakeAmount ?? 0);
  const estimatedOddStr = bet
    ? calculateEstimatedOdds(bet, option, userStake, currentPick ?? null, currentPickStake)
    : '—';
  const estimatedOddNum = parseFloat(estimatedOddStr) || 0;
  const currentOddNum = parseFloat(odd) || 0;
  const payout = isFreeStake
    ? amountNum * estimatedOddNum
    : (bet?.stakeAmount ?? 0) * estimatedOddNum;
  const alreadySelected = !!currentPick && currentPick === option;
  const pickGain = (currentPickStake ?? 0) * currentOddNum;

  // Flash "Actualizado" when payout changes while modal is open
  useEffect(() => {
    if (prevPayoutRef.current !== null && prevPayoutRef.current !== payout && payout > 0 && !animatingRef.current) {
      animatingRef.current = true;
      updatedAnim.setValue(0);
      Animated.sequence([
        Animated.timing(updatedAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(updatedAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => { animatingRef.current = false; });
    }
    prevPayoutRef.current = payout;
  }, [payout]);

  // Reset tooltip state when modal closes; clean up timer on unmount
  useEffect(() => {
    if (!visible) {
      if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null; }
      tooltipAnim.setValue(0);
      setActiveTooltip(null);
    }
    return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current); };
  }, [visible]);

  const hideTooltip = () => {
    if (tooltipTimerRef.current) { clearTimeout(tooltipTimerRef.current); tooltipTimerRef.current = null; }
    Animated.timing(tooltipAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => setActiveTooltip(null),
    );
  };

  const showTooltipAt = (key: TooltipKey, ref: React.RefObject<any>) => {
    if (activeTooltip === key) { hideTooltip(); return; }
    ref.current?.measureInWindow((_x: number, y: number, _w: number, _h: number) => {
      setTooltipPos({ top: Math.max(8, y - 48) });
      setActiveTooltip(key);
      tooltipAnim.setValue(0);
      Animated.timing(tooltipAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      // Auto-close after 3.5 s
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
      tooltipTimerRef.current = setTimeout(hideTooltip, 3500);
    });
  };

  const renderInfoBtn = (key: TooltipKey, ref: React.RefObject<any>) => (
    <TouchableOpacity
      ref={ref}
      onPress={() => showTooltipAt(key, ref)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
    </TouchableOpacity>
  );

  if (!bet || !event) return null;

  const hasStake = isFreeStake ? amountNum > 0 : (bet.stakeAmount ?? 0) > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity
          style={styles.modalBackground}
          activeOpacity={1}
          onPress={() => { hideTooltip(); onClose(); }}
        />
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>

          {/* ── Header ── */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, marginRight: Spacing.md }}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Confirmar apuesta</Text>
              <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
                Apostás a un pozo compartido. El pago final se calcula al cerrar el evento.
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* ── Event info ── */}
          <View style={styles.modalEventInfo}>
            <Text style={[styles.modalEventTitle, { color: colors.foreground }]} numberOfLines={1}>
              {event.homeTeam && event.awayTeam
                ? `${event.homeTeam} vs ${event.awayTeam}`
                : event.title}
            </Text>
            <Text style={[styles.modalBetType, { color: colors.mutedForeground }]} numberOfLines={1}>
              {bet.title}
            </Text>
          </View>

          {/* ── Selection block (primary visual) ── */}
          <View style={[styles.modalOddContainer, { backgroundColor: colors.primary + '07', borderColor: colors.border, borderWidth: 1   }]}>
            <View style={styles.modalOddRow}>
              <View>
                <Text style={[styles.modalOddLabel, { color: colors.mutedForeground }]}>
                  Tu selección
                </Text>
                <Text style={[styles.modalOptionText, { color: colors.foreground }]}>{option}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <View style={styles.infoLabelRow}>
                  <Text style={[styles.modalOddLabel, { color: colors.mutedForeground }]}>
                    Cuota estimada (ahora)
                  </Text>
                  {renderInfoBtn('odd', oddInfoRef)}
                </View>
                <Text style={[styles.modalOddValue, { color: colors.foreground }]}>
                  {estimatedOddStr}
                </Text>
              </View>
            </View>
            {estimatedOddStr === '—' && userStake > 0 && (
              <Text style={[styles.modalPendingNote, { color: colors.mutedForeground }]}>
                Falta una apuesta del otro lado para activar el mercado.
              </Text>
            )}
          </View>

          {/* ── Money block ── */}
          <View style={styles.modalAmountSection}>

            {/* Monto */}
            {isFreeStake ? (
              <>
                <Text style={[styles.modalAmountLabel, { color: colors.mutedForeground }]}>
                  Monto a apostar
                </Text>
                <View
                  style={[
                    styles.modalAmountInputWrap,
                    { backgroundColor: colors.muted, borderColor: colors.border },
                  ]}
                >
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
              </>
            ) : (
              <View style={[styles.moneyRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>Monto fijo</Text>
                <Text style={[styles.moneyValue, { color: colors.foreground }]}>
                  ${(bet.stakeAmount ?? 0).toLocaleString('es-AR')}
                </Text>
              </View>
            )}

            {/* Pago estimado */}
            {hasStake && (
              <>
                <View style={[styles.moneyRow, { borderBottomWidth: 0 }]}>
                  <View style={styles.infoLabelRow}>
                    <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>
                      Pago estimado
                    </Text>
                    {renderInfoBtn('payout', payoutInfoRef)}
                  </View>
                  <View style={styles.payoutValueRow}>
                    <Animated.View
                      style={[
                        styles.updatedBadge,
                        { backgroundColor: colors.primary + '20', opacity: updatedAnim },
                      ]}
                    >
                      <Text style={[styles.updatedText, { color: colors.primary }]}>Actualizado</Text>
                    </Animated.View>
                    <Text
                      style={[
                        styles.moneyValueLarge,
                        { color: payout > 0 ? colors.success : colors.mutedForeground },
                      ]}
                    >
                      ${payout.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                    </Text>
                  </View>
                </View>
              </>
            )}

            {/* Already selected: current pick gain */}
            {alreadySelected && pickGain > 0 && (
              <View style={[styles.moneyRow, { borderBottomWidth: 0, marginTop: 2 }]}>
                <Text style={[styles.moneyLabel, { color: colors.mutedForeground }]}>Si ganás (actual)</Text>
                <Text style={[styles.moneyValue, { color: colors.success }]}>
                  x{parseFloat(odd).toFixed(2)} = ${pickGain.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                </Text>
              </View>
            )}
          </View>

          {/* ── Feedback ── */}
          {betFeedback !== '' && (
            <Text
              style={[
                styles.betFeedbackText,
                { color: betFeedback.startsWith('¡') ? colors.success : colors.destructive },
              ]}
            >
              {betFeedback}
            </Text>
          )}

          {/* ── CTA ── */}
          <TouchableOpacity
            style={[
              styles.modalConfirmButton,
              { backgroundColor: colors.primary, opacity: confirmingBet || alreadySelected ? 0.45 : 1 },
            ]}
            onPress={onConfirm}
            disabled={confirmingBet || alreadySelected}
          >
            {confirmingBet ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : alreadySelected ? (
              <Text style={styles.modalConfirmText}>Ya apostaste esta opción</Text>
            ) : (
              <Text style={styles.modalConfirmText}>Apostar ahora</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Floating tooltip – absolute overlay, doesn't extend modal height */}
        {activeTooltip ? (
          <Animated.View
            style={[
              styles.tooltipFloating,
              {
                opacity: tooltipAnim,
                transform: [
                  { translateY: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
                ],
                top: tooltipPos.top,
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.tooltipInlineText}>{TOOLTIPS[activeTooltip]}</Text>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
};

export default BetModal;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackground: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: 28,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 3 },
  modalSubtitle: { fontSize: 12, lineHeight: 17 },
  modalEventInfo: { marginBottom: Spacing.sm },
  modalEventTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  modalBetType: { fontSize: 12 },
  modalOddContainer: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md },
  modalOddRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOddLabel: { fontSize: 12, marginBottom: 4 },
  modalPendingNote: { fontSize: 11, marginTop: Spacing.sm, lineHeight: 15 },
  modalOptionText: { fontSize: 16, fontWeight: '700' },
  modalOddValue: { fontSize: 22, fontWeight: '800' },
  infoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalAmountSection: { marginBottom: Spacing.md },
  modalAmountLabel: { fontSize: 13, marginBottom: Spacing.sm },
  modalAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    height: 48,
    marginBottom: Spacing.sm,
  },
  modalAmountCurrency: { fontSize: 18, marginRight: 4 },
  modalAmountInput: { flex: 1, fontSize: 20, fontWeight: '700' },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  moneyLabel: { fontSize: 13 },
  moneyValue: { fontSize: 14, fontWeight: '600' },
  moneyValueLarge: { fontSize: 17, fontWeight: '800' },
  payoutValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updatedBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  updatedText: { fontSize: 10, fontWeight: '700' },
  tooltipFloating: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 100,
  },
  tooltipInlineText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 17,
    fontWeight: '500',
  },
  betFeedbackText: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  modalConfirmButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.sm,
  },
  modalConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
