import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Badge, Chip, SectionHeader, Divider } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';

// Mock data
const mockEvent = {
  name: 'Pelea estelar UFC 300',
  participantA: 'Jon Jones',
  participantB: 'Stipe Miocic',
};

const chipAmounts = ['0', '100', '200', '500', '1000'];

const EventDetailsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedAmount, setSelectedAmount] = useState('0');

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Event Header */}
          <View style={styles.header}>
            <Text style={[styles.eventName, { color: colors.foreground }]}>
              {mockEvent.name}
            </Text>
            <View style={styles.participants}>
              <Text style={[styles.participant, { color: colors.foreground }]}>
                {mockEvent.participantA}
              </Text>
              <Text style={[styles.vs, { color: colors.mutedForeground }]}>VS</Text>
              <Text style={[styles.participant, { color: colors.foreground }]}>
                {mockEvent.participantB}
              </Text>
            </View>
          </View>

          {/* Mercado: Ganador */}
          <Card style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <View>
                <Text style={[styles.marketTitle, { color: colors.foreground }]}>
                  Ganador
                </Text>
                <Text style={[styles.marketSubtitle, { color: colors.mutedForeground }]}>
                  ¿Quién ganará el evento?
                </Text>
              </View>
              <Badge variant="pending">PENDIENTE</Badge>
            </View>

            <Divider style={{ marginVertical: Spacing.md }} />

            <View style={styles.optionsGrid}>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  selectedOption === 'A' && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedOption('A')}
              >
                <Text style={[styles.optionText, { color: colors.foreground }]}>
                  {mockEvent.participantA}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.optionButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                  selectedOption === 'B' && styles.optionButtonSelected,
                ]}
                onPress={() => setSelectedOption('B')}
              >
                <Text style={[styles.optionText, { color: colors.foreground }]}>
                  {mockEvent.participantB}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.amountsSection}>
              <Text style={[styles.amountLabel, { color: colors.mutedForeground }]}>
                Monto de apuesta (ARS)
              </Text>
              <View style={styles.chipContainer}>
                {chipAmounts.map((amount) => (
                  <Chip
                    key={amount}
                    label={`$${amount}`}
                    selected={selectedAmount === amount}
                    onPress={() => setSelectedAmount(amount)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Pozo del mercado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  $2,400
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Multiplicador estimado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.accent }]}>
                  2.5x
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Cobro estimado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.success }]}>
                  $250
                </Text>
              </View>
            </View>

            <View style={[styles.disclaimer, { backgroundColor: colors.muted }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.mutedForeground} />
              <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
                Se activa con 2 apuestas. Si no se activa, se devuelve el aporte.
              </Text>
            </View>
          </Card>

          {/* Mercado: Método */}
          <Card style={styles.marketCard}>
            <View style={styles.marketHeader}>
              <View>
                <Text style={[styles.marketTitle, { color: colors.foreground }]}>
                  Método de victoria
                </Text>
                <Text style={[styles.marketSubtitle, { color: colors.mutedForeground }]}>
                  ¿Cómo terminará el evento?
                </Text>
              </View>
              <Badge variant="active">ACTIVO</Badge>
            </View>

            <Divider style={{ marginVertical: Spacing.md }} />

            <View style={styles.methodOptions}>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="flash" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  KO/TKO
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="fitness" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  Sumisión
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.methodButton,
                  { backgroundColor: colors.secondary, borderColor: colors.border },
                ]}
              >
                <Ionicons name="trophy" size={24} color={colors.accent} />
                <Text style={[styles.methodText, { color: colors.foreground }]}>
                  Decisión
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.infoSection}>
              <View style={styles.infoRow}>
                <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
                  Pozo del mercado:
                </Text>
                <Text style={[styles.infoValue, { color: colors.foreground }]}>
                  $1,800
                </Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  eventName: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: Spacing.md,
  },
  participants: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  participant: {
    fontSize: 18,
    fontWeight: '700',
  },
  vs: {
    fontSize: 14,
    fontWeight: '600',
  },
  marketCard: {
    marginBottom: Spacing.lg,
  },
  marketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  marketTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  marketSubtitle: {
    fontSize: 13,
  },
  optionsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  optionButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionButtonSelected: {
    // Colors applied inline
  },
  optionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  amountsSection: {
    marginBottom: Spacing.lg,
  },
  amountLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  infoSection: {
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  methodOptions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  methodButton: {
    flex: 1,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  methodText: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export default EventDetailsScreen;
