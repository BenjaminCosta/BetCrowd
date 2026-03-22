import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TopBar } from '../components/TopBar';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

const SUPPORT_EMAIL = 'soporte@betcrowd.com';

const FAQ_ITEMS = [
  {
    question: '¿Cómo me uno a un torneo?',
    answer:
      'Podés unirte usando un código de invitación tocando "Unirse con código" en la pantalla de Torneos, o abriendo el link de invitación que te compartió el organizador.',
  },
  {
    question: '¿Cómo invito amigos a mi torneo?',
    answer:
      'Desde la pantalla del torneo podés compartir el código o el link de invitación directamente por WhatsApp u otras apps.',
  },
  {
    question: '¿Se usa dinero real?',
    answer:
      'No. BetCrowd es una app de competencia social entre amigos, sin dinero real ni transacciones de ningún tipo.',
  },
  {
    question: '¿Cómo elimino mi cuenta?',
    answer: `Escribinos a ${SUPPORT_EMAIL} y eliminamos tu cuenta y todos tus datos en menos de 48 horas.`,
  },
];

const HelpSupportScreen = () => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) =>
    setOpenIndex(openIndex === index ? null : index);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Ayuda y Soporte
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Estamos aquí para ayudarte.
          </Text>
        </View>

        {/* Contacto */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Contacto
          </Text>
          <TouchableOpacity
            style={[styles.row, { backgroundColor: colors.card }]}
            onPress={() => {
              const url = `mailto:${SUPPORT_EMAIL}?subject=Soporte%20BetCrowd`;
              Linking.openURL(url).catch(() => {
                Alert.alert('Error', 'No se pudo abrir el cliente de correo.');
              });
            }}
            activeOpacity={0.7}
          >
            <View style={styles.rowLeft}>
              <View
                style={[
                  styles.iconBox,
                  { backgroundColor: colors.primary + '20' },
                ]}
              >
                <Ionicons name="mail" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                  Email
                </Text>
                <Text
                  style={[styles.rowSubtitle, { color: colors.mutedForeground }]}
                >
                  {SUPPORT_EMAIL}
                </Text>
              </View>
            </View>
            <Ionicons
              name="open-outline"
              size={18}
              color={colors.mutedForeground}
            />
          </TouchableOpacity>
        </View>

        {/* FAQ */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Preguntas frecuentes
          </Text>
          <View style={[styles.faqCard, { backgroundColor: colors.card }]}>
            {FAQ_ITEMS.map((item, index) => (
              <View key={index}>
                {index > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                )}
                <TouchableOpacity
                  style={styles.faqRow}
                  onPress={() => toggle(index)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.faqQuestion, { color: colors.foreground }]}
                  >
                    {item.question}
                  </Text>
                  <Ionicons
                    name={openIndex === index ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.mutedForeground}
                  />
                </TouchableOpacity>
                {openIndex === index && (
                  <Text
                    style={[
                      styles.faqAnswer,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {item.answer}
                  </Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Legal */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Legal
          </Text>
          <View style={[styles.faqCard, { backgroundColor: colors.card }]}>
            <TouchableOpacity
              style={styles.legalRow}
              onPress={() =>
                Linking.openURL('https://betcrowd.vercel.app/privacy')
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.legalText, { color: colors.foreground }]}>
                Política de Privacidad
              </Text>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.legalRow}
              onPress={() =>
                Linking.openURL('https://betcrowd.vercel.app/terms')
              }
              activeOpacity={0.7}
            >
              <Text style={[styles.legalText, { color: colors.foreground }]}>
                Términos y Condiciones
              </Text>
              <Ionicons
                name="open-outline"
                size={18}
                color={colors.mutedForeground}
              />
            </TouchableOpacity>
          </View>
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  rowSubtitle: {
    fontSize: 13,
  },
  faqCard: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.md,
  },
  faqRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
  },
  legalText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default HelpSupportScreen;
