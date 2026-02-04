import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { PrimaryButton } from '../components/CommonComponents';

const EditProfileScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [name, setName] = useState('Juan García');
  const [username, setUsername] = useState('juangarcia');
  const [email, setEmail] = useState('juan.garcia@example.com');
  const [phone, setPhone] = useState('+54 11 1234-5678');
  const [bio, setBio] = useState('Fanático del fútbol y las apuestas deportivas 🔥');

  const handleSave = () => {
    // Lógica para guardar cambios
    navigation.goBack();
  };

  const handleChangePhoto = () => {
    // Lógica para cambiar foto de perfil
    console.log('Cambiar foto');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <LinearGradient
            colors={Gradients.primary as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatar}
          >
            <Text style={styles.avatarText}>JG</Text>
          </LinearGradient>
          
          <TouchableOpacity 
            style={[styles.changePhotoButton, { backgroundColor: colors.card }]}
            onPress={handleChangePhoto}
          >
            <Ionicons name="camera" size={16} color={colors.primary} />
            <Text style={[styles.changePhotoText, { color: colors.primary }]}>
              Cambiar Foto
            </Text>
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
                value={name}
                onChangeText={setName}
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
                onChangeText={setUsername}
                placeholder="Tu nombre de usuario"
                placeholderTextColor={colors.mutedForeground}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Email
            </Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <Ionicons name="mail-outline" size={20} color={colors.mutedForeground} />
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Teléfono */}
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>
              Teléfono
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
              Biografía
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
            title="Guardar Cambios"
            onPress={handleSave}
            style={styles.saveButton}
          />

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
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
});

export default EditProfileScreen;
