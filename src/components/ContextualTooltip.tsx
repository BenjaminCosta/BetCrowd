import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

const SPOTLIGHT_PADDING = 10;

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ContextualTooltipProps {
  /** Controls visibility. Set to true to show, false to hide. */
  visible: boolean;
  /** Called when the user dismisses the tooltip. */
  onDismiss: () => void;
  /** Explanatory message (max 2 lines). */
  message: string;
  /** Optional bold title shown above the message. */
  title?: string;
  /** Ref to the UI element to spotlight. If omitted, shows a centered overlay. */
  targetRef?: React.RefObject<any>;
  /** Where to place the bubble relative to the spotlight. Defaults to 'bottom'. */
  bubblePosition?: 'top' | 'bottom';
}

export const ContextualTooltip: React.FC<ContextualTooltipProps> = ({
  visible,
  onDismiss,
  message,
  title,
  targetRef,
  bubblePosition = 'bottom',
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const BUBBLE_W = Math.min(SCREEN_W - 40, 300);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!visible) {
      fadeAnim.setValue(0);
      setTargetRect(null);
      return () => { cancelled = true; };
    }

    if (targetRef?.current) {
      targetRef.current.measureInWindow((x: number, y: number, w: number, h: number) => {
        if (!cancelled && w > 0 && h > 0) setTargetRect({ x, y, width: w, height: h });
      });
    }

    const anim = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    anim.start();

    return () => {
      cancelled = true;
      anim.stop();
    };
  }, [visible, targetRef]);

  if (!visible) return null;

  // Spotlight rectangle with padding
  const sp = SPOTLIGHT_PADDING;
  const sx = targetRect ? targetRect.x - sp : 0;
  const sy = targetRect ? targetRect.y - sp : 0;
  const sw = targetRect ? targetRect.width + sp * 2 : 0;
  const sh = targetRect ? targetRect.height + sp * 2 : 0;

  // Bubble horizontal center over target
  const bubbleLeft = targetRect
    ? Math.max(20, Math.min(SCREEN_W - BUBBLE_W - 20, targetRect.x + targetRect.width / 2 - BUBBLE_W / 2))
    : (SCREEN_W - BUBBLE_W) / 2;

  // Bubble vertical position
  const bubbleTop = targetRect
    ? bubblePosition === 'bottom'
      ? sy + sh + 14
      : sy - (title ? 138 : 112) - 14
    : SCREEN_H / 2 - 80;

  // Arrow horizontal offset within the bubble
  const arrowLeft = targetRect
    ? Math.max(12, Math.min(BUBBLE_W - 28, targetRect.x + targetRect.width / 2 - bubbleLeft - 8))
    : BUBBLE_W / 2 - 8;

  return (
    <Modal
      transparent
      animationType="none"
      visible={visible}
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.root, { opacity: fadeAnim }]}>

        {/* ── Spotlight scrim (4 rectangles around target) ── */}
        {targetRect ? (
          <>
            <View style={[styles.scrim, { top: 0, left: 0, right: 0, height: Math.max(0, sy) }]} />
            <View style={[styles.scrim, { top: sy, left: 0, width: Math.max(0, sx), height: sh }]} />
            <View style={[styles.scrim, { top: sy, left: sx + sw, right: 0, height: sh }]} />
            <View style={[styles.scrim, { top: sy + sh, left: 0, right: 0, bottom: 0 }]} />
            {/* Highlight border around target */}
            <View
              style={[styles.highlight, { top: sy, left: sx, width: sw, height: sh, borderColor: colors.primary }]}
            />
            {/* Tap anywhere on scrim to dismiss */}
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={onDismiss}
            />
          </>
        ) : (
          <TouchableOpacity
            style={[StyleSheet.absoluteFillObject, styles.fullScrim]}
            activeOpacity={1}
            onPress={onDismiss}
          />
        )}

        {/* ── Tooltip bubble ── */}
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              left: bubbleLeft,
              top: bubbleTop,
              width: BUBBLE_W,
            },
          ]}
        >
          {bubblePosition === 'bottom' && targetRect && (
            <View style={[styles.arrowUp, { left: arrowLeft, borderBottomColor: colors.card }]} />
          )}
          {bubblePosition === 'top' && targetRect && (
            <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: colors.card }]} />
          )}

          <View style={styles.bubbleContent}>
            <View style={styles.bubbleHeader}>
              {title ? (
                <Text style={[styles.bubbleTitle, { color: colors.foreground }]}>{title}</Text>
              ) : (
                <View style={[styles.dotAccent, { backgroundColor: colors.primary }]} />
              )}
              <TouchableOpacity
                onPress={onDismiss}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.bubbleText, { color: colors.mutedForeground }]}>{message}</Text>

            <TouchableOpacity
              style={[styles.dismissBtn, { backgroundColor: colors.primary }]}
              onPress={onDismiss}
              activeOpacity={0.85}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Entendido"
            >
              <Text style={styles.dismissBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  scrim: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.80)',
    zIndex: 1,
  },
  fullScrim: {
    backgroundColor: 'rgba(0,0,0,0.80)',
    zIndex: 1,
  },
  highlight: {
    position: 'absolute',
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    zIndex: 2,
  },
  bubble: {
    position: 'absolute',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 12,
    zIndex: 10,
  },
  bubbleContent: {
    padding: Spacing.lg,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dotAccent: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bubbleTitle: {
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  bubbleText: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  dismissBtn: {
    borderRadius: BorderRadius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  arrowUp: {
    position: 'absolute',
    top: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 11,
  },
  arrowDown: {
    position: 'absolute',
    bottom: -10,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    zIndex: 11,
  },
});
