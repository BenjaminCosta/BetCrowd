import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useToast, ToastItem, ToastType } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Colors, BorderRadius, Spacing } from '../theme/colors';


// ─── Component ────────────────────────────────────────────────────────────────

const AppToast: React.FC = () => {
  const { current, hideToast } = useToast();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const colors = Colors[theme];

  // Type config reads directly from the resolved palette so toasts always
  // match the active theme without any hardcoded hex values.
  const TYPE_CFG: Record<ToastType, { icon: string; accent: string }> = {
    success: { icon: 'checkmark-circle',   accent: colors.success  },
    error:   { icon: 'alert-circle',       accent: colors.primary  },
    warning: { icon: 'warning',            accent: colors.warning  },
    info:    { icon: 'information-circle', accent: colors.accent   },
  };

  const translateY = useRef(new Animated.Value(60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  // Keep a local copy so the toast doesn't vanish mid-animation
  const [displayed, setDisplayed] = useState<ToastItem | null>(null);
  const [showing, setShowing] = useState(false);

  useEffect(() => {
    if (current) {
      // Stop any in-flight animations before starting the entry sequence
      translateY.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();

      setDisplayed(current);
      setShowing(true);
      translateY.setValue(60);
      opacity.setValue(0);
      scale.setValue(0.96);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 100,
          friction: 12,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Stop any in-flight animations before starting the exit sequence
      translateY.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();

      // Capture the ID of the toast we are dismissing so the callback can
      // verify it is still current before clearing state (guards against a
      // late exit callback wiping a newly-arrived toast).
      const dismissedId = displayed?.id;
      // Animate out, then unmount
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 60,
          duration: 210,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 190,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) {
          // Only clear the displayed state when the exiting toast is still the
          // one on screen — a newly arrived toast may have replaced it already.
          setDisplayed(prev => {
            if (prev?.id === dismissedId) {
              setShowing(false);
              return null;
            }
            return prev;
          });
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  if (!showing && !displayed) return null;

  const toast = displayed!;
  const cfg = TYPE_CFG[toast.type];

  return (
    <View
      style={[styles.wrapper, { bottom: insets.bottom + 16 }]}
      pointerEvents="box-none"
    >
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            shadowColor: cfg.accent,
            opacity,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: cfg.accent }]} />

        {/* Icon badge */}
        <View style={[styles.iconWrap, { backgroundColor: cfg.accent + '20' }]}>
          <Ionicons name={cfg.icon as any} size={16} color={cfg.accent} />
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          {!!toast.title && (
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {toast.title}
            </Text>
          )}
          <Text
            style={[
              styles.message,
              { color: toast.title ? colors.mutedForeground : colors.foreground },
            ]}
            numberOfLines={3}
          >
            {toast.message}
          </Text>
        </View>

        {/* Close */}
        <TouchableOpacity
          onPress={hideToast}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Cerrar notificación"
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={16} color={colors.mutedForeground} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default AppToast;

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'stretch',
    zIndex: 9999,
    elevation: 9999,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',       // clips accentBar to rounded corners
    paddingRight: 10,
    paddingVertical: 9,
    // Subtle colored glow using the type accent
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 8,
  },
  accentBar: {
    width: 2,
    alignSelf: 'stretch',
    marginRight: 8,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  textBlock: {
    flex: 1,
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 1,
    letterSpacing: 0.1,
  },
  message: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  closeBtn: {
    marginLeft: Spacing.sm,
    flexShrink: 0,
  },
});
