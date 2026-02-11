import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../services/tournamentService';
import { listenBets, getMyPick, lockBet, cancelBet, settleBet, type Bet } from '../services/betService';
import { BetCardCompact, SwipeableRow } from '../components/BetanoComponents';

const BetsListScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId, eventId, eventTitle } = route.params || {};

  const [bets, setBets] = useState<Bet[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userSelections, setUserSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (tournamentId && user) {
      checkAdminStatus();
    }
  }, [tournamentId, user]);

  useEffect(() => {
    if (!tournamentId || !eventId) return;

    const unsubscribe = listenBets(tournamentId, eventId, async (updatedBets) => {
      setBets(updatedBets);
      setLoading(false);
      
      // Load user picks for each bet
      if (user) {
        const selections: Record<string, string> = {};
        await Promise.all(
          updatedBets.map(async (bet) => {
            const pick = await getMyPick(tournamentId, eventId, bet.id, user.uid);
            if (pick) {
              selections[bet.id] = typeof pick.selection === 'object' 
                ? JSON.stringify(pick.selection)
                : String(pick.selection);
            }
          })
        );
        setUserSelections(selections);
      }
    });

    return () => unsubscribe();
  }, [tournamentId, eventId, user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    try {
      const admin = await isUserAdmin(tournamentId, user.uid);
      setIsAdmin(admin);
    } catch (error) {
      console.error('Error checking admin status:', error);
    }
  };

  const handleBetOptionPress = (bet: Bet, option: string) => {
    navigation.navigate('BetDetails', {
      tournamentId,
      eventId,
      betId: bet.id,
    });
  };

  const handleEditBet = (bet: Bet) => {
    navigation.navigate('EditBet', {
      tournamentId,
      eventId,
      betId: bet.id,
    });
  };

  const handleLockBet = (bet: Bet) => {
    Alert.alert(
      'Cerrar apuesta',
      '¿Deseas cerrar esta apuesta? No se podrán hacer más predicciones.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar',
          onPress: async () => {
            try {
              await lockBet(tournamentId, eventId, bet.id);
              Alert.alert('Éxito', 'Apuesta cerrada');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cerrar');
            }
          },
        },
      ]
    );
  };

  const handleCancelBet = (bet: Bet) => {
    Alert.alert(
      'Cancelar apuesta',
      '¿Estás seguro? Esta acción no se puede deshacer.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancelar apuesta',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelBet(tournamentId, eventId, bet.id);
              Alert.alert('Éxito', 'Apuesta cancelada');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'No se pudo cancelar');
            }
          },
        },
      ]
    );
  };

  const handleSettleBet = (bet: Bet) => {
    // For now, just navigate to bet details where settlement can be done
    // TODO: Add inline settlement modal
    navigation.navigate('BetDetails', {
      tournamentId,
      eventId,
      betId: bet.id,
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando apuestas...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        
        <ScrollView style={styles.content}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              Apuestas
            </Text>
            {eventTitle && (
              <Text style={[styles.eventTitle, { color: colors.foreground }]}>
                {eventTitle}
              </Text>
            )}
          </View>

          {/* Create Bet Button - Only for admins */}
          {isAdmin && (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => navigation.navigate('CreateBet', { tournamentId, eventId })}
            >
              <Ionicons name="add-circle-outline" size={20} color={colors.foreground} />
              <Text style={[styles.createButtonText, { color: colors.foreground }]}>
                Crear Apuesta
              </Text>
            </TouchableOpacity>
          )}

          {/* Bets List */}
          {bets.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cash-outline" size={64} color={colors.mutedForeground} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                Todavía no hay apuestas
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {isAdmin
                  ? 'Crea la primera apuesta para que los participantes puedan jugar'
                  : 'El administrador aún no ha creado apuestas para este evento'}
              </Text>
            </View>
          ) : (
            <View style={styles.betsList}>
              {bets.map((bet) => {
                const userSelection = userSelections[bet.id];
                
                return (
                  <SwipeableRow
                    key={bet.id}
                    enabled={isAdmin}
                    actions={[
                      {
                        label: 'Editar',
                        icon: 'create-outline',
                        color: colors.primary,
                        onPress: () => handleEditBet(bet),
                      },
                      {
                        label: 'Cerrar',
                        icon: 'lock-closed-outline',
                        color: '#F59E0B',
                        onPress: () => handleLockBet(bet),
                      },
                      {
                        label: 'Resolver',
                        icon: 'checkmark-circle-outline',
                        color: '#10B981',
                        onPress: () => handleSettleBet(bet),
                      },
                      {
                        label: 'Cancelar',
                        icon: 'close-circle-outline',
                        color: colors.destructive,
                        onPress: () => handleCancelBet(bet),
                      },
                    ]}
                  >
                    <BetCardCompact
                      bet={bet}
                      theme={theme}
                      onOptionPress={(option) => handleBetOptionPress(bet, option)}
                      userSelection={userSelection || null}
                      showOdds={true}
                    />
                  </SwipeableRow>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
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
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  subtitle: {
    fontSize: 16,
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xxl,
  },
  createButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: Spacing.lg,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  betsList: {
    gap: Spacing.sm,
  },
});

export default BetsListScreen;
