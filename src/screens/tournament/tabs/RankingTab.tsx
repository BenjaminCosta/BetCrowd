import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gradients, Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card, EmptyState } from '../../../components/CommonComponents';
import { UserBalance } from '../../../services/groupsService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) => {
  const nameTrim = (name || '').trim();
  if (!nameTrim) return '--';
  const parts = nameTrim.split(' ').filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return nameTrim.slice(0, 2).toUpperCase();
};

const formatBalance = (b: number) =>
  b === 0 ? '$0' : b > 0 ? `+$${b.toFixed(0)}` : `-$${Math.abs(b).toFixed(0)}`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RankingTabProps {
  balances: UserBalance[];
  rankingLoading: boolean;
  rankingRefreshing: boolean;
  currentUserId?: string;
  onRefresh: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

const RankingTab: React.FC<RankingTabProps> = ({
  balances,
  rankingLoading,
  rankingRefreshing,
  currentUserId,
  onRefresh,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const podiumColors = ['#FFD700', '#C0C0C0', '#CD7F32'];

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
          const podiumColor = index < 3 ? podiumColors[index] : null;

          return (
            <Card
              key={balance.uid}
              style={[
                styles.rankingCard,
                isCurrentUser && { borderWidth: 2, borderColor: colors.primary },
              ]}
            >
              <View style={styles.rankingRow}>
                <Text style={[styles.rankNumber, { color: colors.mutedForeground }]}>
                  {index + 1}
                </Text>
                <View style={styles.rankAvatarWrapper}>
                  {podiumColor && (
                    <View style={[styles.podiumDot, { backgroundColor: podiumColor }]} />
                  )}
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
                        {getInitials(balance.displayName)}
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
                      {balance.displayName}
                    </Text>
                    {isCurrentUser && (
                      <View style={[styles.youBadge, { backgroundColor: colors.primary + '20' }]}>
                        <Text style={[styles.youText, { color: colors.primary }]}>Tú</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.rankHandle, { color: colors.mutedForeground }]}>
                    @{balance.username}
                  </Text>
                </View>
                <Text
                  style={[styles.rankBalance, { color: getBalanceColor(balance.netBalance) }]}
                >
                  {formatBalance(balance.netBalance)}
                </Text>
              </View>
            </Card>
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
  rankingCard: { marginBottom: Spacing.sm },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankNumber: { fontSize: 15, fontWeight: '500', width: 24, textAlign: 'center' },
  rankAvatarWrapper: { position: 'relative' },
  podiumDot: {
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
  rankAvatar: { width: 48, height: 48, borderRadius: 24 },
  rankAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: { fontSize: 17, fontWeight: '600', color: '#FFF' },
  rankUserInfo: { flex: 1, gap: 4 },
  rankUsernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankUsername: { fontSize: 15, fontWeight: '600' },
  youBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  youText: { fontSize: 11, fontWeight: '700' },
  rankHandle: { fontSize: 13 },
  rankBalance: { fontSize: 18, fontWeight: '700' },
});
