import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';
import { joinTournamentByInviteCode } from '../../services/tournamentService';

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
 * Reusable "Unirse por código" content — rendered inside a SheetModal.
 * Calls joinTournamentByInviteCode internally so the parent gets a resolved
 * tournamentId, avoiding the undefined-param crash in TournamentScreen.
 */
const JoinCodeForm: React.FC<JoinCodeFormProps> = ({ onJoined }) => {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { theme } = useTheme();
  const colors = Colors[theme];

  const canSubmit = code.trim().length >= 6 && !loading;

  const handleJoin = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const tournamentId = await joinTournamentByInviteCode(code.trim());
      onJoined(tournamentId);
    } catch (e: any) {
      const msg: string = e?.message ?? 'Error al unirse';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

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
        maxLength={6}
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
  onPress={handleJoin}
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
      Unirse al Torneo
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
});
