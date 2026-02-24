import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gradients, Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card, EmptyState } from '../../../components/CommonComponents';
import { UserBalance } from '../../../services/groupsService';

import { getInitials, formatBalance } from '../../../utils/formatters';

// ─── Helpers ─────────────────────────────────────────────────────────────────

// ─── Props ────────────────────────────────────────────────────────────────────

interface RankingTabProps {
  balances: UserBalance[];
  rankingLoading: boolean;
  rankingRefreshing: boolean;
  currentUserId?: string;
  onRefresh: () => void;
  onParticipantPress: (balance: UserBalance, index: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RankingTab: React.FC<RankingTabProps> = ({
  balances,
  rankingLoading,
  rankingRefreshing,
  currentUserId,
  onRefresh,
  onParticipantPress,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const getBalanceColor = (b: number) =>
    b > 0 ? colors.success : b < 0 ? colors.destructive : colors.mutedForeground;

  return (
    <ScrollView
      style={styles.tabScroll}
      contentContainerStyle={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={rankingRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
        />
      }
    >
      {rankingLoading ? (
        <View style={styles.centeredLoader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : balances.length === 0 ? (
        <EmptyState
          iconName="trophy-outline"
          title="Sin movimientos"
          message="Todavía no hay apuestas liquidadas en este torneo"
        />
      ) : (
        balances.map((balance, index) => {
          const isCurrentUser = balance.uid === currentUserId;

          return (
            <TouchableOpacity
              key={balance.uid}
              activeOpacity={0.75}
              onPress={() => onParticipantPress(balance, index)}
            >
              <Card style={styles.rankingCard}>
                <View style={styles.rankingRow}>
                  <Text
                    style={[
                      styles.rankNumber,
                      {
                        color: index === 0 ? colors.foreground : colors.mutedForeground,
                        fontWeight: index === 0 ? '800' : '600',
                      },
                    ]}
                  >
                    {index + 1}
                  </Text>
                  <View style={styles.rankAvatarWrapper}>
                    {balance.photoURL ? (
                      <Image source={{ uri: balance.photoURL }} style={styles.rankAvatar} />
                    ) : (
                      <LinearGradient
                        colors={Gradients.primary as any}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.rankAvatarPlaceholder}
                      >
                        <Text style={styles.rankAvatarText}>
                          {getInitials(balance.username || balance.displayName)}
                        </Text>
                      </LinearGradient>
                    )}
                  </View>
                  <View style={styles.rankUserInfo}>
                    <View style={styles.rankUsernameRow}>
                      <Text
                        style={[styles.rankUsername, { color: colors.foreground }]}
                        numberOfLines={1}
                      >
                        {balance.username ? `@${balance.username}` : balance.displayName}
                      </Text>
                      {isCurrentUser && (
                        <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                          <Text style={[styles.youText, { color: colors.primary }]}>Tú</Text>
                        </View>
                      )}
                    </View>
                    {(balance.wonCount > 0 || balance.lostCount > 0) && (
                      <View style={styles.wlMicro}>
                        <Text style={[styles.wlWins, { color: colors.success }]}>
                          {balance.wonCount}W
                        </Text>
                        <Text style={[styles.wlSep, { color: colors.mutedForeground }]}> – </Text>
                        <Text style={[styles.wlLoss, { color: colors.destructive }]}>
                          {balance.lostCount}L
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[styles.rankBalance, { color: getBalanceColor(balance.netBalance) }]}
                  >
                    {formatBalance(balance.netBalance)}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </View>
              </Card>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
  );
};

export default RankingTab;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabScroll: { flex: 1 },
  tabContent: { padding: Spacing.lg, paddingBottom: 100 },
  centeredLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  rankingCard: { marginBottom: Spacing.sm, paddingVertical: Spacing.sm },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankNumber: { fontSize: 15, width: 24, textAlign: 'center' },
  rankAvatarWrapper: { position: 'relative' },
  rankAvatar: { width: 48, height: 48, borderRadius: 24 },
  rankAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  rankUserInfo: { flex: 1, gap: 3 },
  rankUsernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankUsername: { fontSize: 15, fontWeight: '600' },
  youBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  youText: { fontSize: 11, fontWeight: '700' },
  wlMicro: { flexDirection: 'row', alignItems: 'center' },
  wlWins: { fontSize: 12, fontWeight: '700' },
  wlSep: { fontSize: 12 },
  wlLoss: { fontSize: 12, fontWeight: '700' },
  rankBalance: { fontSize: 18, fontWeight: '700' },
});
