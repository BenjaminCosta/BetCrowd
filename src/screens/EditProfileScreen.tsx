import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { PrimaryButton } from '../components/CommonComponents';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';
import { getUserProfile, updateFullProfile, UpdateProfileData } from '../services/userService';
import { uploadAvatar } from '../services/storageService';
import { changePassword, validatePasswordChange, getPasswordErrorMessage } from '../services/passwordService';

const EditProfileScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();

  // Profile state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [originalUsername, setOriginalUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [photoURL, setPhotoURL] = useState('');

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
  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
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
        setPhotoURL(profile.photoURL || '');
      } else {
        // Fallback to auth user data
        setEmail(user.email || '');
        setFullName(user.displayName || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'No se pudo cargar tu perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Basic validation
    if (!fullName.trim()) {
      Alert.alert('Error', 'El nombre completo es requerido');
      return;
    }

    if (!username.trim()) {
      Alert.alert('Error', 'El nombre de usuario es requerido');
      return;
    }

    if (bio.length > 150) {
      Alert.alert('Error', 'La biografía no puede exceder 150 caracteres');
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

      if (photoURL) {
        updateData.photoURL = photoURL;
      }

      await updateFullProfile(user.uid, originalUsername, updateData);
      
      // Update displayName in Firebase Auth
      if (auth.currentUser && fullName.trim() !== auth.currentUser.displayName) {
        const { updateProfile } = await import('firebase/auth');
        await updateProfile(auth.currentUser, {
          displayName: fullName.trim(),
        });
      }

      Alert.alert('¡Éxito!', 'Tu perfil se actualizó correctamente', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'No se pudo guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePhoto = async () => {
    if (!user) return;

    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Necesitamos acceso a tus fotos para cambiar tu imagen de perfil');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploadingPhoto(true);
        
        const downloadURL = await uploadAvatar(user.uid, result.assets[0].uri);
        setPhotoURL(downloadURL);
        
        Alert.alert('¡Listo!', 'Foto actualizada. No olvides guardar los cambios.');
      }
    } catch (error) {
      console.error('Error changing photo:', error);
      Alert.alert('Error', 'No se pudo cambiar la foto');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChangePassword = async () => {
    const validation = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmNewPassword,
    });

    if (!validation.valid) {
      Alert.alert('Error', validation.error);
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
      
      Alert.alert('¡Éxito!', 'Tu contraseña se cambió correctamente');
    } catch (error: any) {
      console.error('Error changing password:', error);
      const message = getPasswordErrorMessage(error.code);
      Alert.alert('Error', message);
    } finally {
      setChangingPassword(false);
    }
  };

  const getInitials = () => {
    if (fullName) {
      const parts = fullName.trim().split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return fullName.substring(0, 2).toUpperCase();
    }
    return user?.email?.substring(0, 2).toUpperCase() || 'U';
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
      
      <ScrollView style={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          {photoURL ? (
            <Image source={{ uri: photoURL }} style={styles.avatarImage} />
          ) : (
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{getInitials()}</Text>
            </LinearGradient>
          )}
          
          <TouchableOpacity 
            style={[styles.changePhotoButton, { backgroundColor: colors.card }]}
            onPress={handleChangePhoto}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Ionicons name="camera" size={16} color={colors.primary} />
                <Text style={[styles.changePhotoText, { color: colors.primary }]}>
                  Cambiar Foto
                </Text>
              </>
            )}
          </TouchableOpacity>
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
          <PrimaryButton
            title={saving ? undefined : "Guardar Cambios"}
            onPress={handleSave}
            style={styles.saveButton}
          >
            {saving && <ActivityIndicator color="#FFFFFF" />}
          </PrimaryButton>
          
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
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  changePhotoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    minHeight: 36,
  },
  changePhotoText: {
    fontSize: 14,
    fontWeight: '600',
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
