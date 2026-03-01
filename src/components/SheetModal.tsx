import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { Colors, Spacing, BorderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';

// ─── Shared swipe-to-close hook ───────────────────────────────────────────────

const SWIPE_CLOSE_THRESHOLD = 80;
const VELOCITY_CLOSE_THRESHOLD = 600;

/**
 * Manages the full sheet animation lifecycle:
 *   - Entry: spring slide-up when `visible` becomes true.
 *   - Exit:  timing slide-down, then `onClose()` — NO Modal-level animation needed.
 *   - Swipe: tracks finger, snaps back or exits with velocity-aware duration.
 *
 * IMPORTANT: use `animationType="none"` on the host Modal, and call
 * `doClose()` (not `onClose`) for every user-triggered close action so the
 * exit animation plays exactly once.
 */
export const useSwipeToClose = (visible: boolean, onClose: () => void) => {
  // Reactive screen height — updates on orientation and foldable device changes.
  const { height: screenHeight } = useWindowDimensions();
  // Starts off-screen so the entry spring looks natural on first render.
  const translateY = useRef(new Animated.Value(screenHeight)).current;
  const isClosingRef = useRef(false);

  // Keep a stable ref to avoid stale closures in doClose / onHandlerStateChange.
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  // ── Entry / reset ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (visible) {
      isClosingRef.current = false;
      // Always hard-reset to off-screen BEFORE starting the spring.
      // Without this, if translateY was left at an intermediate value by a
      // previous swipe gesture that didn't complete, the sheet would appear
      // to spring in from that halfway position instead of from the bottom.
      translateY.setValue(screenHeight);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }).start();
    } else {
      // visible went false — reset position AND closing flag so the NEXT
      // open starts from a clean state (no "stuck closed" bug).
      translateY.setValue(screenHeight);
      isClosingRef.current = false;
    }
  }, [visible, screenHeight]);

  // ── Programmatic close (backdrop tap, X button, hardware back) ─────────────
  /** Animate the sheet out, then call onClose. Use for ALL user-triggered closes. */
  const doClose = useCallback(() => {
    if (isClosingRef.current) return; // guard against double-calls
    isClosingRef.current = true;
    Animated.timing(translateY, {
      toValue: screenHeight,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      translateY.setValue(screenHeight);
      isClosingRef.current = false; // reset so a future open on the same instance works
      onCloseRef.current();
    });
  }, [translateY, screenHeight]);

  // ── Swipe gesture ──────────────────────────────────────────────────────────
  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true },
  );

  const onHandlerStateChange = ({ nativeEvent }: any) => {
    if (nativeEvent.state === State.END || nativeEvent.state === State.CANCELLED) {
      const { translationY, velocityY } = nativeEvent;
      if (translationY > SWIPE_CLOSE_THRESHOLD || velocityY > VELOCITY_CLOSE_THRESHOLD) {
        if (isClosingRef.current) return;
        isClosingRef.current = true;
        // Velocity-aware duration so fast flicks feel instant.
        const duration = Math.max(100, 220 - Math.floor(velocityY / 10));
        Animated.timing(translateY, {
          toValue: screenHeight,
          duration,
          useNativeDriver: true,
        }).start(() => {
          translateY.setValue(screenHeight);
          isClosingRef.current = false; // reset so a future open on the same instance works
          onCloseRef.current();
        });
      } else {
        // Not enough — snap back with a small spring.
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();
      }
    }
  };

  const animatedContainerStyle = {
    transform: [
      {
        translateY: translateY.interpolate({
          inputRange: [-50, 0, screenHeight],
          outputRange: [0, 0, screenHeight],
          extrapolate: 'clamp',
        }),
      },
    ],
  };

  return { onGestureEvent, onHandlerStateChange, animatedContainerStyle, doClose };
};

// ─── Shared drag-handle component ────────────────────────────────────────────

interface SwipeDragHandleProps {
  onGestureEvent: (...args: any[]) => void;
  onHandlerStateChange: (e: any) => void;
  /** Color of the pill (usually colors.border) */
  color: string;
  /** Extra bottom margin to match the replaced handle's spacing. Default 8 */
  marginBottom?: number;
}

/**
 * The pill + invisible drag area at the top of every sheet.
 * Wraps a PanGestureHandler so the whole area is swipeable.
 */
export const SwipeDragHandle: React.FC<SwipeDragHandleProps> = ({
  onGestureEvent,
  onHandlerStateChange,
  color,
  marginBottom = Spacing.sm,
}) => (
  <PanGestureHandler
    onGestureEvent={onGestureEvent}
    onHandlerStateChange={onHandlerStateChange}
    activeOffsetY={5}
    failOffsetY={-10}
  >
    {/* Animated.View is required as a direct child of PanGestureHandler */}
    <Animated.View style={[dragHandleStyles.area, { marginBottom }]}>
      <View style={[dragHandleStyles.pill, { backgroundColor: color }]} />
    </Animated.View>
  </PanGestureHandler>
);

const dragHandleStyles = StyleSheet.create({
  area: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    // Wide enough so the pill is easy to grab
    alignSelf: 'stretch',
  },
  pill: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});

// ─── Props ────────────────────────────────────────────────────────────────────

interface SheetModalProps {
  visible: boolean;
  onClose: () => void;
  /** Content rendered inside the sheet */
  children: React.ReactNode;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic 90%-height bottom sheet.
 * Provides: animated swipe-down-to-close, backdrop-tap-to-close, drag handle, X button.
 * Children are responsible for their own title/content/scrolling.
 */
export const SheetModal: React.FC<SheetModalProps> = ({ visible, onClose, children }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const { onGestureEvent, onHandlerStateChange, animatedContainerStyle, doClose } = useSwipeToClose(
    visible,
    onClose,
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={doClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.overlay}>
          {/* Backdrop – tap to close */}
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={doClose}
          />

          {/* Sheet container – follows the drag gesture */}
          <Animated.View style={[styles.container, { backgroundColor: colors.card }, animatedContainerStyle]}>
            {/* Drag handle – swipe-down gesture target */}
            <SwipeDragHandle
              onGestureEvent={onGestureEvent}
              onHandlerStateChange={onHandlerStateChange}
              color={colors.border}
            />

            {/* Close row – X button right-aligned */}
            <View style={styles.closeRow}>
              <TouchableOpacity onPress={doClose} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>

            {/* Content – flex: 1 so children can use their own ScrollView */}
            <View style={styles.content}>
              {children}
            </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  container: {
    height: '90%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    // paddingTop removed – SwipeDragHandle adds its own top padding
  },
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
  },
  closeBtn: {
    padding: Spacing.sm,
  },
  content: {
    flex: 1,
  },
});
