import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, Badge } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { isUserAdmin } from '../services/tournamentService';
import { listenBets, hasUserPicked, type Bet } from '../services/betService';

const BetsListScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId, eventId, eventTitle } = route.params || {};

  const [bets, setBets] = useState<Bet[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userPicksMap, setUserPicksMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tournamentId && user) {
      checkAdminStatus();
    }
  }, [tournamentId, user]);

  useEffect(() => {
    if (!tournamentId || !eventId) return;

    const unsubscribe = listenBets(tournamentId, eventId, (updatedBets) => {
      setBets(updatedBets);
      setLoading(false);
      
      // Check user picks for each bet
      if (user) {
        checkUserPicks(updatedBets);
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

  const checkUserPicks = async (betsList: Bet[]) => {
    if (!user) return;
    
    const picksMap: Record<string, boolean> = {};
    await Promise.all(
      betsList.map(async (bet) => {
        const hasPick = await hasUserPicked(tournamentId, eventId, bet.id, user.uid);
        picksMap[bet.id] = hasPick;
      })
    );
    setUserPicksMap(picksMap);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'open':
        return <Badge variant="success">ABIERTA</Badge>;
      case 'locked':
        return <Badge variant="warning">CERRADA</Badge>;
      case 'settled':
        return <Badge variant="default">RESUELTA</Badge>;
      case 'cancelled':
        return <Badge variant="default">CANCELADA</Badge>;
      default:
        return null;
    }
  };

  const getBetTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      winner: 'Ganador',
      score: 'Resultado exacto',
      over_under: 'Más/Menos',
      custom: 'Personalizada',
    };
    return labels[type] || type;
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Apuestas
          </Text>
          {eventTitle && (
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
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
              const hasPicked = userPicksMap[bet.id];
              return (
                <TouchableOpacity
                  key={bet.id}
                  style={[styles.betCard, { backgroundColor: colors.card }]}
                  onPress={() =>
                    navigation.navigate('BetDetails', {
                      tournamentId,
                      eventId,
                      betId: bet.id,
                    })
                  }
                >
                  <View style={styles.betHeader}>
                    <View style={styles.betInfo}>
                      <Text style={[styles.betTitle, { color: colors.foreground }]}>
                        {bet.title}
                      </Text>
                      <Text style={[styles.betType, { color: colors.mutedForeground }]}>
                        {getBetTypeLabel(bet.type)}
                      </Text>
                    </View>
                    {getStatusBadge(bet.status)}
                  </View>

                  {bet.description && (
                    <Text
                      style={[styles.betDescription, { color: colors.mutedForeground }]}
                      numberOfLines={2}
                    >
                      {bet.description}
                    </Text>
                  )}

                  <View style={styles.betFooter}>
                    <View style={styles.betMeta}>
                      <Ionicons name="cash-outline" size={14} color={colors.mutedForeground} />
                      <Text style={[styles.betAmount, { color: colors.mutedForeground }]}>
                        ${bet.stakeAmount.toLocaleString('es-AR')}
                      </Text>
                    </View>

                    {hasPicked && bet.status === 'open' && (
                      <View style={[styles.pickedBadge, { backgroundColor: colors.success + '20' }]}>
                        <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                        <Text style={[styles.pickedText, { color: colors.success }]}>
                          Ya apostaste
                        </Text>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
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
    gap: Spacing.md,
  },
  betCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.md,
  },
  betHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  betInfo: {
    flex: 1,
    marginRight: Spacing.md,
  },
  betTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  betType: {
    fontSize: 13,
  },
  betDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  betFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  betMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  betAmount: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  pickedText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BetsListScreen;
