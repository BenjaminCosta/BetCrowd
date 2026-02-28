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

// ─── Event status helpers ─────────────────────────────────────────────────────

type EventStatusInput = { status: string; date?: string };

/** Returns true if the event is scheduled for today (or is currently live). */
export const isEventToday = (event: EventStatusInput): boolean => {
  const today = new Date().toISOString().split('T')[0];
  if (event.date) return event.date === today;
  return event.status === 'live';
};

/**
 * Returns the uppercased display label for an event's status badge.
 * Terminal statuses (cancelled / finished / locked) are checked first;
 * then the date field is used for more precise labelling.
 * Past-date events that are still 'live' will correctly show 'HOY'.
 */
export const getEventBadgeLabel = (event: EventStatusInput): string => {
  if (event.status === 'cancelled') return 'CANCELADO';
  if (event.status === 'finished') return 'FINALIZADO';
  if (event.status === 'locked') return 'CERRADO';
  const today = new Date().toISOString().split('T')[0];
  if (event.date) {
    if (event.date === today) return 'HOY';
    if (event.date > today) return 'PRÓXIMO';
    // Past date — only mark finished if status confirms it
    return event.status === 'live' ? 'HOY' : 'FINALIZADO';
  }
  if (event.status === 'live') return 'HOY';
  return 'PRÓXIMO';
};
