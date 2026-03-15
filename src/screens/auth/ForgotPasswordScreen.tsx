import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { Colors, Gradients, Spacing, BorderRadius } from '../../theme/colors';
import { useTheme } from '../../context/ThemeContext';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPasswordScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSend = async () => {
    setError('');
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Por favor ingresá tu email.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('El formato del email no es válido.');
      return;
    }

    setIsLoading(true);
    try {
      await sendPasswordResetEmail(auth, trimmed);
      setSent(true);
    } catch (e: any) {
      // Never reveal whether the email exists or not
      if (e.code === 'auth/network-request-failed') {
        setError('Error de conexión. Verificá tu internet e intentá nuevamente.');
      } else {
        // For any other error (including user-not-found) show the success message
        // to avoid leaking account existence
        setSent(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Gradient Background Effect */}
        <View style={styles.gradientContainer}>
          <LinearGradient
            colors={['rgba(215, 38, 61, 0.15)', 'rgba(255, 122, 0, 0.08)', 'transparent']}
            style={styles.gradientBackground}
          />
        </View>

        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <Image source={require('../../../assets/icon.png')} style={styles.logoImage} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>
              <Text style={{ color: colors.primary }}>BET</Text>
              <Text>CROWD</Text>
            </Text>
          </View>

          {/* Card */}
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {sent ? (
              /* ── Success state ── */
              <View style={styles.successContainer}>
                <View style={[styles.successIcon, { backgroundColor: (colors.success ?? '#22c55e') + '20' }]}>
                  <Ionicons name="mail-outline" size={36} color={colors.success ?? '#22c55e'} />
                </View>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  ¡Revisá tu email!
                </Text>
                <Text style={[styles.description, { color: colors.mutedForeground }]}>
                  Si el email existe en nuestra base de datos, te enviamos un enlace para restablecer tu contraseña.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                  onPress={() => navigation.navigate('Login')}
                >
                  <Text style={styles.primaryButtonText}>Volver al inicio de sesión</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Form state ── */
              <>
                <Text style={[styles.title, { color: colors.foreground }]}>
                  Recuperar contraseña
                </Text>
                <Text style={[styles.description, { color: colors.mutedForeground }]}>
                  Ingresá el email con el que creaste tu cuenta y te enviaremos un enlace para restablecer tu contraseña.
                </Text>

                {/* Email input */}
                <View style={styles.inputContainer}>
                  <Text style={[styles.label, { color: colors.mutedForeground }]}>Email</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.input,
                        color: colors.foreground,
                        borderColor: error ? colors.destructive : colors.border,
                      },
                    ]}
                    placeholder="tu@email.com"
                    placeholderTextColor={colors.mutedForeground}
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(''); }}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoFocus
                    returnKeyType="send"
                    onSubmitEditing={handleSend}
                  />
                  {!!error && (
                    <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
                  )}
                </View>

                {/* Send button */}
                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.primary }, isLoading && { opacity: 0.7 }]}
                  onPress={handleSend}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Enviar enlace</Text>
                  )}
                </TouchableOpacity>

                {/* Back to login */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                >
                  <Ionicons name="arrow-back" size={16} color={colors.mutedForeground} />
                  <Text style={[styles.backButtonText, { color: colors.mutedForeground }]}>
                    Volver al login
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl * 2,
  },
  gradientContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 500,
    overflow: 'hidden',
  },
  gradientBackground: {
    width: 700,
    height: 500,
    position: 'absolute',
    top: 0,
    left: '50%',
    marginLeft: -350,
  },
  content: {
    zIndex: 1,
    gap: Spacing.xl,
  },
  logoContainer: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 72,
    height: 72,
    marginBottom: Spacing.sm,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 1,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  inputContainer: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    height: 52,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 15,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  primaryButton: {
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // Success state
  successContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  successIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
});

export default ForgotPasswordScreen;
