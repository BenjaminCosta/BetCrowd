import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { Colors, Gradients } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { LoadingBar } from '../components/LoadingBar';
import { Card, EmptyState, SectionHeader } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getTournament, Tournament } from '../services/tournamentService';
import { calculateTournamentBalances, UserBalance } from '../services/groupsService';

const TournamentGroupScreen = ({ navigation, route }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournamentId } = route.params || {};

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [myBalance, setMyBalance] = useState<UserBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const isFirstFocus = useRef(true);

  useEffect(() => {
    if (tournamentId) {
      loadGroupData();
    }
  }, [tournamentId]);

  // Auto-refresh when screen comes back into focus (except first time)
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      
      if (tournamentId) {
        setRefreshing(true);
        loadGroupData(true);
      }
    }, [tournamentId])
  );

  const loadGroupData = async (showLoadingBar = false) => {
    try {
      if (!showLoadingBar) {
        setLoading(true);
      }
      
      const [tournamentData, balancesData] = await Promise.all([
        getTournament(tournamentId),
        calculateTournamentBalances(tournamentId),
      ]);
      
      setTournament(tournamentData);
      setBalances(balancesData);
      
      // Find current user's balance
      const userBalance = balancesData.find(b => b.uid === user?.uid) || null;
      setMyBalance(userBalance);
    } catch (error) {
      console.error('Error loading group data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroupData(true);
  };

  const formatBalance = (balance: number): string => {
    if (balance === 0) return '$0';
    return balance > 0 ? `+$${balance.toFixed(0)}` : `-$${Math.abs(balance).toFixed(0)}`;
  };

  const getBalanceColor = (balance: number): string => {
    if (balance > 0) return colors.success;
    if (balance < 0) return colors.destructive;
    return colors.mutedForeground;
  };

  const getBalanceLabel = (balance: number): string => {
    if (balance === 0) return 'Sin movimientos aún';
    return balance > 0 ? 'Ganaste en total' : 'Perdiste en total';
  };

  const getInitials = (name: string): string => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar showBackButton />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando grupo...
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
            Grupo no encontrado
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      <LoadingBar isLoading={refreshing} />
      
      <ScrollView 
        style={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Header Card */}
        <Card style={styles.headerCard}>
          <View style={styles.cardGradientOverlay}>
            <LinearGradient
              colors={[colors.primary + '10', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradientBackground}
            />
          </View>
          <View style={styles.headerContent}>
            <View style={styles.tournamentInfo}>
              <Text style={[styles.tournamentName, { color: colors.foreground }]}>
                {tournament.name}
              </Text>
              <View style={styles.membersBadge}>
                <Ionicons name="people" size={14} color={colors.primary} />
                <Text style={[styles.membersText, { color: colors.mutedForeground }]}>
                  {balances.length} {balances.length === 1 ? 'miembro' : 'miembros'}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.infoButton, { backgroundColor: colors.primary }]}
              onPress={() => navigation.navigate('TournamentDetails', { tournamentId })}
            >
              <Ionicons name="information" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Card>

        {/* My Balance Section */}
        {myBalance && (
          <Card style={styles.myBalanceCard}>
            <View style={styles.myBalanceContent}>
              <Text style={[styles.myBalanceLabel, { color: colors.mutedForeground }]}>
                Tu balance en este torneo
              </Text>
              <Text style={[
                styles.myBalanceAmount,
                { color: getBalanceColor(myBalance.netBalance) }
              ]}>
                {formatBalance(myBalance.netBalance)}
              </Text>
              <Text style={[styles.myBalanceSubtext, { color: colors.mutedForeground }]}>
                {getBalanceLabel(myBalance.netBalance)}
              </Text>
            </View>
          </Card>
        )}

        {/* Ranking Section */}
        <View style={styles.section}>
          <SectionHeader title="Ranking" />
          
          {balances.length === 0 ? (
            <Card>
              <EmptyState
                iconName="trophy-outline"
                title="Sin movimientos"
                message="Todavía no hay apuestas liquidadas en este torneo"
              />
            </Card>
          ) : (
            <View style={styles.rankingList}>
              {balances.map((balance, index) => {
                const isCurrentUser = balance.uid === user?.uid;
                const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                const podiumColor = index < 3 ? podiumColors[index] : null;
                
                return (
                  <Card 
                    key={balance.uid} 
                    style={[
                      styles.rankingCard,
                      isCurrentUser && { borderWidth: 2, borderColor: colors.primary }
                    ]}
                  >
                    <View style={styles.rankingContent}>
                      {/* User Info with integrated rank */}
                      <View style={styles.userMainSection}>
                        <Text style={[styles.rankNumber, { color: colors.mutedForeground }]}>
                          {index + 1}
                        </Text>
                        
                        <View style={styles.avatarContainer}>
                          {podiumColor && (
                            <View style={[styles.podiumIndicator, { backgroundColor: podiumColor }]} />
                          )}
                          {balance.photoURL ? (
                            <Image source={{ uri: balance.photoURL }} style={styles.avatar} />
                          ) : (
                            <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                              <Text style={styles.avatarText}>
                                {getInitials(balance.displayName)}
                              </Text>
                            </View>
                          )}
                        </View>
                        
                        <View style={styles.userInfo}>
                          <View style={styles.usernameRow}>
                            <Text style={[styles.username, { color: colors.foreground }]} numberOfLines={1}>
                              {balance.displayName}
                            </Text>
                            {isCurrentUser && (
                              <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                                <Text style={[styles.youText, { color: colors.primary }]}>
                                  Tú
                                </Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.userHandle, { color: colors.mutedForeground }]} numberOfLines={1}>
                            @{balance.username}
                          </Text>
                        </View>
                      </View>

                      {/* Balance */}
                      <View style={styles.balanceSection}>
                        <Text style={[
                          styles.balanceAmount,
                          { color: getBalanceColor(balance.netBalance) }
                        ]}>
                          {formatBalance(balance.netBalance)}
                        </Text>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>

        {/* View Tournament Details Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.detailsButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate('TournamentDetails', { tournamentId })}
            activeOpacity={0.8}
          >
            <Text style={styles.detailsButtonText}>Ver detalles del torneo</Text>
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
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerCard: {
    marginBottom: 24,
    position: 'relative',
  },
  cardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    overflow: 'hidden',
  },
  gradientBackground: {
    flex: 1,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tournamentInfo: {
    flex: 1,
    gap: 8,
  },
  tournamentName: {
    fontSize: 22,
    fontWeight: '700',
  },
  membersBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membersText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 24,
  },
  rankingList: {
    gap: 10,
  },
  rankingCard: {
    padding: 16,
  },
  rankingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userMainSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 15,
    fontWeight: '500',
    width: 24,
    textAlign: 'center',
  },
  avatarContainer: {
    position: 'relative',
  },
  podiumIndicator: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#141414',
    zIndex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  username: {
    fontSize: 15,
    fontWeight: '600',
  },
  youBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  youText: {
    fontSize: 11,
    fontWeight: '700',
  },
  userHandle: {
    fontSize: 13,
    fontWeight: '400',
  },
  balanceSection: {
    alignItems: 'flex-end',
  },
  balanceAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  myBalanceCard: {
    marginBottom: 24,
    padding: 24,
    alignItems: 'center',
  },
  myBalanceContent: {
    alignItems: 'center',
    gap: 8,
  },
  myBalanceLabel: {
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  myBalanceAmount: {
    fontSize: 48,
    fontWeight: '700',
    marginVertical: 8,
  },
  myBalanceSubtext: {
    fontSize: 15,
    fontWeight: '500',
  },
  detailsButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  detailsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default TournamentGroupScreen;
