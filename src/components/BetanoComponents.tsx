import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { isEventToday, getEventBadgeLabel } from '../utils/formatters';
import { Bet, calculateOdds } from '../services/betService';
import { Event } from '../services/eventService';

const { width } = Dimensions.get('window');

// Strip 'de ' from over/under labels: 'Más de 2.5' → 'Más 2.5'
const formatOptionLabel = (option: string) =>
  option.replace(/Más de /g, 'Más ').replace(/Menos de /g, 'Menos ');

interface BetCardCompactProps {
  bet: Bet;
  theme: 'light' | 'dark';
  onOptionPress: (option: string) => void;
  userSelection?: string | null;
  disabled?: boolean;
  showOdds?: boolean;
  onCancel?: () => void;
}

export const BetCardCompact: React.FC<BetCardCompactProps> = ({
  bet,
  theme,
  onOptionPress,
  userSelection,
  disabled = false,
  showOdds = true,
  onCancel,
}) => {
  const colors = Colors[theme];
  // Pending bets show no odds numbers (market not formed)
  const odds = showOdds && bet.status !== 'pending' ? calculateOdds(bet) : {};
  const [showPendingTip, setShowPendingTip] = useState(false);
  const infoButtonRef = useRef<any>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, btnW: 0 });
  const tooltipFadeAnim = useRef(new Animated.Value(0)).current;
  const tooltipSlideAnim = useRef(new Animated.Value(4)).current;

  const handleShowTooltip = () => {
    infoButtonRef.current?.measureInWindow((x: number, y: number, w: number, h: number) => {
      setTooltipPos({ x, y: y + h + 6, btnW: w });
      setShowPendingTip(true);
      tooltipFadeAnim.setValue(0);
      tooltipSlideAnim.setValue(4);
      Animated.parallel([
        Animated.timing(tooltipFadeAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
        Animated.timing(tooltipSlideAnim, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    });
  };

  const handleHideTooltip = () => {
    Animated.parallel([
      Animated.timing(tooltipFadeAnim, { toValue: 0, duration: 140, useNativeDriver: true }),
      Animated.timing(tooltipSlideAnim, { toValue: 4, duration: 140, useNativeDriver: true }),
    ]).start(() => setShowPendingTip(false));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#8B8D97';
      case 'open':
        return '#10B981';
      case 'locked':
        return '#F59E0B';
      case 'settled':
        return '#F59E0B';
      case 'cancelled':
        return '#DC2E4B';
      default:
        return colors.mutedForeground;
    }
  };

  const isWinningOption = (b: typeof bet, option: string): boolean => {
    if (b.status !== 'settled') return false;
    if (b.type === 'score') {
      const score = b.result?.score;
      if (!score) return false;
      const match = option.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) return false;
      const home = parseInt(match[1], 10);
      const away = parseInt(match[2], 10);
      return home === score.home && away === score.away;
    }
    return !!b.result?.winner && b.result.winner === option;
  };

  const userWon = userSelection ? isWinningOption(bet, userSelection) : false;
  const userLost = (() => {
    if (bet.status !== 'settled' || !userSelection) return false;
    if (bet.type === 'score') {
      const score = bet.result?.score;
      if (!score) return false;
      const match = userSelection.match(/^(\d+)\s*-\s*(\d+)$/);
      if (!match) return false;
      const home = parseInt(match[1], 10);
      const away = parseInt(match[2], 10);
      return !(home === score.home && away === score.away);
    }
    return !!bet.result?.winner && bet.result.winner !== userSelection;
  })();
  const badgeColor = userWon ? '#10B981' : userLost ? '#DC2E4B' : getStatusColor(bet.status);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'PENDIENTE';
      case 'open':
        return 'ABIERTA';
      case 'locked':
        return 'CERRADA';
      case 'settled':
        return 'RESUELTA';
      case 'cancelled':
        return 'CANCELADA';
      default:
        return status.toUpperCase();
    }
  };

  const isOptionDisabled = disabled || (bet.status !== 'open' && bet.status !== 'pending');

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      {/* Header with gradient accent */}
      <LinearGradient
        colors={['rgba(220, 46, 75, 0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: colors.foreground }]}>{bet.title}</Text>
            {bet.description && (
              <Text style={[styles.description, { color: colors.mutedForeground }]} numberOfLines={1}>
                {bet.description}
              </Text>
            )}
          </View>
          <View style={styles.headerRight}>
            <View style={[
              styles.statusBadge,
              { backgroundColor: badgeColor },
              bet.status === 'pending' && styles.statusBadgePending,
            ]}>
              {userWon && <Ionicons name="checkmark" size={10} color="#FFF" />}
              {userLost && <Ionicons name="close" size={10} color="#FFF" />}
              <Text style={styles.statusText}>{getStatusLabel(bet.status)}</Text>
            </View>
            {bet.status === 'pending' && (
              <TouchableOpacity
                ref={infoButtonRef}
                onPress={() => showPendingTip ? handleHideTooltip() : handleShowTooltip()}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.pendingInfoBtn}
              >
                <Ionicons
                  name={showPendingTip ? 'information-circle' : 'information-circle-outline'}
                  size={15}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>
        {/* Pot info + optional cancel icon */}
        <View style={styles.potInfoRow}>
          <View style={styles.potInfo}>
            <Ionicons name="cash-outline" size={14} color={colors.primary} />
            <Text style={[styles.potText, { color: colors.mutedForeground }]}>
              Pozo: ${(bet.totalPot || 0).toLocaleString()}
            </Text>
            {(bet.totalPicks || 0) > 0 && (
              <>
                <Text style={[styles.potSeparator, { color: colors.mutedForeground }]}>•</Text>
                <Text style={[styles.potText, { color: colors.mutedForeground }]}>
                  {bet.totalPicks} {bet.totalPicks === 1 ? 'apuesta' : 'apuestas'}
                </Text>
              </>
            )}
          </View>
          {onCancel && (bet.status === 'open' || bet.status === 'pending') && (
            <TouchableOpacity
              onPress={onCancel}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.cancelIconBtn}
            >
              <Ionicons name="trash-outline" size={15} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {bet.options.map((option, index) => {
          const isSettled = bet.status === 'settled';
          const isSelected = userSelection === option;
          const optionOdds = odds[option];
          // Determine if this option is the winner
          const isWinner = isWinningOption(bet, option);

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                {
                  // isWinner always takes priority in settled bets (no red).
                  // Lost selection: restore the original red primary tint so the user
                  // can see which option they picked.
                  // Open/locked selection: red primary tint as before.
                  backgroundColor: isWinner
                    ? colors.muted
                    : isSelected
                    ? colors.primary + '15'
                    : colors.secondary,
                  borderColor: isWinner
                    ? colors.foreground + '30'
                    : isSelected
                    ? colors.primary
                    : colors.border,
                  opacity: !isOptionDisabled
                    ? 1
                    : bet.status === 'settled'
                    ? (isWinner || isSelected ? 1 : 0.3)
                    : 0.6,
                },
              ]}
              onPress={() => !isOptionDisabled && onOptionPress(option)}
              disabled={isOptionDisabled}
              activeOpacity={0.7}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionText,
                    {
                      // Winner takes neutral foreground (no red).
                      // Selected non-winner (open or lost) gets red primary.
                      color: isWinner ? colors.mutedForeground : isSelected ? colors.primary : colors.mutedForeground,
                      fontWeight: isSelected || isWinner ? '700' : '500',
                    },
                  ]}
                  numberOfLines={1}
                >
                  {formatOptionLabel(option)}
                </Text>
                {isWinner && (
                  <Ionicons name="checkmark-circle" size={14} color={colors.foreground} style={{ opacity: 0.7 }} />
                )}
                {/* Subtle "Tu pick" label when user picked this but it didn't win */}
                {isSelected && isSettled && !isWinner && (
                  <Text style={{ fontSize: 9, color: colors.mutedForeground, fontWeight: '700', opacity: 0.65 }}>
                    TU PICK
                  </Text>
                )}
                {showOdds && optionOdds && (
                  <Text style={[styles.oddsText, { color: colors.foreground }]}>
                    {optionOdds}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Floating tooltip for pending state */}
      {bet.status === 'pending' && (
        <Modal
          transparent
          visible={showPendingTip}
          onRequestClose={handleHideTooltip}
          statusBarTranslucent
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handleHideTooltip}
            activeOpacity={1}
          />
          <Animated.View
            style={[
              styles.floatingTooltip,
              {
                opacity: tooltipFadeAnim,
                transform: [{ translateY: tooltipSlideAnim }],
                top: tooltipPos.y,
                right: Dimensions.get('window').width - tooltipPos.x - tooltipPos.btnW,
              },
            ]}
          >
            <Text style={styles.floatingTooltipText}>
              Esperando apuestas para activar el mercado.
            </Text>
          </Animated.View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    marginBottom: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerGradient: {
    padding: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    fontSize: 11,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  pendingInfoBtn: {
    padding: 2,
  },
  floatingTooltip: {
    position: 'absolute',
    maxWidth: 220,
    backgroundColor: 'rgba(20,20,20,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  floatingTooltipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.70)',
    lineHeight: 18,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgePending: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.20)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  potInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  potInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  cancelIconBtn: {
    paddingLeft: 8,
  },
  potText: {
    fontSize: 12,
    fontWeight: '500',
  },
  potSeparator: {
    fontSize: 12,
    marginHorizontal: 2,
  },
  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    padding: 6,
    gap: 6,
  },
  optionButton: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 11,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  optionText: {
    fontSize: 13,
    flex: 1,
    textAlign: 'left',
  },
  oddsChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  oddsText: {
    fontSize: 13,
    fontWeight: '700',
  },
  userPickBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.sm,
    gap: 6,
  },
  userPickText: {
    fontSize: 12,
    fontWeight: '600',
  },  // EventCard styles
  eventCard: {
    padding: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  eventCardGradientOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  eventGradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  eventHeader: {
    marginBottom: 10,
    zIndex: 1,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  eventDescription: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  eventDivider: {
    height: 1,
    marginBottom: Spacing.md,
    zIndex: 1,
  },
  eventFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1,
  },
  eventMeta: {
    flex: 1,
    gap: Spacing.sm,
  },
  eventMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventMetaIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eventMetaText: {
    fontSize: 13,
    fontWeight: '500',
  },
  // New EventCard styles
  eventTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.sm,
    zIndex: 1,
  },
  eventStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eventLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  eventStatusText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  eventPickBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  eventPickText: {
    fontSize: 10,
    fontWeight: '700',
  },
  eventDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    zIndex: 1,
  },
  eventDate: {
    fontSize: 12,
    fontWeight: '500',
    zIndex: 1,
  },
  eventAdminBar: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 5,
    zIndex: 2,
  },
  // SwipeableRow styles
  swipeActions: {
    flexDirection: 'row',
  },
  swipeAction: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  swipeActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },});

