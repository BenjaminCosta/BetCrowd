import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';

const TournamentDetailsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  // Datos de ejemplo
  const tournament = {
    name: 'Final Champions League',
    description: 'Predicciones para los partidos de la final de la Champions League. ¡Participa y demuestra tus conocimientos!',
    startDate: '15/06/2026',
    endDate: '20/06/2026',
    contributionPerPerson: 1000,
    currency: 'ARS',
    totalParticipants: 8,
    isParticipating: true,
    isAdmin: true,
    inviteCode: 'CHAMP2026',
  };

  const userContribution = tournament.isParticipating ? tournament.contributionPerPerson : 0;
  const totalPool = tournament.contributionPerPerson * tournament.totalParticipants;
  const currentBalance = 350; // Ejemplo: ganando +350 o perdiendo -350

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content}>
        {/* Tournament Header */}
        <View style={styles.header}>
          <Text style={[styles.tournamentName, { color: colors.foreground }]}>
            {tournament.name}
          </Text>
          <View style={styles.liveBadge}>
            <Ionicons name="flame" size={14} color="#DC2E4B" />
            <Text style={styles.liveBadgeText}>EN VIVO</Text>
          </View>
        </View>

        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {tournament.description}
        </Text>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Inicio
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.startDate}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Fin
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.endDate}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Participantes
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.totalParticipants}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Código
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.inviteCode}
            </Text>
          </View>
        </View>

        {/* Balance del Torneo */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
            Balance del Torneo
          </Text>
          
          <View style={[styles.balanceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Aportaste:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                ${userContribution} {tournament.currency}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Pozo total:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                ${totalPool} {tournament.currency}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Estimación actual:
              </Text>
              <Text style={[
                styles.balanceHighlight,
                { color: currentBalance >= 0 ? colors.success : colors.destructive }
              ]}>
                {currentBalance >= 0 ? '+' : ''}{currentBalance} {tournament.currency}
              </Text>
            </View>

            <View style={[styles.infoBox, { backgroundColor: colors.secondary }]}>
              <Ionicons name="information-circle-outline" size={18} color={colors.mutedForeground} />
              <Text style={[styles.infoText, { color: colors.mutedForeground }]}>
                La app solo registra el balance entre participantes. Los pagos se realizan fuera de la app.
              </Text>
            </View>
          </View>
        </View>

        {/* Acciones */}
        <View style={styles.section}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Predictions')}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}
            >
              <Ionicons name="trophy" size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>
                Ver Predicciones
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {tournament.isAdmin && (
            <>
              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="calendar" size={20} color={colors.foreground} />
                <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                  Gestionar Eventos
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.secondaryButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="checkmark-circle" size={20} color={colors.foreground} />
                <Text style={[styles.secondaryButtonText, { color: colors.foreground }]}>
                  Cargar Resultados
                </Text>
              </TouchableOpacity>
            </>
          )}
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
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tournamentName: {
    fontSize: 24,
    fontWeight: '700',
    flex: 1,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(220, 46, 75, 0.2)',
    gap: 4,
  },
  liveBadgeText: {
    color: '#DC2E4B',
    fontSize: 10,
    fontWeight: '700',
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  infoCard: {
    flex: 1,
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  balanceCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  balanceLabel: {
    fontSize: 14,
  },
  balanceValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  balanceHighlight: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 4,
  },
  infoText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 12,
    gap: 8,
    marginBottom: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TournamentDetailsScreen;
