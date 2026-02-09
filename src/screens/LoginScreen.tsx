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
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { PrimaryButton } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getFirebaseErrorMessage } from '../services/authService';

const LoginScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email.trim(), password);
      // Navigation is handled automatically by AppNavigator when auth state changes
    } catch (error: any) {
      const message = getFirebaseErrorMessage(error.code);
      Alert.alert('Error al iniciar sesión', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
            <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
            <Text style={[styles.logoText, { color: colors.foreground }]}>
              <Text style={{ color: colors.primary }}>BET</Text>
              <Text>CROWD</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Predict. Compete. Win.
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Email o Usuario
              </Text>
              <TextInput
                style={[styles.input, { 
                  backgroundColor: colors.input, 
                  color: colors.foreground,
                  borderColor: colors.border,
                }]}
                placeholder="Ingresa tu email"
                placeholderTextColor={colors.mutedForeground}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                Contraseña
              </Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.input, styles.passwordInput, { 
                    backgroundColor: colors.input, 
                    color: colors.foreground,
                    borderColor: colors.border,
                  }]}
                  placeholder="Ingresa tu contraseña"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity>
              <Text style={[styles.forgotPassword, { color: colors.primary }]}>
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            <PrimaryButton onPress={handleLogin} style={styles.loginButton}>
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                'Iniciar Sesión'
              )}
            </PrimaryButton>

            <View style={styles.dividerContainer}>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
                O continúa con
              </Text>
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
            </View>

            <View style={styles.socialButtons}>
              <TouchableOpacity 
                style={[styles.socialButton, { 
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                }]}
              >
                <Ionicons name="logo-google" size={20} color={colors.foreground} />
                <Text style={[styles.socialButtonText, { color: colors.foreground }]}>
                  Google
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.socialButton, { 
                  backgroundColor: colors.secondary,
                  borderColor: colors.border,
                }]}
              >
                <Ionicons name="logo-apple" size={20} color={colors.foreground} />
                <Text style={[styles.socialButtonText, { color: colors.foreground }]}>
                  Apple
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity 
              style={styles.signupContainer}
              onPress={() => navigation.navigate('SignUp')}
            >
              <Text style={[styles.signupText, { color: colors.mutedForeground }]}>
                ¿No tienes cuenta?{' '}
              </Text>
              <Text style={[styles.signupLink, { color: colors.primary }]}>
                Regístrate
              </Text>
            </TouchableOpacity>
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
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xxl * 2,
  },
  logoImage: {
    width: 99,
    height: 99,
    marginBottom: Spacing.lg,
  },
  logoText: {
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    fontSize: 16,
    marginTop: Spacing.sm,
    letterSpacing: 0.5,
  },
  form: {
    gap: Spacing.lg,
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: Spacing.lg,
    top: 16,
  },
  forgotPassword: {
    fontSize: 14,
    textAlign: 'right',
    marginTop: -Spacing.sm,
    fontWeight: '600',
  },
  loginButton: {
    marginTop: Spacing.sm,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.md,
    gap: Spacing.md,
  },
  divider: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  socialButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  socialButton: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.lg,
  },
  signupText: {
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: '700',
  },
});

export default LoginScreen;