// ========================================
// EVENT CARD COMPACT
// ========================================

interface EventCardProps {
  event: Event;
  theme: 'light' | 'dark';
  onPress: () => void;
  expanded?: boolean;
  userHasPick?: boolean;
  adminActionBar?: React.ReactNode;
}

export const EventCard: React.FC<EventCardProps> = ({ event, theme, onPress, userHasPick = false, adminActionBar }) => {
  const colors = Colors[theme];

  const getStatusColor = (): string => {
    if (event.status === 'cancelled') return colors.mutedForeground;
    if (event.status === 'finished' || event.status === 'locked') return colors.warning;
    return isEventToday(event) ? colors.success : '#DC2E4B';
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Primary display: "Home vs Away" if teams exist, otherwise title
  const primaryTitle =
    event.homeTeam && event.awayTeam
      ? `${event.homeTeam} vs ${event.awayTeam}`
      : event.title;
  // Secondary line: show title as subtitle only when teams are shown
  const subtitle =
    event.homeTeam && event.awayTeam ? event.title : event.notes ?? null;

  const dateStr = event.startsAt ? formatDate(event.startsAt) : null;
  const statusColor = getStatusColor();

  return (
    <TouchableOpacity
      style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.eventCardGradientOverlay}>
        <LinearGradient
          colors={['rgba(215, 38, 61, 0.08)', 'transparent']}
          style={styles.eventGradientBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      </View>

      {/* Top row: status badge + "ya apostaste" */}
      <View style={styles.eventTopRow}>
        <View style={[styles.eventStatusBadge, { backgroundColor: statusColor + '20' }]}>
          {isEventToday(event) && (
            <View style={[styles.eventLiveDot, { backgroundColor: statusColor }]} />
          )}
          <Text style={[styles.eventStatusText, { color: statusColor }]}>
            {getEventBadgeLabel(event)}
          </Text>
        </View>
        {userHasPick && (
          <View style={[styles.eventPickBadge, { backgroundColor: colors.success + '20' }]}>
            <Ionicons name="checkmark-circle" size={12} color={colors.success} />
            <Text style={[styles.eventPickText, { color: colors.success }]}>Ya apostaste</Text>
          </View>
        )}
      </View>

      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={2}>
            {primaryTitle}
          </Text>
          {subtitle ? (
            <Text style={[styles.eventDescription, { color: colors.mutedForeground }]} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {dateStr ? (
        <View style={styles.eventDateRow}>
          <Ionicons name="calendar-outline" size={13} color={colors.mutedForeground} />
          <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>{dateStr}</Text>
        </View>
      ) : null}

      {/* Admin action button — absolutely positioned at bottom-right, no height change */}
      {adminActionBar ? (
        <View style={styles.eventAdminBar} pointerEvents="box-none">
          {adminActionBar}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

// ========================================
// SWIPEABLE ROW FOR ADMIN ACTIONS
// ========================================

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: Array<{
    label: string;
    icon: string;
    color: string;
    onPress: () => void;
  }>;
  enabled?: boolean;
}

export const SwipeableRow: React.FC<SwipeableRowProps> = ({
  children,
  actions,
  enabled = true,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = (
    progress: Animated.AnimatedInterpolation<number>,
    dragX: Animated.AnimatedInterpolation<number>
  ) => {
    if (!enabled) return null;

    const translateX = dragX.interpolate({
      inputRange: [-actions.length * 80, 0],
      outputRange: [0, actions.length * 80],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View
        style={[
          styles.swipeActions,
          {
            transform: [{ translateX }],
          },
        ]}
      >
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={[styles.swipeAction, { backgroundColor: action.color }]}
            onPress={() => {
              swipeableRef.current?.close();
              action.onPress();
            }}
          >
            <Ionicons name={action.icon as any} size={20} color="#FFFFFF" />
            <Text style={styles.swipeActionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    );
  };

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      friction={2}
    >
      {children}
    </Swipeable>
  );
};
