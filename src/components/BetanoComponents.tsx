import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Swipeable } from 'react-native-gesture-handler';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';
import { Bet, calculateOdds } from '../services/betService';
import { Event } from '../services/eventService';

const { width } = Dimensions.get('window');

interface BetCardCompactProps {
  bet: Bet;
  theme: 'light' | 'dark';
  onOptionPress: (option: string) => void;
  userSelection?: string | null;
  disabled?: boolean;
  showOdds?: boolean;
}

export const BetCardCompact: React.FC<BetCardCompactProps> = ({
  bet,
  theme,
  onOptionPress,
  userSelection,
  disabled = false,
  showOdds = true,
}) => {
  const colors = Colors[theme];
  const odds = showOdds ? calculateOdds(bet) : {};
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return '#10B981';
      case 'locked':
        return '#F59E0B';
      case 'settled':
        return '#6B7280';
      case 'cancelled':
        return '#6B7280';
      default:
        return colors.mutedForeground;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
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

  const isOptionDisabled = disabled || bet.status !== 'open';

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
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(bet.status) }]}>
            <Text style={styles.statusText}>{getStatusLabel(bet.status)}</Text>
          </View>
        </View>

        {/* Pot info */}
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
      </LinearGradient>

      {/* Options */}
      <View style={styles.optionsContainer}>
        {bet.options.map((option, index) => {
          const isSelected = userSelection === option;
          const optionOdds = odds[option];
          
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.optionButton,
                {
                  backgroundColor: isSelected ? colors.primary + '15' : colors.secondary,
                  borderColor: isSelected ? colors.primary : colors.border,
                },
                isOptionDisabled && styles.optionDisabled,
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
                      color: isSelected ? colors.primary : colors.foreground,
                      fontWeight: isSelected ? '700' : '600',
                    },
                  ]}
                  numberOfLines={2}
                >
                  {option}
                </Text>
                {showOdds && optionOdds && (
                  <View style={[styles.oddsChip, { backgroundColor: colors.primary + '20' }]}>
                    <Text style={[styles.oddsText, { color: colors.primary }]}>
                      {optionOdds === '—' ? '—' : `x${optionOdds}`}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* User pick indicator */}
      {userSelection && (
        <View style={[styles.userPickBanner, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={[styles.userPickText, { color: colors.primary }]}>
            Tu selección: {userSelection}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  headerGradient: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  potInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
    flexWrap: 'wrap',
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  optionButton: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '100%',
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
  },
  optionDisabled: {
    opacity: 0.6,
  },
  optionContent: {
    alignItems: 'center',
    gap: 6,
  },
  optionText: {
    fontSize: 14,
    textAlign: 'center',
  },
  oddsChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  oddsText: {
    fontSize: 12,
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
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  eventInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  eventTeams: {
    fontSize: 13,
  },
  eventRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eventDate: {
    fontSize: 12,
    marginTop: 2,
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
}

export const EventCard: React.FC<EventCardProps> = ({ event, theme, onPress, expanded }) => {
  const colors = Colors[theme];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'upcoming':
        return 'time-outline';
      case 'live':
        return 'radio-button-on';
      case 'finished':
        return 'checkmark-circle';
      case 'cancelled':
        return 'close-circle';
      default:
        return 'calendar-outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'upcoming':
        return '#F59E0B';
      case 'live':
        return '#DC2E4B';
      case 'finished':
        return '#6B7280';
      case 'cancelled':
        return '#6B7280';
      default:
        return colors.mutedForeground;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Sin fecha';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TouchableOpacity
      style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.eventHeader}>
        <View style={styles.eventInfo}>
          <Text style={[styles.eventTitle, { color: colors.foreground }]} numberOfLines={1}>
            {event.title}
          </Text>
          {(event.homeTeam || event.awayTeam) && (
            <Text style={[styles.eventTeams, { color: colors.mutedForeground }]} numberOfLines={1}>
              {event.homeTeam || 'TBD'} vs {event.awayTeam || 'TBD'}
            </Text>
          )}
        </View>
        <View style={styles.eventRight}>
          <Ionicons
            name={getStatusIcon(event.status)}
            size={20}
            color={getStatusColor(event.status)}
          />
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.mutedForeground}
          />
        </View>
      </View>
      {event.startsAt && (
        <Text style={[styles.eventDate, { color: colors.mutedForeground }]}>
          {formatDate(event.startsAt)}
        </Text>
      )}
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
