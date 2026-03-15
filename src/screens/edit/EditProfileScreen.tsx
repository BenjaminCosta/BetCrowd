import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { Colors, Spacing, BorderRadius } from '../../theme/colors';
import { TopBar } from '../../components/TopBar';
import { PrimaryButton } from '../../components/CommonComponents';
import UserAvatar from '../../components/UserAvatar';
import { useAuth } from '../../context/AuthContext';
import { auth } from '../../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { getUserProfile, updateFullProfile, UpdateProfileData } from '../../services/userService';
import { changePassword, validatePasswordChange, getPasswordErrorMessage } from '../../services/passwordService';
import { useToast } from '../../context/ToastContext';

const EditProfileScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { showToast } = useToast();

  // Profile state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');

  // Password modal state
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Load user profile
  const loadUserProfile = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);
      const profile = await getUserProfile(user.uid);
      
      if (profile) {
        setFullName(profile.fullName || profile.displayName || '');
        setUsername(profile.username || '');
        setOriginalUsername(profile.username || '');
        setEmail(profile.email || user.email || '');
        setPhone(profile.phone || '');
        setBio(profile.bio || '');
      } else {
        // Fallback to auth user data
        setEmail(user.email || '');
        setFullName(user.displayName || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      showToast({ type: 'error', message: 'No se pudo cargar tu perfil' });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  const handleSave = async () => {
    if (!user) return;

    // Basic validation
    if (!fullName.trim()) {
      showToast({ type: 'warning', message: 'El nombre completo es requerido' });
      return;
    }

    if (!username.trim()) {
      showToast({ type: 'warning', message: 'El nombre de usuario es requerido' });
      return;
    }

    if (bio.length > 150) {
      showToast({ type: 'warning', message: 'La biografía no puede exceder 150 caracteres' });
      return;
    }

    try {
      setSaving(true);

      const updateData: UpdateProfileData = {
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        phone: phone.trim(),
        bio: bio.trim(),
      };

      await updateFullProfile(user.uid, originalUsername, updateData);

      // Update displayName in Firebase Auth
      if (auth.currentUser && fullName.trim() !== auth.currentUser.displayName) {
        await updateProfile(auth.currentUser, {
          displayName: fullName.trim(),
        });
      }

      showToast({ type: 'success', message: 'Tu perfil se actualizó correctamente' });
      navigation.goBack();
    } catch (error: any) {
      console.error('Error saving profile:', error);
      showToast({ type: 'error', message: error.message || 'No se pudo guardar los cambios' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    if (!validation.valid) {
      showToast({ type: 'warning', message: validation.error || 'Error de validación' });
      return;
    }

    try {
      setChangingPassword(true);
      await changePassword(currentPassword, newPassword);
      
      // Clear inputs
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordModalVisible(false);
      
      showToast({ type: 'success', message: 'Tu contraseña se cambió correctamente' });
    } catch (error: any) {
      console.error('Error changing password:', error);
      const message = getPasswordErrorMessage(error.code);
      showToast({ type: 'error', message });
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando perfil...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <UserAvatar
            uid={user?.uid ?? ''}
            name={fullName || user?.email || ''}
            size={100}
          />
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Nombre Completo */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Nombre Completo
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons name="person-outline" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Tu nombre completo"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>
          </View>

          {/* Nombre de Usuario */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Nombre de Usuario
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons name="at" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={username}
                onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ''))}
                placeholder="Tu nombre de usuario"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
              />
            </View>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              Minúsculas, números, _ y . solamente (3-20 caracteres)
            </Text>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Email
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.mutedForeground }]}
                value={email}
                placeholder="tu@email.com"
                placeholderTextColor={colors.mutedForeground}
                editable={false}
              />
            </View>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              El email no se puede cambiar
            </Text>
          </View>

          {/* Teléfono */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Teléfono (opcional)
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons name="call-outline" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={phone}
                onChangeText={setPhone}
                placeholder="+54 11 1234-5678"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Biografía */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Biografía (opcional)
            </Text>
            <View style={[styles.textAreaContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <TextInput
                style={[styles.textArea, { color: colors.foreground }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Cuéntanos sobre ti..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
            <Text style={[styles.helperText, { color: colors.mutedForeground }]}>
              {bio.length}/150 caracteres
            </Text>
          </View>

          {/* Cambiar Contraseña */}
          <TouchableOpacity 
            style={[styles.changePasswordButton, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setPasswordModalVisible(true)}
          >
            <View style={styles.changePasswordLeft}>
              <Ionicons name="lock-closed-outline" size={20} color={colors.foreground} />
              <Text style={[styles.changePasswordText, { color: colors.foreground }]}>
                Cambiar Contraseña
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            style={[styles.saveButton, { backgroundColor: colors.primary }]}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveButtonText}>Guardar Cambios</Text>
            )}
          </TouchableOpacity>
          
          {/* Cancel Button */}
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelButtonText, { color: colors.mutedForeground }]}>
              Cancelar
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Password Change Modal */}
      <Modal
        visible={passwordModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                Cambiar Contraseña
              </Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              {/* Current Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Contraseña Actual
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Ingresa tu contraseña actual"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons
                      name={showCurrentPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* New Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Nueva Contraseña
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Mínimo 8 caracteres"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons
                      name={showNewPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Confirm New Password */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.mutedForeground }]}>
                  Confirmar Nueva Contraseña
                </Text>
                <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.mutedForeground} />
                  <TextInput
                    style={[styles.input, { color: colors.foreground }]}
                    value={confirmNewPassword}
                    onChangeText={setConfirmNewPassword}
                    placeholder="Repite tu nueva contraseña"
                    placeholderTextColor={colors.mutedForeground}
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <PrimaryButton
                title={changingPassword ? undefined : "Cambiar Contraseña"}
                onPress={handleChangePassword}
                style={styles.modalButton}
              >
                {changingPassword && <ActivityIndicator color="#FFFFFF" />}
              </PrimaryButton>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.xl,
  },
  form: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  inputGroup: {
    marginBottom: Spacing.xl,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    height: 50,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  textAreaContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    minHeight: 100,
  },
  textArea: {
    fontSize: 16,
    paddingVertical: 0,
    minHeight: 80,
  },
  helperText: {
    fontSize: 12,
    marginTop: Spacing.xs,
    textAlign: 'right',
  },
  changePasswordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xxl,
  },
  changePasswordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  changePasswordText: {
    fontSize: 16,
    fontWeight: '500',
  },
  saveButton: {
    marginBottom: Spacing.md,
    paddingVertical: 16,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cancelButton: {
    padding: Spacing.lg,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
  },
  modalButton: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
});

export default EditProfileScreen;
