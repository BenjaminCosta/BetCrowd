import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Gradients, Colors, Spacing, BorderRadius } from '../../../theme/colors';
import { useTheme } from '../../../context/ThemeContext';
import { Card, EmptyState } from '../../../components/CommonComponents';
import { UserBalance } from '../../../services/groupsService';

import { getInitials, formatBalance } from '../../../utils/formatters';

// ─── Constants ────────────────────────────────────────────────────────────────
const SCREEN_H = Dimensions.get('window').height;
const SCREEN_W = Dimensions.get('window').width;
const TOOLTIP_WIDTH = 200;

// ─── Props ────────────────────────────────────────────────────────────────────

interface RankingTabProps {
  balances: UserBalance[];
  rankingLoading: boolean;
  rankingRefreshing: boolean;
  currentUserId?: string;
  isAdmin?: boolean;
  onRefresh: () => void;
  onParticipantPress: (balance: UserBalance, index: number) => void;
  onRemoveMember?: (balance: UserBalance) => void;
}

// ─── Tooltip state ───────────────────────────────────────────────────────────────────
type TooltipState = {
  visible: boolean;
  balance: UserBalance | null;
  index: number;
  pageY: number;
  pageX: number;
};

// ─── Component ────────────────────────────────────────────────────────────────

const RankingTab: React.FC<RankingTabProps> = ({
  balances,
  rankingLoading,
  rankingRefreshing,
  currentUserId,
  isAdmin = false,
  onRefresh,
  onParticipantPress,
  onRemoveMember,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(8)).current;
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false, balance: null, index: 0, pageY: 0, pageX: 0,
  });
  const rowRefs = useRef<Record<string, any>>({});
  const usernameRefs = useRef<Record<string, any>>({});

  const showTooltip = (balance: UserBalance, index: number, uid: string) => {
    const nodeRef = rowRefs.current[uid];
    if (!nodeRef?.measure) {
      onParticipantPress(balance, index);
      return;
    }
    nodeRef.measure((_x: number, _y: number, _w: number, h: number, _px: number, py: number) => {
      const tooltipH =
        isAdmin && balance.uid !== currentUserId &&
        balance.role !== 'admin' && balance.role !== 'owner'
          ? 104 : 56;
      const clampedY = Math.max(60, Math.min(py + h / 2 - tooltipH / 2, SCREEN_H - tooltipH - 60));

      const doOpen = (pageX: number) => {
        setTooltip({ visible: true, balance, index, pageY: clampedY, pageX });
        fadeAnim.setValue(0);
        slideAnim.setValue(8);
        Animated.parallel([
          Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
          Animated.timing(slideAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
        ]).start();
      };

      const uRef = usernameRefs.current[uid];
      if (uRef?.measureInWindow) {
        uRef.measureInWindow((ux: number) => {
          doOpen(Math.min(ux, SCREEN_W - TOOLTIP_WIDTH - Spacing.lg));
        });
      } else {
        doOpen(Spacing.lg);
      }
    });
  };

  const hideTooltip = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 110, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 4, duration: 110, useNativeDriver: true }),
    ]).start(() => {
      setTooltip((prev) => ({ ...prev, visible: false }));
      cb?.();
    });
  };

  const tooltipBalance = tooltip.balance;
  const canRemove =
    isAdmin && !!tooltipBalance &&
    tooltipBalance.uid !== currentUserId &&
    tooltipBalance.role !== 'admin' && tooltipBalance.role !== 'owner';

  const tooltipBg = theme === 'dark' ? '#1C1C1E' : '#2C2C2E';

  const getBalanceColor = (b: number) =>
    b > 0 ? colors.success : b < 0 ? colors.destructive : colors.mutedForeground;

  return (
    <>
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
              ref={(ref) => { if (ref) rowRefs.current[balance.uid] = ref as any; }}
              activeOpacity={0.75}
              onPress={() => showTooltip(balance, index, balance.uid)}
            >
              <Card
                style={[
                  styles.rankingCard,
                  index < 3 && {
                    backgroundColor: colors.muted,
                  },
                ]}
              >
                <View style={styles.rankingRow}>
                  <Text
                    style={[
                      styles.rankNumber,
                      { color: colors.mutedForeground },
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
                        ref={(ref) => { if (ref) usernameRefs.current[balance.uid] = ref as any; }}
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
                </View>
              </Card>
            </TouchableOpacity>
          );
        })
      )}
    </ScrollView>
    {/* ── Tooltip Modal ──────────────────────────────────────────────────────────────── */}
    <Modal
      visible={tooltip.visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => hideTooltip()}
    >
      <TouchableWithoutFeedback onPress={() => hideTooltip()}>
        <View style={styles.tooltipBackdrop}>
          <TouchableWithoutFeedback onPress={() => {}}>
            <Animated.View
              style={[
                styles.tooltipCard,
                {
                  top: tooltip.pageY,
                  left: tooltip.pageX,
                  backgroundColor: tooltipBg,
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Ver info */}
              <TouchableOpacity
                style={styles.tooltipItem}
                activeOpacity={0.7}
                onPress={() => {
                  const { balance, index } = tooltip;
                  hideTooltip(() => { if (balance) onParticipantPress(balance, index); });
                }}
              >
                <Ionicons name="person-outline" size={16} color="#FFFFFF" />
                <Text style={styles.tooltipLabel}>Ver info</Text>
              </TouchableOpacity>

              {/* Quitar del torneo — admin only */}
              {canRemove && (
                <>
                  <View style={styles.tooltipSep} />
                  <TouchableOpacity
                    style={styles.tooltipItem}
                    activeOpacity={0.7}
                    onPress={() => {
                      const { balance } = tooltip;
                      hideTooltip(() => { if (balance) onRemoveMember?.(balance); });
                    }}
                  >
                    <Ionicons name="person-remove-outline" size={16} color="#FF453A" />
                    <Text style={[styles.tooltipLabel, { color: '#FF453A' }]}>Quitar del torneo</Text>
                  </TouchableOpacity>
                </>
              )}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
    </>  );
};

export default RankingTab;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  tabScroll: { flex: 1 },
  tabContent: { padding: Spacing.lg, paddingBottom: 100 },
  centeredLoader: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  rankingCard: { marginBottom: Spacing.sm, paddingVertical: Spacing.sm },
  rankingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  rankNumber: { fontSize: 14, width: 22, textAlign: 'center', fontWeight: '600' },
  rankAvatarWrapper: { position: 'relative' },
  rankAvatar: { width: 40, height: 40, borderRadius: 20 },
  rankAvatarPlaceholder: {
    width: 35,
    height: 35,
    borderRadius: 17.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  rankUserInfo: { flex: 1, gap: 3 },
  rankUsernameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rankUsername: { fontSize: 15, fontWeight: '600' },
  youBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  youText: { fontSize: 11, fontWeight: '700' },
  wlMicro: { flexDirection: 'row', alignItems: 'center' },
  wlWins: { fontSize: 12, fontWeight: '700' },
  wlSep: { fontSize: 12 },
  wlLoss: { fontSize: 12, fontWeight: '700' },
  rankBalance: { fontSize: 16, fontWeight: '700' },

  // Tooltip
  tooltipBackdrop: { flex: 1 },
  tooltipCard: {
    position: 'absolute',
    width: TOOLTIP_WIDTH,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 14,
  },
  tooltipItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
  },
  tooltipLabel: { fontSize: 14, fontWeight: '600' as const, color: '#FFFFFF' },
  tooltipSep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
});
