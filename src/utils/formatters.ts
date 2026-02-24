/**
 * Shared display helpers — import these instead of copy-pasting per file.
 */

export const getInitials = (name: string): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '--';
  const parts = trimmed.split(' ').filter(Boolean);
  if (parts.length >= 2) return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
};

export const formatBalance = (b: number): string =>
  b === 0 ? '$0' : b > 0 ? `+$${b.toFixed(0)}` : `-$${Math.abs(b).toFixed(0)}`;
