import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Bet } from '../../../services/betService';
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
}

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
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  if (!bet || !event) return null;

  const isFreeStake = bet.stakeType !== 'fixed';
  const amountNum = parseFloat(betAmount) || 0;
  const estimatedGain = amountNum * (parseFloat(odd) || 0);
  const alreadySelected = !!currentPick && currentPick === option;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackground} activeOpacity={1} onPress={onClose} />
        <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Confirmar apuesta</Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Event info */}
          <View style={styles.modalEventInfo}>
            <Text style={[styles.modalEventTitle, { color: colors.foreground }]} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={[styles.modalBetType, { color: colors.mutedForeground }]} numberOfLines={1}>
              {bet.title}
            </Text>
          </View>

          {/* Selected option */}
          <View style={[styles.modalOddContainer, { backgroundColor: colors.muted }]}>
            <View style={styles.modalOddRow}>
              <View>
                <Text style={[styles.modalOddLabel, { color: colors.mutedForeground }]}>
                  Tu selección
                </Text>
                <Text style={[styles.modalOptionText, { color: colors.foreground }]}>{option}</Text>
              </View>
              <Text style={[styles.modalOddValue, { color: colors.foreground }]}>{odd}</Text>
            </View>
          </View>

          {/* Amount */}
          {isFreeStake ? (
            <View style={styles.modalAmountSection}>
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
            <View style={styles.modalAmountSection}>
              <View style={styles.modalGainRow}>
                <Text style={[styles.modalGainLabel, { color: colors.mutedForeground }]}>
                  Monto fijo
                </Text>
                <Text style={[styles.modalGainValue, { color: colors.foreground }]}>
                  ${(bet.stakeAmount ?? 0).toLocaleString('es-AR')}
                </Text>
              </View>
            </View>
          )}

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
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalEventInfo: { marginBottom: Spacing.lg },
  modalEventTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  modalBetType: { fontSize: 13 },
  modalOddContainer: { borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  modalOddRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalOddLabel: { fontSize: 12, marginBottom: 4 },
  modalOptionText: { fontSize: 16, fontWeight: '700' },
  modalOddValue: { fontSize: 22, fontWeight: '800' },
  modalAmountSection: { marginBottom: Spacing.lg },
  modalAmountLabel: { fontSize: 13, marginBottom: Spacing.sm },
  modalAmountInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    height: 48,
  },
  modalAmountCurrency: { fontSize: 18, marginRight: 4 },
  modalAmountInput: { flex: 1, fontSize: 20, fontWeight: '700' },
  modalGainRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  modalGainLabel: { fontSize: 13 },
  modalGainValue: { fontSize: 15, fontWeight: '700' },
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
  },
  modalConfirmText: { color: '#FFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
