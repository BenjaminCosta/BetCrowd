import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament, getTournamentMemberCount, getMyTournamentRole, Tournament } from '../services/tournamentService';

const TournamentDetailsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [memberCount, setMemberCount] = useState(0);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tournamentId) {
      loadTournamentDetails();
    }
  }, [tournamentId]);

  const loadTournamentDetails = async () => {
    try {
      setLoading(true);
      const [tournamentData, count, role] = await Promise.all([
        getTournament(tournamentId),
        getTournamentMemberCount(tournamentId),
        user ? getMyTournamentRole(tournamentId, user.uid) : Promise.resolve(null),
      ]);
      setTournament(tournamentData);
      setMemberCount(count);
      setUserRole(role);
    } catch (error) {
      console.error('Error loading tournament details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando torneo...
          </Text>
        </View>
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.foreground }]}>
            Torneo no encontrado
          </Text>
        </View>
      </View>
    );
  }

  const isOwner = tournament.ownerId === user?.uid;
  const isAdmin = isOwner || userRole === 'admin' || userRole === 'owner';
  const isParticipating = userRole !== null;
  
  const contribution = tournament.contribution || 0;
  const totalPool = contribution * memberCount;
  const currency = tournament.currency || 'ARS';

  // Badge logic based on dates and status
  const getBadgeInfo = () => {
    if (tournament.status === 'active') {
      return { label: 'ACTIVO', color: '#DC2E4B' };
    }
    
    const now = new Date();
    if (tournament.endDate) {
      const endDate = new Date(tournament.endDate);
      if (endDate < now) {
        return { label: 'FINALIZADO', color: '#6B7280' };
      }
    }
    
    if (tournament.startDate) {
      const startDate = new Date(tournament.startDate);
      if (startDate > now) {
        return { label: 'PRÓXIMO', color: '#FF8C00' };
      }
    }
    
    return { label: 'EN CURSO', color: '#DC2E4B' };
  };

  const badgeInfo = getBadgeInfo();

  // Format label mapping
  const getFormatLabel = (formatId: string) => {
    const formatMap: Record<string, string> = {
      'liga': 'Liga',
      'eliminatoria': 'Eliminatoria',
      'grupos-eliminatoria': 'Grupos + Eliminatoria',
      'evento-unico': 'Evento único',
      'serie': 'Serie (Bo3/Bo5)',
      'bracket': 'Eliminación Directa',
      'points': 'Puntos',
    };
    return formatMap[formatId] || formatId;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content}>
        {/* Tournament Header */}
        <View style={styles.header}>
          <Text style={[styles.tournamentName, { color: colors.foreground }]}>
            {tournament.name}
          </Text>
          <View style={[styles.liveBadge, { backgroundColor: `${badgeInfo.color}33` }]}>
            <Ionicons name="flame" size={14} color={badgeInfo.color} />
            <Text style={[styles.liveBadgeText, { color: badgeInfo.color }]}>
              {badgeInfo.label}
            </Text>
          </View>
        </View>

        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {tournament.description || 'Sin descripción'}
        </Text>

        {/* Info Cards */}
        <View style={styles.infoGrid}>
          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Inicio
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.startDate || 'Sin fecha'}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Fin
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {tournament.endDate || 'Sin fecha'}
            </Text>
          </View>

          <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>
              Participantes
            </Text>
            <Text style={[styles.infoValue, { color: colors.foreground }]}>
              {memberCount} / {tournament.participantsEstimated}
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
            {isParticipating && (
              <>
                <View style={styles.balanceRow}>
                  <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                    Aportaste:
                  </Text>
                  <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                    ${contribution.toLocaleString()} {currency}
                  </Text>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </>
            )}

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Pozo total:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                ${totalPool.toLocaleString()} {currency}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.balanceRow}>
              <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                Formato:
              </Text>
              <Text style={[styles.balanceValue, { color: colors.foreground }]}>
                {getFormatLabel(tournament.format)}
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
            onPress={() => navigation.navigate('TournamentPredictions', { tournamentId })}
          >
            <LinearGradient
              colors={Gradients.primary as any}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.primaryActionButton}
            >
              <View style={styles.actionIconContainer}>
                <Ionicons name="football" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionButtonText}>
                  Ver Apuestas
                </Text>
                <Text style={[styles.actionButtonSubtext, { color: 'rgba(255, 255, 255, 0.85)' }]}>
                  Gestiona tus pronósticos
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>

          {isAdmin && (
            <View style={styles.adminActions}>
              <TouchableOpacity 
                style={[styles.modernSecondaryButton, { backgroundColor: colors.secondary }]}
                onPress={() => navigation.navigate('TournamentEvents', { tournamentId })}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="calendar" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.modernSecondaryButtonText, { color: colors.foreground }]}>
                  Gestionar Eventos
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>

              {isOwner && (
                <TouchableOpacity 
                  style={[styles.modernSecondaryButton, { backgroundColor: colors.secondary }]}
                  onPress={() => navigation.navigate('TournamentSettings', { tournamentId })}
                >
                  <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                    <Ionicons name="settings" size={18} color={colors.primary} />
                  </View>
                  <Text style={[styles.modernSecondaryButtonText, { color: colors.foreground }]}>
                    Configuración
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </TouchableOpacity>
              )}

              <TouchableOpacity 
                style={[styles.modernSecondaryButton, { backgroundColor: colors.secondary }]}
              >
                <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                </View>
                <Text style={[styles.modernSecondaryButtonText, { color: colors.foreground }]}>
                  Cargar Resultados
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '700',
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
  primaryActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 16,
    gap: 14,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionContent: {
    flex: 1,
    gap: 2,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  actionButtonSubtext: {
    fontSize: 13,
    opacity: 0.9,
  },
  adminActions: {
    gap: 10,
  },
  modernSecondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modernSecondaryButtonText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default TournamentDetailsScreen;
