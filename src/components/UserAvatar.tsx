import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';

// ─── Palette ──────────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  '#F97316', // orange
  '#EF4444', // red
  '#22C55E', // green
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#0891B2', // cyan-600 (darker than #06B6D4 — passes WCAG AA with white text)
  '#B45309', // amber-700 (darker than #F59E0B — passes WCAG AA with white text)
  '#EC4899', // pink
  '#4D7C0F', // lime-700 (darker than #84CC16 — passes WCAG AA with white text)
  '#6366F1', // indigo
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashUid(uid: string): number {
  let h = 0;
  for (let i = 0; i < uid.length; i++) {
    h = Math.imul(31, h) + uid.charCodeAt(i);
    h |= 0; // keep as 32-bit int
  }
  return Math.abs(h);
}

function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    // Use Array.from so surrogate pairs / emoji count as one code point each
    const first = Array.from(parts[0])[0] ?? '';
    const second = Array.from(parts[1])[0] ?? '';
    return (first + second).toUpperCase();
  }
  return Array.from(trimmed).slice(0, 2).join('').toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserAvatarProps {
  /** Firebase UID — determines the background color deterministically */
  uid: string;
  /** Display name or username used to derive initials */
  name: string;
  /** Diameter in logical pixels (default: 40) */
  size?: number;
  /** Extra styles applied to the outer View (useful for margins) */
  style?: StyleProp<ViewStyle>;
}

// ─── Component ────────────────────────────────────────────────────────────────

const UserAvatar: React.FC<UserAvatarProps> = ({ uid, name, size = 40, style }) => {
  const bgColor = AVATAR_COLORS[hashUid(uid) % AVATAR_COLORS.length];
  const initials = getInitials(name || uid.substring(0, 2));
  const fontSize = Math.round(size * 0.38);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bgColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize,
          fontWeight: '700',
          letterSpacing: 0.5,
        }}
        numberOfLines={1}
      >
        {initials}
      </Text>
    </View>
  );
};

export default UserAvatar;
