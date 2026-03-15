import React, { useState } from 'react';
import {
  Alert,
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSwipeToClose, SwipeDragHandle } from '../../../components/SheetModal';
import { Colors, Gradients, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { useToast } from '../../../context/ToastContext';
import { TournamentInvite, acceptTournamentInvite, rejectTournamentInvite } from '../../../services/inviteService';
import { joinTournamentByInviteCode } from '../../../services/tournamentService';
import { TournamentCodePreview } from '../../../services/inviteService';
import {
  joinTournamentByInviteLink,
  TournamentInviteLinkPreview,
} from '../../../services/inviteLinkService';
import { getInitials } from '../../../utils/formatters';

// ─── Types ────────────────────────────────────────────────────────────────────

type PreviewMode = 'invite' | 'join' | 'join-link';

interface TournamentPreviewSheetProps {
  visible: boolean;
  onClose: () => void;
  /** 'invite' — accepting a received tournament invite */
  mode: PreviewMode;
  /** Required when mode === 'invite' */
  invite?: TournamentInvite | null;
  /** Required when mode === 'join' */
  codePreview?: TournamentCodePreview | null;
  /** Required when mode === 'join-link' */
  inviteLinkPreview?: TournamentInviteLinkPreview | null;
  /** Called after accepting invite or completing join. Receives the tournamentId. */
  onSuccess?: (tournamentId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const TournamentPreviewSheet: React.FC<TournamentPreviewSheetProps> = ({
  visible,
  onClose,
  mode,
  invite,
  codePreview,
  inviteLinkPreview,
  onSuccess,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
  const { onGestureEvent, onHandlerStateChange, animatedContainerStyle, doClose } =
    useSwipeToClose(visible, onClose);

  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!visible) setLoading(false);
  }, [visible]);

  // Derived display data
  const tournamentName =
    mode === 'invite'
      ? invite?.tournamentName ?? '—'
      : mode === 'join-link'
        ? inviteLinkPreview?.name ?? '—'
        : codePreview?.name ?? '—';
  const inviteCode = mode === 'join' ? codePreview?.inviteCode : undefined;
  const fromName = mode === 'invite' ? invite?.fromName : undefined;

  // ── Actions ──────────────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!invite) return;
    setLoading(true);
    try {
      const tId = await acceptTournamentInvite(invite.id);
      doClose();
      onSuccess?.(tId);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo aceptar la invitación' });
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!invite) return;
    Alert.alert(
      'Rechazar invitación',
      `¿Rechazar la invitación a "${tournamentName}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await rejectTournamentInvite(invite.id);
              doClose();
            } catch (e: any) {
              showToast({ type: 'error', message: e.message || 'No se pudo rechazar' });
              setLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleJoin = async () => {
    if (!codePreview) return;
    setLoading(true);
    try {
      const tId = await joinTournamentByInviteCode(codePreview.inviteCode);
      doClose();
      onSuccess?.(tId);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo unir al torneo' });
      setLoading(false);
    }
  };

  const handleJoinLink = async () => {
    if (!inviteLinkPreview) return;
    setLoading(true);
    try {
      const tId = await joinTournamentByInviteLink({
        tournamentId: inviteLinkPreview.tournamentId,
        token: inviteLinkPreview.token,
      });
      doClose();
      onSuccess?.(tId);
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo unir con el link de invitación' });
      setLoading(false);
    }
  };

  const renderMemberPreviews = () => {
    const members =
      mode === 'invite'
        ? invite?.memberPreviews
        : mode === 'join-link'
          ? inviteLinkPreview?.memberPreviews
          : codePreview?.memberPreviews;
    if (!members || members.length === 0) return null;
    return (
      <View style={[styles.membersCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.membersTitle, { color: colors.mutedForeground }]}>
          Miembros actuales
        </Text>
        {members.map((m) => (
          <View key={m.uid} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberInitials}>{getInitials(m.displayName)}</Text>
            </View>
            <Text style={[styles.memberName, { color: colors.foreground }]} numberOfLines={1}>
              {m.displayName}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={doClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={doClose} />

          <Animated.View
            style={[styles.container, { backgroundColor: colors.background }, animatedContainerStyle]}
          >
            {/* Drag handle */}
            <SwipeDragHandle
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              color={colors.border}
            />

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {/* Tournament icon row */}
              <View style={styles.iconRow}>
                <LinearGradient
                  colors={['rgba(215,38,61,0.15)', 'rgba(255,122,0,0.08)']}
                  style={styles.iconCircle}
                >
                  <Ionicons name="trophy" size={36} color={colors.primary} />
                </LinearGradient>
              </View>

              {/* Tournament name */}
              <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                {tournamentName}
              </Text>

              {/* Invite code badge */}
              {inviteCode && (
                <View style={[styles.codeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Ionicons name="key-outline" size={14} color={colors.mutedForeground} />
                  <Text style={[styles.codeText, { color: colors.mutedForeground }]}>
                    Código: {inviteCode}
                  </Text>
                </View>
              )}

              {/* "Invited by" row (invite mode) */}
              {fromName && (
                <View style={styles.invitedByRow}>
                  <Ionicons name="person-circle-outline" size={18} color={colors.mutedForeground} />
                  <Text style={[styles.invitedByText, { color: colors.mutedForeground }]}>
                    Invitado por <Text style={{ color: colors.foreground, fontWeight: '600' }}>{fromName}</Text>
                  </Text>
                </View>
              )}

              {/* Info cards */}
              <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {mode === 'join' || mode === 'join-link' ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                    <Text style={[styles.infoText, { color: colors.foreground }]}>
                      {mode === 'join-link'
                        ? 'Link válido — listo para unirte'
                        : 'Código válido — listo para unirte'}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.infoRow}>
                    <Ionicons name="mail" size={20} color={colors.primary} />
                    <Text style={[styles.infoText, { color: colors.foreground }]}>
                      Tienes una invitación pendiente
                    </Text>
                  </View>
                )}
              </View>

              {/* Member previews — visible in both invite and join modes */}
              {renderMemberPreviews()}

              {/* Spacer for CTAs */}
              <View style={{ height: Spacing.xl }} />
            </ScrollView>

            {/* CTAs */}
            <View style={[styles.footer, { borderTopColor: colors.border }]}>
              {mode === 'invite' ? (
                <>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { backgroundColor: colors.muted, borderColor: colors.border }]}
                    onPress={handleReject}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color={colors.foreground} />
                    ) : (
                      <Text style={[styles.rejectBtnText, { color: '#FFF' }]}>
                        Rechazar
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.acceptBtnWrapper, loading && { opacity: 0.6 }]}
                    onPress={handleAccept}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={Gradients.primary as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.acceptBtn}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.acceptBtnText}>Aceptar</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.rejectBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                    onPress={doClose}
                    disabled={loading}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="arrow-back" size={16} color="#FFF" />
                      <Text style={[styles.rejectBtnText, { color: '#FFF' }]}>
                        Atrás
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.acceptBtnWrapper, loading && { opacity: 0.6 }]}
                    onPress={mode === 'join-link' ? handleJoinLink : handleJoin}
                    disabled={loading}
                  >
                    <LinearGradient
                      colors={Gradients.primary as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.acceptBtn}
                    >
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <Text style={styles.acceptBtnText}>Unirme</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

export default TournamentPreviewSheet;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    height: '65%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
  },
  scrollContent: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  iconRow: {
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tournamentName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  codeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  invitedByRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.lg,
  },
  invitedByText: {
    fontSize: 14,
  },
  infoCard: {
    width: '100%',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  infoText: {
    fontSize: 14,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rejectBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  acceptBtnWrapper: {
    flex: 2,
  },
  acceptBtn: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  membersCard: {
    width: '100%',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: 10,
  },
  membersTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(215,38,61,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D7263D',
  },
  memberName: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
