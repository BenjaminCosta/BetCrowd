import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { FloatingActionButton } from '../../../components/FloatingActionButton';
import { SwipeableRow, BetCardCompact } from '../../../components/BetanoComponents';
import { deleteBet, deleteMyPick, upsertMyPick, calculateOdds, Bet, Pick } from '../../../services/betService';
import { Event } from '../../../services/eventService';
import { useAuth } from '../../../context/AuthContext';
import CreateBetForm from '../../../components/forms/CreateBetForm';
import EditBetForm from '../../../components/forms/EditBetForm';
import BetModal from './BetModal';

type SheetView = 'detail' | 'create_bet' | 'edit_bet';

// ─── Props ────────────────────────────────────────────────────────────────────

interface EventBottomSheetProps {
  visible: boolean;
  event: Event | null;
  sheetBets: Bet[];
  sheetBetsLoading: boolean;
  userPicks: Record<string, Pick | null>;
  isAdmin: boolean;
  tournamentId: string;
  tournamentName?: string;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const EventBottomSheet: React.FC<EventBottomSheetProps> = ({
  visible,
  event,
  sheetBets,
  sheetBetsLoading,
  userPicks,
  isAdmin,
  tournamentId,
  tournamentName,
  onClose,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();

  const [view, setView] = useState<SheetView>('detail');
  const [editingBetId, setEditingBetId] = useState<string | null>(null);
  const [showBetModal, setShowBetModal] = useState(false);
  const [modalBet, setModalBet] = useState<Bet | null>(null);
  const [modalOption, setModalOption] = useState('');
  const [modalOdd, setModalOdd] = useState('');
  const [betAmount, setBetAmount] = useState('');
  const [confirmingBet, setConfirmingBet] = useState(false);
  const [betFeedback, setBetFeedback] = useState('');
  const [modalCurrentPick, setModalCurrentPick] = useState<string | null>(null);
  const [modalCurrentPickStake, setModalCurrentPickStake] = useState<number>(0);
  const betFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setView('detail');
      setEditingBetId(null);
      if (betFeedbackTimerRef.current) clearTimeout(betFeedbackTimerRef.current);
      setShowBetModal(false);
      setModalBet(null);
      setModalOption('');
      setModalOdd('');
      setBetAmount('');
      setBetFeedback('');
    }
  }, [visible]);

  useEffect(() => {
    return () => {
      if (betFeedbackTimerRef.current) clearTimeout(betFeedbackTimerRef.current);
    };
  }, []);

  if (!event) return null;

  const goBack = () => {
    setView('detail');
    setEditingBetId(null);
  };

  const handleBackdropPress = () => {
    if (view !== 'detail') { goBack(); } else { onClose(); }
  };

  const handleHardwareBack = () => {
    if (view !== 'detail') { goBack(); } else { onClose(); }
  };

  const handleDeleteBet = (bet: Bet) => {
    Alert.alert('Eliminar apuesta', `¿Eliminar "${bet.title}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive',
        onPress: async () => {
          try { await deleteBet(tournamentId, event.id, bet.id); }
          catch (e: any) { Alert.alert('Error', e.message || 'No se pudo eliminar'); }
        },
      },
    ]);
  };

  const handleCancelPick = (bet: Bet) => {
    if (!user || !event) return;
    Alert.alert('Cancelar apuesta', '¿Seguro que querés cancelar tu apuesta?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí, cancelar', style: 'destructive',
        onPress: async () => {
          try { await deleteMyPick(tournamentId, event.id, bet.id, user.uid); }
          catch (e: any) { Alert.alert('Error', e.message || 'No se pudo cancelar'); }
        },
      },
    ]);
  };

  const openBetModal = (bet: Bet, option: string) => {
    const odds = calculateOdds(bet);
    setModalBet(bet);
    setModalOption(option);
    setModalOdd(odds[option] ?? '—');
    setBetAmount('');
    setBetFeedback('');
    // Store current pick selection so BetModal can detect re-selection
    const existingPick = userPicks[bet.id];
    setModalCurrentPick(
      existingPick
        ? typeof existingPick.selection === 'string'
          ? existingPick.selection
          : JSON.stringify(existingPick.selection)
        : null,
    );
    setModalCurrentPickStake(existingPick?.stakeAmount ?? 0);
    setShowBetModal(true);
  };

  const handleConfirmBet = async () => {
    if (!user || !event || !modalBet || !modalOption) return;
    setConfirmingBet(true);
    setBetFeedback('');
    try {
      const stake = modalBet.stakeType === 'fixed'
        ? (modalBet.stakeAmount ?? 0)
        : (parseFloat(betAmount) || 0);
      await upsertMyPick(tournamentId, event.id, modalBet.id, user.uid, modalOption, stake);
      setBetFeedback('¡Apuesta registrada!');
      betFeedbackTimerRef.current = setTimeout(() => { setShowBetModal(false); setBetFeedback(''); }, 1200);
    } catch (e: any) {
      setBetFeedback(e?.message || 'Error al registrar');
    } finally {
      setConfirmingBet(false);
    }
  };

  const statusLabels: Record<string, string> = {
    upcoming: 'PRÓXIMO',
    live: 'EN VIVO',
    finished: 'FINALIZADO',
    cancelled: 'CANCELADO',
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleHardwareBack}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.sheetOverlay}>
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={handleBackdropPress} />
          <View style={[styles.sheetContainer, { backgroundColor: colors.card }]}>
            {/* Handle */}
            <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

            {view !== 'detail' && (
              <View style={styles.backHeader}>
                <TouchableOpacity
                  onPress={goBack}
                  style={styles.backButton}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="arrow-back" size={22} color={colors.foreground} />
                  <Text style={[styles.backButtonText, { color: colors.foreground }]}>Volver</Text>
                </TouchableOpacity>
                <Text style={[styles.backHeaderTitle, { color: colors.foreground }]} numberOfLines={1}>
                  {view === 'create_bet' ? 'Nueva apuesta' : 'Editar apuesta'}
                </Text>
                <View style={styles.backHeaderSpacer} />
              </View>
            )}

            {view === 'create_bet' && (
              <View style={styles.formContainer}>
                <CreateBetForm
                  tournamentId={tournamentId}
                  eventId={event.id}
                  onSuccess={goBack}
                />
              </View>
            )}

            {view === 'edit_bet' && editingBetId && (
              <View style={styles.formContainer}>
                <EditBetForm
                  tournamentId={tournamentId}
                  eventId={event.id}
                  betId={editingBetId}
                  onSuccess={goBack}
                />
              </View>
            )}

            {view === 'detail' && (<>

            {/* Event header */}
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {event.homeTeam && event.awayTeam
                    ? `${event.homeTeam} vs ${event.awayTeam}`
                    : event.title}
                </Text>
                {event.homeTeam && event.awayTeam && (
                  <Text style={[styles.sheetSubtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                )}
                <View
                  style={[
                    styles.sheetStatusBadge,
                    {
                      backgroundColor:
                        event.status === 'live' ? colors.success + '20' : colors.primary + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.sheetStatusText,
                      { color: event.status === 'live' ? colors.success : colors.primary },
                    ]}
                  >
                    {statusLabels[event.status] ?? event.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.sheetCloseBtn}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Summary row */}
            <View
              style={[
                styles.sheetSummaryRow,
                { backgroundColor: colors.secondary, borderColor: colors.border },
              ]}
            >
              {event.startsAt ? (
                <View style={styles.sheetSummaryItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.sheetSummaryText, { color: colors.mutedForeground }]}>
                    {(() => {
                      const d = (event.startsAt as any).toDate
                        ? (event.startsAt as any).toDate()
                        : new Date(event.startsAt as any);
                      return d.toLocaleDateString('es-AR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                    })()}
                  </Text>
                </View>
              ) : null}
              {sheetBets.length > 0 && (
                <View style={styles.sheetSummaryItem}>
                  <Ionicons name="list-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.sheetSummaryText, { color: colors.mutedForeground }]}>
                    {sheetBets.length} {sheetBets.length === 1 ? 'mercado' : 'mercados'}
                  </Text>
                </View>
              )}
              {tournamentName ? (
                <View style={styles.sheetSummaryItem}>
                  <Ionicons name="trophy-outline" size={14} color={colors.mutedForeground} />
                  <Text
                    style={[styles.sheetSummaryText, { color: colors.mutedForeground }]}
                    numberOfLines={1}
                  >
                    {tournamentName}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Bets list */}
            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ paddingBottom: 88 }}
              showsVerticalScrollIndicator={false}
            >
              {sheetBetsLoading ? (
                <View style={styles.centeredLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : sheetBets.length === 0 ? (
                <Text style={[styles.sheetNoBets, { color: colors.mutedForeground }]}>
                  {isAdmin
                    ? 'No hay apuestas. Créalas desde el admin.'
                    : 'No hay apuestas disponibles.'}
                </Text>
              ) : (
                sheetBets.map((bet) => {
                  const myPick = userPicks[bet.id];
                  const mySelection = myPick
                    ? typeof myPick.selection === 'string'
                      ? myPick.selection
                      : JSON.stringify(myPick.selection)
                    : null;
                  const isOpen = bet.status === 'open';

                  return (
                    <SwipeableRow
                      key={bet.id}
                      enabled={isAdmin}
                      actions={[
                        {
                          label: 'Editar',
                          icon: 'create-outline',
                          color: colors.primary,
                        onPress: () => { setEditingBetId(bet.id); setView('edit_bet'); },
                        },
                        {
                          label: 'Eliminar',
                          icon: 'trash-outline',
                          color: colors.destructive,
                          onPress: () => handleDeleteBet(bet),
                        },
                      ]}
                    >
                      <View style={styles.sheetBetWrapper}>
                        <BetCardCompact
                          bet={bet}
                          theme={theme}
                          onOptionPress={(option) => isOpen && openBetModal(bet, option)}
                          userSelection={mySelection}
                          disabled={!isOpen}
                          showOdds
                          onCancel={isOpen && mySelection ? () => handleCancelPick(bet) : undefined}
                        />
                      </View>
                    </SwipeableRow>
                  );
                })
              )}
            </ScrollView>

            {isAdmin && (
              <FloatingActionButton onPress={() => setView('create_bet')} />
            )}
            </>)}
          </View>
        </View>
        <BetModal
          visible={showBetModal}
          bet={modalBet}
          event={event}
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
      </GestureHandlerRootView>
    </Modal>
  );
};

export default EventBottomSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    height: '90%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, marginBottom: Spacing.sm },
  sheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  sheetSubtitle: { fontSize: 13, marginBottom: 6 },
  sheetStatusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  sheetStatusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  sheetCloseBtn: { padding: Spacing.sm },
  sheetSummaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sheetSummaryItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sheetSummaryText: { fontSize: 12, fontWeight: '500' },
  sheetScroll: { marginBottom: Spacing.lg },
  sheetNoBets: { textAlign: 'center', paddingVertical: Spacing.xl, fontSize: 14 },
  sheetBetWrapper: { marginBottom: Spacing.md },
  centeredLoader: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  backHeader: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: Spacing.lg, paddingBottom: Spacing.md,
  },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 64 },
  backButtonText: { fontSize: 16, fontWeight: '600' },
  backHeaderTitle: { flex: 1, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  backHeaderSpacer: { minWidth: 64 },
  formContainer: { flex: 1 },
});
