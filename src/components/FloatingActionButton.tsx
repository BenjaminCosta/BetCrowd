import React from 'react';
import { TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Colors } from '../theme/colors';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FloatingActionButtonProps {
  onPress: () => void;
  /** Optional style overrides (e.g. custom bottom/right positioning) */
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Reusable FAB extracted from TorneosScreen.
 * Exact same visual style: 56×56, primary background, shadow, "add" icon.
 */
export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];

  return (
    <TouchableOpacity
      style={[styles.fab, { backgroundColor: colors.primary, shadowColor: colors.primary }, style]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name="add" size={28} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
});
