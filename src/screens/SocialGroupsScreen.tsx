import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors } from '../theme/colors';
import { TopBar } from '../components/TopBar';
import { Card, EmptyState } from '../components/CommonComponents';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useTournaments } from '../context/TournamentsContext';
import { calculateTournamentBalances } from '../services/groupsService';

interface GroupSummary {
  tournamentId: string;
  tournamentName: string;
  memberCount: number;
  topBalance: number;
  myBalance: number;
  format: string;
}

const SocialGroupsScreen = ({ navigation }: any) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { user } = useAuth();
  const { tournaments, loading: loadingTournaments, refreshing, refresh } = useTournaments();
  
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGroups();
  }, [tournaments, user]);

  const loadGroups = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      const activeTournaments = tournaments.filter(t => t.status !== 'deleted');
      
      // Calculate summaries for each tournament
      const summariesPromises = activeTournaments.map(async (tournament) => {
        try {
          const balances = await calculateTournamentBalances(tournament.id);
          const myBalance = balances.find(b => b.uid === user.uid);
          const topBalance = balances.length > 0 ? balances[0].netBalance : 0;
          
          return {
            tournamentId: tournament.id,
            tournamentName: tournament.name,
            memberCount: balances.length,
            topBalance,
            myBalance: myBalance?.netBalance || 0,
            format: tournament.format,
          };
        } catch (error) {
          console.error(`Error loading group summary for ${tournament.id}:`, error);
          return null;
        }
      });
      
      const summaries = (await Promise.all(summariesPromises)).filter(Boolean) as GroupSummary[];
      setGroups(summaries);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    refresh();
    loadGroups();
  };

  const getFormatIcon = (formatId: string) => {
    const iconMap: Record<string, any> = {
      'liga': 'trophy',
      'eliminatoria': 'git-branch',
      'grupos-eliminatoria': 'grid',
      'evento-unico': 'flag',
      'serie': 'list',
      'bracket': 'git-branch',
      'points': 'analytics',
      'otro': 'ellipsis-horizontal',
    };
    return iconMap[formatId] || 'trophy';
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

  if (loading || loadingTournaments) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <TopBar />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
            Cargando grupos...
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <TopBar showBackButton />
      
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.foreground }]}>
            Mis Grupos
          </Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Torneos donde eres miembro
          </Text>
        </View>

        {/* Groups List */}
        {groups.length === 0 ? (
          <View style={styles.emptyContainer}>
            <EmptyState
              iconName="people-outline"
              title="Sin grupos"
              message="Únete a un torneo para ver los grupos aquí"
            />
          </View>
        ) : (
          <View style={styles.groupsList}>
            {groups.map((group) => (
              <TouchableOpacity
                key={group.tournamentId}
                onPress={() => navigation.navigate('TournamentGroup', { tournamentId: group.tournamentId })}
                activeOpacity={0.7}
              >
                <Card style={styles.groupCard}>
                  <View style={styles.cardGradientOverlay}>
                    <LinearGradient
                      colors={[colors.primary + '10', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.gradientBackground}
                    />
                  </View>
                  <View style={styles.groupHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
                      <Ionicons 
                        name={getFormatIcon(group.format)} 
                        size={24} 
                        color={colors.primary} 
                      />
                    </View>
                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: colors.foreground }]}>
                        {group.tournamentName}
                      </Text>
                      <View style={styles.memberInfo}>
                        <Ionicons name="people" size={14} color={colors.mutedForeground} />
                        <Text style={[styles.memberCount, { color: colors.mutedForeground }]}>
                          {group.memberCount} {group.memberCount === 1 ? 'miembro' : 'miembros'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.mutedForeground} />
                  </View>

                  <View style={[styles.divider, { backgroundColor: colors.border }]} />

                  <View style={styles.balancesRow}>
                    <View style={styles.balanceItem}>
                      <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                        Tu balance
                      </Text>
                      <Text style={[
                        styles.balanceValue, 
                        { color: getBalanceColor(group.myBalance) }
                      ]}>
                        {formatBalance(group.myBalance)}
                      </Text>
                    </View>
                    
                    <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />
                    
                    <View style={styles.balanceItem}>
                      <Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>
                        Top del grupo
                      </Text>
                      <Text style={[
                        styles.balanceValue, 
                        { color: getBalanceColor(group.topBalance) }
                      ]}>
                        {formatBalance(group.topBalance)}
                      </Text>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
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
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
  },
  emptyContainer: {
    marginTop: 80,
  },
  groupsList: {
    gap: 16,
    paddingBottom: 24,
  },
  groupCard: {
    padding: 16,
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
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupInfo: {
    flex: 1,
    gap: 4,
  },
  groupName: {
    fontSize: 17,
    fontWeight: '600',
  },
  memberInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memberCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  balancesRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  balanceLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  balanceValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  verticalDivider: {
    width: 1,
    height: 40,
    marginHorizontal: 16,
  },
});

export default SocialGroupsScreen;
