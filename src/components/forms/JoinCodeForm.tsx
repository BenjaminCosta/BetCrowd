import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import { joinTournamentByInviteCode } from '../../services/tournamentService';
import { getTournamentCodePreview, TournamentCodePreview } from '../../services/inviteService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface JoinCodeFormProps {
  /**
   * Called with the resolved tournamentId once the user has successfully
   * joined (or was already a member). Caller should close the sheet and
   * navigate to Tournament.
   */
  onJoined: (tournamentId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Two-step "Unirse por código" form — rendered inside a SheetModal.
 *
 * Step 1: Enter code → "Continuar" (validates + fetches preview)
 * Step 2: Preview card → "Unirme" (executes the real join)
 */
const JoinCodeForm: React.FC<JoinCodeFormProps> = ({ onJoined }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<TournamentCodePreview | null>(null);
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();

  const canSubmit = code.trim().length >= 6 && !loading;

  // ── Step 1: Validate code ─────────────────────────────────────────────────

  const handleContinue = async () => {
    if (!canSubmit) return;
    setError('');
    Keyboard.dismiss();
    setLoading(true);
    try {
      const result = await getTournamentCodePreview(code.trim());
      if (!result) {
        setError('No se encontró ningún torneo con ese código.');
        return;
      }
      setPreview(result);
    } catch (e: any) {
      setError(e?.message ?? 'Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Confirm join ──────────────────────────────────────────────────

  const handleJoin = async () => {
    if (!preview) return;
    setLoading(true);
    try {
      const tournamentId = await joinTournamentByInviteCode(preview.inviteCode);
      onJoined(tournamentId);
    } catch (e: any) {
      showToast({ type: 'error', message: e?.message ?? 'No se pudo unir al torneo' });
      setLoading(false);
    }
  };

  const handleBack = () => {
    setPreview(null);
    setError('');
  };

  // ── Render: Step 2 — Preview ──────────────────────────────────────────────

  if (preview) {
    return (
      <View style={styles.container}>
        {/* Trophy icon */}
        <LinearGradient
          colors={['rgba(215,38,61,0.15)', 'rgba(255,122,0,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.previewIconCircle}
        >
          <Ionicons name="trophy" size={36} color={colors.primary} />
        </LinearGradient>

        <Text style={[styles.previewName, { color: colors.foreground }]}>
          {preview.name}
        </Text>

        {/* Code badge */}
        <View style={[styles.codeBadge, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Ionicons name="key-outline" size={14} color={colors.mutedForeground} />
          <Text style={[styles.codeBadgeText, { color: colors.mutedForeground }]}>
            Código: {preview.inviteCode}
          </Text>
        </View>

        {/* Success info card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.infoRow}>
            <Ionicons name="checkmark-circle" size={20} color={colors.success} />
            <Text style={[styles.infoText, { color: colors.foreground }]}>
              Código válido — listo para unirte
            </Text>
          </View>
        </View>

        {/* CTA row */}
        <View style={styles.ctaRow}>
          <TouchableOpacity
            style={[styles.backBtn, { borderColor: colors.border }]}
            onPress={handleBack}
            disabled={loading}
          >
            <Ionicons name="arrow-back" size={16} color={colors.mutedForeground} />
            <Text style={[styles.backBtnText, { color: colors.mutedForeground }]}>Atrás</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.joinBtnWrapper, loading && { opacity: 0.6 }]}
            onPress={handleJoin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.joinBtn}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.joinBtnText}>Unirme</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Render: Step 1 — Code input ───────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Icon */}
      <View style={[styles.iconWrapper, { backgroundColor: colors.primary + '18' }]}>
        <Ionicons name="key-outline" size={36} color={colors.primary} />
      </View>

      <Text style={[styles.title, { color: colors.foreground }]}>
        Unirse con Código
      </Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
        Ingresa el código de invitación del torneo privado
      </Text>

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.secondary,
            color: colors.foreground,
            borderColor: error ? colors.destructive : colors.border,
          },
        ]}
        placeholder="XXXXXX"
        placeholderTextColor={colors.mutedForeground}
        value={code}
        onChangeText={(t) => { setCode(t); setError(''); }}
        autoCapitalize="characters"
        maxLength={8}
        autoFocus
        editable={!loading}
      />

      {error !== '' && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle-outline" size={15} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
        </View>
      )}

      <TouchableOpacity
        onPress={handleContinue}
        disabled={!canSubmit}
        activeOpacity={0.85}
        style={[
          styles.button,
          { backgroundColor: colors.primary },
          !canSubmit && styles.buttonDisabled,
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
            Continuar
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

export default JoinCodeForm;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.lg,
    alignItems: 'stretch',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: -Spacing.sm,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -Spacing.sm,
  },
  input: {
    height: 60,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 22,
    borderWidth: 1.5,
    textAlign: 'center',
    letterSpacing: 8,
    fontWeight: '700',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: -Spacing.sm,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  button: {
    height: 54,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  // ── Step 2 styles ─────────────────────────
  previewIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  previewName: {
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  codeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignSelf: 'center',
  },
  codeBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
  },
  infoCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
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
  ctaRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  backBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  joinBtnWrapper: {
    flex: 2,
  },
  joinBtn: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
