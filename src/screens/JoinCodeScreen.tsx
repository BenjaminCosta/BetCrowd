import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import TournamentPreviewSheet from './tournament/components/TournamentPreviewSheet';
import { getTournamentCodePreview, TournamentCodePreview } from '../services/inviteService';
import { clearPendingTournamentInvite } from '../services/deepLinkService';
import {
  getTournamentInviteLinkPreview,
  TournamentInviteLinkPreview,
} from '../services/inviteLinkService';

const JoinCodeScreen = ({ navigation, route }: any) => {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codePreview, setCodePreview] = useState<TournamentCodePreview | null>(null);
  const [inviteLinkPreview, setInviteLinkPreview] = useState<TournamentInviteLinkPreview | null>(null);
  const [previewMode, setPreviewMode] = useState<'join' | 'join-link'>('join');
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const [inviteLinkLoading, setInviteLinkLoading] = useState(false);
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { showToast } = useToast();
  const deepLinkTournamentId = typeof route?.params?.tournamentId === 'string' ? route.params.tournamentId : '';
  const deepLinkToken = typeof route?.params?.token === 'string' ? route.params.token : '';
  const isInviteLinkRoute = deepLinkTournamentId !== '' && deepLinkToken !== '';

  const handleValidateCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) return;

    Keyboard.dismiss(); // dismiss before any setState
    setValidating(true);
    try {
      const preview = await getTournamentCodePreview(trimmed);
      if (!preview) {
        showToast({ type: 'warning', message: 'No se encontró ningún torneo con ese código.' });
        setCodePreview(null);
        return;
      }
      setPreviewMode('join');
      setInviteLinkPreview(null);
      setShowPreviewSheet(false); // explicit reset
      setCodePreview(preview);    // payload set → useEffect below fires
    } catch (e: any) {
      showToast({ type: 'error', message: e.message || 'No se pudo verificar el código' });
    } finally {
      setValidating(false);
    }
  };

  // Two-step open: same pattern as CreateTournamentScreen — wait for all
  // pending interactions before presenting the Modal.
  useEffect(() => {
    if (!codePreview && !inviteLinkPreview) return;
    Keyboard.dismiss();
    const task = InteractionManager.runAfterInteractions(() => {
      setShowPreviewSheet(true);
    });
    return () => task.cancel();
  }, [codePreview, inviteLinkPreview]);

  useEffect(() => {
    if (!isInviteLinkRoute) return;

    let cancelled = false;

    const resolveInviteLink = async () => {
      Keyboard.dismiss();
      setInviteLinkLoading(true);
      try {
        const preview = await getTournamentInviteLinkPreview({
          tournamentId: deepLinkTournamentId,
          token: deepLinkToken,
        });
        if (cancelled) return;

        setPreviewMode('join-link');
        setCodePreview(null);
        setInviteLinkPreview(preview);
      } catch (e: any) {
        if (!cancelled) {
          showToast({ type: 'error', message: e?.message || 'No se pudo verificar el link de invitación' });
          setInviteLinkPreview(null);
          setPreviewMode('join');
        }
      } finally {
        await clearPendingTournamentInvite().catch(() => {});
        if (!cancelled) {
          setInviteLinkLoading(false);
          navigation.setParams({ tournamentId: undefined, token: undefined });
        }
      }
    };

    resolveInviteLink().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [deepLinkToken, deepLinkTournamentId, isInviteLinkRoute, navigation, showToast]);

  const handleJoinSuccess = (tournamentId: string) => {
    setShowPreviewSheet(false);
    clearPendingTournamentInvite().catch(() => {});
    navigation.navigate('Tournament', { tournamentId });
  };

  if (inviteLinkLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.foreground }]}>
            Validando invitación
          </Text>
          <Text style={[styles.loadingSubtitle, { color: colors.mutedForeground }]}>
            Estamos preparando la vista previa del torneo.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Unirse con Código
        </Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Ingresa el código del torneo privado
        </Text>

        <View style={styles.form}>
          <TextInput
            style={[styles.input, {
              backgroundColor: colors.secondary,
              color: colors.foreground,
              borderColor: colors.border,
            }]}
            placeholder="Código del torneo"
            placeholderTextColor={colors.mutedForeground}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            maxLength={8}
          />

          <TouchableOpacity
            onPress={handleValidateCode}
            disabled={code.trim().length < 6 || validating}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[
                styles.joinButton,
                (code.trim().length < 6 || validating) && { opacity: 0.5 },
              ]}
            >
              {validating ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <Text style={styles.joinButtonText}>Continuar</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      {/* key forces a fresh Animated.Value each time the user previews a tournament */}
      <TournamentPreviewSheet
        key={`preview-${previewMode}-${inviteLinkPreview?.tournamentId ?? codePreview?.tournamentId ?? 'empty'}`}
        visible={showPreviewSheet}
        onClose={() => setShowPreviewSheet(false)}
        mode={previewMode}
        codePreview={codePreview}
        inviteLinkPreview={inviteLinkPreview}
        onSuccess={handleJoinSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  content: {
    flex: 1,
    padding: 16,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  form: {
    gap: 16,
  },
  input: {
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 18,
    borderWidth: 1,
    textAlign: 'center',
    letterSpacing: 4,
    fontWeight: '700',
  },
  joinButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  joinButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default JoinCodeScreen;
