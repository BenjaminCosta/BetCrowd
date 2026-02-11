import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Badge } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../services/tournamentService';
import {
  getBet,
  getMyPick,
  upsertMyPick,
  lockBet,
  cancelBet,
  settleBet,
  getAllPicks,
  type Bet,
  type Pick,
} from '../services/betService';

const BetDetailsScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId, eventId, betId } = route.params || {};

  const [bet, setBet] = useState<Bet | null>(null);
  const [myPick, setMyPick] = useState<Pick | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);

  // Place pick state
  const [selectedOption, setSelectedOption] = useState('');
  const [scoreHome, setScoreHome] = useState('');
  const [scoreAway, setScoreAway] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (bet && myPick) {
      // Pre-fill selection if editing
      if (typeof myPick.selection === 'string') {
        setSelectedOption(myPick.selection);
      } else if (myPick.selection?.home !== undefined) {
        setScoreHome(myPick.selection.home.toString());
        setScoreAway(myPick.selection.away.toString());
      }
    }
  }, [bet, myPick]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [betData, pickData] = await Promise.all([
        getBet(tournamentId, eventId, betId),
        user ? getMyPick(tournamentId, eventId, betId, user.uid) : null,
      ]);

      setBet(betData);
      setMyPick(pickData);

      if (user) {
        const admin = await isUserAdmin(tournamentId, user.uid);
        setIsAdmin(admin);
      }
    } catch (error) {
      console.error('Error loading bet:', error);
      Alert.alert('Error', 'No se pudo cargar la apuesta');
    } finally {
      setLoading(false);
    }
  };

  const handlePlacePick = async () => {
    if (!user || !bet) return;

    let selection: any;

    if (bet.type === 'score') {
      const home = parseInt(scoreHome);
      const away = parseInt(scoreAway);
      if (isNaN(home) || isNaN(away)) {
        Alert.alert('Error', 'Ingresa un resultado válido');
        return;
      }
      selection = { home, away };
    } else {
      if (!selectedOption) {
        Alert.alert('Error', 'Selecciona una opción');
        return;
      }
      selection = selectedOption;
    }

    try {
      setPlacing(true);
      await upsertMyPick(tournamentId, eventId, betId, user.uid, selection, bet.stakeAmount);
      Alert.alert('Éxito', myPick ? 'Apuesta actualizada' : 'Apuesta realizada');
      loadData(); // Reload to show updated pick
    } catch (error: any) {
      Alert.alert('Error', error.message || 'No se pudo realizar la apuesta');
    } finally {
      setPlacing(false);
    }
  };

  const handleLock = () => {
    Alert.alert('Cerrar apuesta', '¿Deseas cerrar esta apuesta? No se podrán hacer más predicciones.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Cerrar',
        onPress: async () => {
          try {
            await lockBet(tournamentId, eventId, betId);
            Alert.alert('Éxito', 'Apuesta cerrada');
            loadData();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleCancel = () => {
    Alert.alert('Cancelar apuesta', '¿Estás seguro? Esta acción no se puede deshacer.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sí',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBet(tournamentId, eventId, betId);
            Alert.alert('Éxito', 'Apuesta cancelada');
            navigation.goBack();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleSettle = async () => {
    Alert.alert(
      'Resolver apuesta',
      'Ingresa el resultado ganador. Esta acción marcará la apuesta como resuelta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: () => {
            // For now, just mark as settled without specific result
            // In production, you'd show a form to enter the winning option
            settleBetWithResult();
          },
        },
      ]
    );
  };

  const settleBetWithResult = async () => {
    try {
      // TODO: Show form to select winning option
      // For now, just settle without result
      await settleBet(tournamentId, eventId, betId, {});
      Alert.alert('Éxito', 'Apuesta resuelta');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getStatusBadge = (status: string) => {
    let backgroundColor = colors.mutedForeground;
    let label = status.toUpperCase();
    
    switch (status) {
      case 'open':
        backgroundColor = '#10B981';
        label = 'ABIERTA';
        break;
      case 'locked':
        backgroundColor = colors.mutedForeground;
        label = 'CERRADA';
        break;
      case 'settled':
        backgroundColor = '#10B981';
        label = 'RESUELTA';
        break;
      case 'cancelled':
        backgroundColor = colors.destructive;
        label = 'CANCELADA';
        break;
    }
    
    return (
      <View style={[styles.statusBadge, { backgroundColor }]}>
        <Text style={[styles.statusBadgeText, { color: colors.foreground }]}>
          {label}
        </Text>
      </View>
    );
  };

  const canPlacePick = bet?.status === 'open';
  const canEdit = myPick && bet?.status === 'open';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (!bet) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Apuesta no encontrada
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Bet Info */}
          <Card style={styles.betCard}>
            <View style={styles.cardGradientOverlay}>
              <LinearGradient
                colors={[colors.primary + '10', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBackground}
              />
            </View>
            <View style={styles.betHeader}>
              <Text style={[styles.betTitle, { color: colors.foreground }]}>
                {bet.title}
              </Text>
              {getStatusBadge(bet.status)}
            </View>

            {bet.description && (
              <Text style={[styles.betDescription, { color: colors.mutedForeground }]}>
                {bet.description}
              </Text>
            )}

            <View style={styles.betMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="cash-outline" size={16} color={colors.mutedForeground} />
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
                  ${bet.stakeAmount.toLocaleString('es-AR')}
                </Text>
              </View>
            </View>
          </Card>

          {/* Admin Actions */}
          {isAdmin && bet.status !== 'cancelled' && (
            <Card style={styles.adminCard}>
              <View style={styles.adminButtons}>
                {bet.status === 'open' && (
                  <TouchableOpacity
                    style={[styles.adminButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={handleLock}
                  >
                    <Ionicons name="lock-closed-outline" size={18} color={colors.foreground} />
                    <Text style={[styles.adminButtonText, { color: colors.foreground }]}>
                      Cerrar
                    </Text>
                  </TouchableOpacity>
                )}

                {bet.status === 'locked' && (
                  <TouchableOpacity
                    style={[styles.adminButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={handleSettle}
                  >
                    <Ionicons name="checkmark-done-outline" size={18} color={colors.success} />
                    <Text style={[styles.adminButtonText, { color: colors.success }]}>
                      Resolver
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.adminButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={handleCancel}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.destructive} />
                  <Text style={[styles.adminButtonText, { color: colors.destructive }]}>
                    Cancelar
                  </Text>
                </TouchableOpacity>
              </View>
            </Card>
          )}

          {/* My Pick or Place Pick UI */}
          {myPick ? (
            <Card style={styles.pickCard}>
              <View style={styles.pickHeader}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={[styles.pickTitle, { color: colors.foreground }]}>
                  {canEdit ? 'Tu apuesta (puedes editarla)' : 'Tu apuesta'}
                </Text>
              </View>

              <View style={[styles.pickSummary, { backgroundColor: colors.muted }]}>
                <Text style={[styles.pickLabel, { color: colors.mutedForeground }]}>
                  Selección:
                </Text>
                <Text style={[styles.pickValue, { color: colors.foreground }]}>
                  {typeof myPick.selection === 'string'
                    ? myPick.selection
                    : `${myPick.selection.home} - ${myPick.selection.away}`}
                </Text>
              </View>

              {canEdit && (
                <Text style={[styles.editHint, { color: colors.mutedForeground }]}>
                  Puedes cambiar tu selección mientras la apuesta esté abierta
                </Text>
              )}
            </Card>
          ) : (
            <Card style={styles.pickCard}>
              <View style={styles.pickHeader}>
                <Ionicons name="hand-right-outline" size={20} color={colors.accent} />
                <Text style={[styles.pickTitle, { color: colors.foreground }]}>
                  Hacer tu apuesta
                </Text>
              </View>

              {!canPlacePick && (
                <View style={[styles.closedMessage, { backgroundColor: colors.warning + '20' }]}>
                  <Ionicons name="lock-closed" size={16} color={colors.warning} />
                  <Text style={[styles.closedText, { color: colors.warning }]}>
                    Esta apuesta ya está cerrada
                  </Text>
                </View>
              )}
            </Card>
          )}

          {/* Place/Edit Pick Form */}
          {(canPlacePick || canEdit) && (
            <Card style={styles.formCard}>
              {bet.type === 'score' ? (
                <View style={styles.scoreForm}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                    Resultado exacto
                  </Text>
                  <View style={styles.scoreInputs}>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: colors.input, color: colors.foreground }]}
                      value={scoreHome}
                      onChangeText={setScoreHome}
                      placeholder="Local"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                    />
                    <Text style={[styles.scoreSeparator, { color: colors.foreground }]}>-</Text>
                    <TextInput
                      style={[styles.scoreInput, { backgroundColor: colors.input, color: colors.foreground }]}
                      value={scoreAway}
                      onChangeText={setScoreAway}
                      placeholder="Visitante"
                      placeholderTextColor={colors.mutedForeground}
                      keyboardType="number-pad"
                    />
                  </View>
                </View>
              ) : (
                <View style={styles.optionsForm}>
                  <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
                    Selecciona tu opción
                  </Text>
                  <View style={styles.optionsGrid}>
                    {bet.options.map((option) => (
                      <TouchableOpacity
                        key={option}
                        style={[
                          styles.optionChip,
                          { backgroundColor: colors.secondary, borderColor: colors.border },
                          selectedOption === option && {
                            borderColor: colors.primary,
                            backgroundColor: colors.primary + '10',
                          },
                        ]}
                        onPress={() => setSelectedOption(option)}
                      >
                        <Text
                          style={[
                            styles.optionChipText,
                            { color: selectedOption === option ? colors.primary : colors.foreground },
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.placeButton, { backgroundColor: colors.primary }]}
                onPress={handlePlacePick}
                disabled={placing}
              >
                {placing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.placeButtonText}>
                      {myPick ? 'Actualizar Apuesta' : 'Confirmar Apuesta'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </Card>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  betCard: {
    marginBottom: Spacing.lg,
    position: 'relative',
    overflow: 'hidden',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gradientBackground: {
    flex: 1,
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  betTitle: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
    marginRight: Spacing.md,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  betDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  betMeta: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  adminCard: {
    marginBottom: Spacing.lg,
  },
  adminButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  adminButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  adminButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pickCard: {
    marginBottom: Spacing.lg,
  },
  pickHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  pickTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickSummary: {
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  pickLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  pickValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  editHint: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  closedMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  closedText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formCard: {
    marginBottom: Spacing.xl,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  scoreForm: {
    marginBottom: Spacing.lg,
  },
  scoreInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  scoreInput: {
    flex: 1,
    height: 56,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  scoreSeparator: {
    fontSize: 24,
    fontWeight: '700',
  },
  optionsForm: {
    marginBottom: Spacing.lg,
  },
  optionsGrid: {
    gap: Spacing.sm,
  },
  optionChip: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  optionChipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  placeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  placeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default BetDetailsScreen;
