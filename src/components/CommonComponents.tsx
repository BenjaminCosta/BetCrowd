import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import { Colors, Gradients, Spacing, BorderRadius } from '../theme/colors';

/**
 * Card Component
 */
interface CardProps {
  children: React.ReactNode;
  style?: any;
  gradient?: boolean;
}

export const Card: React.FC<CardProps> = ({ children, style, gradient = false }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  if (gradient) {
    return (
      <LinearGradient
        colors={Gradients.card}
        style={[styles.card, style]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.card }, style]}>
      {children}
    </View>
  );
};

/**
 * PrimaryButton Component (con gradiente)
 */
interface PrimaryButtonProps {
  onPress: () => void;
  children?: React.ReactNode;
  title?: string;
  disabled?: boolean;
  style?: any;
}

export const PrimaryButton: React.FC<PrimaryButtonProps> = ({
  onPress,
  children,
  title,
  disabled = false,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[disabled && { opacity: 0.5 }]}
    >
      <LinearGradient
        colors={Gradients.primary as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.primaryButton, style]}
      >
        <Text style={styles.primaryButtonText}>{children || title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

/**
 * Button Component (outline, secondary)
 */
interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: 'secondary' | 'outline';
  disabled?: boolean;
  style?: any;
}

export const Button: React.FC<ButtonProps> = ({
  onPress,
  children,
  variant = 'secondary',
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: variant === 'secondary' ? colors.secondary : 'transparent',
          borderWidth: variant === 'outline' ? 1 : 0,
          borderColor: colors.border,
        },
        disabled && { opacity: 0.5 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: colors.foreground }]}>
        {children}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Chip Component (selección montos / tags)
 */
interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  style?: any;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  selected = false,
  onPress,
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  if (selected) {
    return (
      <TouchableOpacity onPress={onPress}>
        <LinearGradient
          colors={Gradients.card as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.chip, style]}
        >
          <Text style={styles.chipTextSelected}>{label}</Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, { backgroundColor: colors.secondary, borderWidth: 1, borderColor: colors.border }, style]}
    >
      <Text style={[styles.chipText, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

/**
 * Badge Component (estado)
 */
interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'pending' | 'active';
  style?: any;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  const badgeColors = {
    default: { bg: colors.primary + '30', text: colors.primary },
    success: { bg: colors.success + '30', text: colors.success },
    warning: { bg: colors.warning + '30', text: colors.warning },
    danger: { bg: colors.destructive + '30', text: colors.destructive },
    pending: { bg: colors.muted, text: colors.mutedForeground },
    active: { bg: colors.accent + '30', text: colors.accent },
  };

  const color = badgeColors[variant];

  return (
    <View style={[styles.badge, { backgroundColor: color.bg }, style]}>
      <Text style={[styles.badgeText, { color: color.text }]}>{children}</Text>
    </View>
  );
};

/**
 * Input Component
 */
interface InputProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  style?: any;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  secureTextEntry?: boolean;
}

export const Input: React.FC<InputProps> = ({
  value,
  onChangeText,
  placeholder,
  style,
  multiline = false,
  keyboardType = 'default',
  secureTextEntry = false,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={colors.mutedForeground}
      style={[
        styles.input,
        {
          backgroundColor: colors.input,
          color: colors.foreground,
          borderColor: colors.border,
        },
        multiline && { height: 100, textAlignVertical: 'top' },
        style,
      ]}
      multiline={multiline}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
    />
  );
};

/**
 * SectionHeader Component
 */
interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
  style?: any;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  action,
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[styles.sectionHeaderTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={[styles.sectionHeaderAction, { color: colors.primary }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * IconButton Component
 */
interface IconButtonProps {
  iconName: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: any;
}

export const IconButton: React.FC<IconButtonProps> = ({
  iconName,
  onPress,
  size = 24,
  color,
  style,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <TouchableOpacity onPress={onPress} style={[styles.iconButton, style]}>
      <Ionicons name={iconName} size={size} color={color || colors.foreground} />
    </TouchableOpacity>
  );
};

/**
 * Divider Component
 */
export const Divider: React.FC<{ style?: any }> = ({ style }) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <View style={[styles.divider, { backgroundColor: colors.border }, style]} />
  );
};

/**
 * EmptyState Component
 */
interface EmptyStateProps {
  iconName: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName,
  title,
  message,
}) => {
  const { theme } = useTheme();
  const colors = Colors[theme];
  
  return (
    <View style={styles.emptyState}>
      <Ionicons name={iconName} size={64} color={colors.mutedForeground} />
      <Text style={[styles.emptyStateTitle, { color: colors.foreground }]}>
        {title}
      </Text>
      <Text style={[styles.emptyStateMessage, { color: colors.mutedForeground }]}>
        {message}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButton: {
    height: 52,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    shadowColor: '#D7263D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 48,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 15,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionHeaderAction: {
    fontSize: 14,
    fontWeight: '600',
  },
  iconButton: {
    padding: Spacing.sm,
  },
  divider: {
    height: 1,
    width: '100%',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
