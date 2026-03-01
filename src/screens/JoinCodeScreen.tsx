import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  InteractionManager,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import TournamentPreviewSheet from './tournament/components/TournamentPreviewSheet';
import { getTournamentCodePreview, TournamentCodePreview } from '../services/inviteService';

const JoinCodeScreen = ({ navigation }: any) => {
  const [code, setCode] = useState('');
  const [validating, setValidating] = useState(false);
  const [codePreview, setCodePreview] = useState<TournamentCodePreview | null>(null);
  const [showPreviewSheet, setShowPreviewSheet] = useState(false);
  const { theme } = useTheme();
  const colors = Colors[theme];

  const handleValidateCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (trimmed.length < 6) return;

    Keyboard.dismiss(); // dismiss before any setState
    setValidating(true);
    try {
      const preview = await getTournamentCodePreview(trimmed);
      if (!preview) {
        Alert.alert('Código inválido', 'No se encontró ningún torneo con ese código.');
        setCodePreview(null);
        return;
      }
      setShowPreviewSheet(false); // explicit reset
      setCodePreview(preview);    // payload set → useEffect below fires
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo verificar el código');
    } finally {
      setValidating(false);
    }
  };

  // Two-step open: same pattern as CreateTournamentScreen — wait for all
  // pending interactions before presenting the Modal.
  useEffect(() => {
    if (!codePreview) return;
    Keyboard.dismiss();
    const task = InteractionManager.runAfterInteractions(() => {
      setShowPreviewSheet(true);
    });
    return () => task.cancel();
  }, [codePreview]);

  const handleJoinSuccess = (tournamentId: string) => {
    setShowPreviewSheet(false);
    navigation.navigate('Tournament', { tournamentId });
  };

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
        key={`preview-${codePreview?.tournamentId ?? 'empty'}`}
        visible={showPreviewSheet}
        onClose={() => setShowPreviewSheet(false)}
        mode="join"
        codePreview={codePreview}
        onSuccess={handleJoinSuccess}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
