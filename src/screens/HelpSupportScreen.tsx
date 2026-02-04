import React from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { TopBar } from '../components/TopBar';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

const HelpSupportScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const helpTopics = [
    {
      icon: 'help-circle',
      title: 'Preguntas Frecuentes',
      description: '¿Tienes dudas? Encuentra respuestas a las preguntas más comunes.',
    },
    {
      icon: 'book',
      title: 'Guía de Usuario',
      description: 'Aprende a usar todas las funciones de BetCrowd paso a paso.',
    },
    {
      icon: 'trophy',
      title: 'Cómo Crear Torneos',
      description: 'Tutorial completo para crear y gestionar tus propios torneos.',
    },
    {
      icon: 'bar-chart',
      title: 'Sistema de Puntos',
      description: 'Entiende cómo funciona el sistema de puntuación y rankings.',
    },
  ];

  const contactOptions = [
    {
      icon: 'mail',
      title: 'Email',
      value: 'soporte@betcrowd.com',
      action: () => Linking.openURL('mailto:soporte@betcrowd.com'),
    },
    {
      icon: 'logo-whatsapp',
      title: 'WhatsApp',
      value: '+34 600 123 456',
      action: () => Linking.openURL('https://wa.me/34600123456'),
    },
    {
      icon: 'chatbubbles',
      title: 'Chat en Vivo',
      value: 'Lun - Vie, 9:00 - 18:00',
      action: () => console.log('Abrir chat'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Ayuda y Soporte
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Estamos aquí para ayudarte. Encuentra recursos útiles o contáctanos directamente.
          </Text>
        </View>

        {/* Help Topics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Recursos de Ayuda
          </Text>
          <View style={styles.topicsContainer}>
            {helpTopics.map((topic, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.topicCard, { backgroundColor: colors.card }]}
                activeOpacity={0.7}
              >
                <View style={[styles.topicIconContainer, { backgroundColor: colors.accent + '20' }]}>
                  <Ionicons name={topic.icon as any} size={24} color={colors.accent} />
                </View>
                <View style={styles.topicContent}>
                  <Text style={[styles.topicTitle, { color: colors.foreground }]}>
                    {topic.title}
                  </Text>
                  <Text style={[styles.topicDescription, { color: colors.mutedForeground }]}>
                    {topic.description}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Contacto Directo
          </Text>
          <View style={styles.contactContainer}>
            {contactOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.contactCard, { backgroundColor: colors.card }]}
                onPress={option.action}
                activeOpacity={0.7}
              >
                <View style={styles.contactLeft}>
                  <View style={[styles.contactIcon, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name={option.icon as any} size={22} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={[styles.contactTitle, { color: colors.foreground }]}>
                      {option.title}
                    </Text>
                    <Text style={[styles.contactValue, { color: colors.mutedForeground }]}>
                      {option.value}
                    </Text>
                  </View>
                </View>
                <Ionicons name="open-outline" size={20} color={colors.mutedForeground} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Quick Help Button */}
        <TouchableOpacity
          style={styles.quickHelpButton}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={Gradients.primary as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.quickHelpGradient}
          >
            <Ionicons name="rocket" size={24} color="#FFFFFF" />
            <Text style={styles.quickHelpText}>
              Enviar Comentarios
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={[styles.infoBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="time" size={18} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
            Nuestro equipo de soporte responde en menos de 24 horas
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
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  topicsContainer: {
    gap: Spacing.sm,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  topicIconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicContent: {
    flex: 1,
    gap: 4,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  topicDescription: {
    fontSize: 12,
    lineHeight: 16,
  },
  contactContainer: {
    gap: Spacing.sm,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  contactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  contactValue: {
    fontSize: 13,
  },
  quickHelpButton: {
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  quickHelpGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  quickHelpText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
  },
});

export default HelpSupportScreen;
