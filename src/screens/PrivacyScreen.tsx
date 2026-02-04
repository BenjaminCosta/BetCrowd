import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../components/TopBar';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

const PrivacyScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const privacyItems = [
    {
      icon: 'eye-off',
      title: 'Datos Personales',
      description: 'Tus datos están protegidos y encriptados. No compartimos información con terceros sin tu consentimiento.',
    },
    {
      icon: 'shield-checkmark',
      title: 'Seguridad',
      description: 'Utilizamos protocolos de seguridad avanzados para proteger tu cuenta y transacciones.',
    },
    {
      icon: 'lock-closed',
      title: 'Privacidad de Predicciones',
      description: 'Tus predicciones son privadas. Solo tú y los miembros de tus torneos pueden verlas.',
    },
    {
      icon: 'people',
      title: 'Perfil Público',
      description: 'Controla qué información de tu perfil es visible para otros usuarios de la plataforma.',
    },
    {
      icon: 'mail',
      title: 'Comunicaciones',
      description: 'Puedes gestionar las notificaciones por email y las comunicaciones que recibes.',
    },
    {
      icon: 'trash',
      title: 'Eliminación de Datos',
      description: 'Tienes derecho a solicitar la eliminación completa de tu cuenta y datos asociados.',
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Privacidad y Seguridad
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Tu privacidad es nuestra prioridad. Conoce cómo protegemos tu información.
          </Text>
        </View>

        <View style={styles.itemsContainer}>
          {privacyItems.map((item, index) => (
            <View key={index} style={[styles.privacyItem, { backgroundColor: colors.card }]}>
              <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name={item.icon as any} size={24} color={colors.primary} />
              </View>
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                <Text style={[styles.itemDescription, { color: colors.mutedForeground }]}>
                  {item.description}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Para más información sobre nuestras políticas de privacidad, consulta nuestros{' '}
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              Términos y Condiciones
            </Text>
          </Text>
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
    paddingHorizontal: Spacing.md,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemsContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  privacyItem: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});

export default PrivacyScreen;
