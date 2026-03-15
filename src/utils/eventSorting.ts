import { Event } from '../services/eventService';

export type EventFilter = 'open' | 'upcoming' | 'finished';

const OPEN_STATUS_PRIORITY: Record<'live' | 'upcoming' | 'locked', number> = {
  live: 0,
  upcoming: 1,
  locked: 2,
};

const isValidTime = (value: number): boolean => Number.isFinite(value);

const parseLocalDate = (value?: string): number | null => {
  if (!value) return null;

  const [yearRaw, monthRaw, dayRaw] = value.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }

  return parsed.getTime();
};

export const getEventSortTime = (event: Event): number | null => {
  if (event.startsAt) {
    const startsAtDate =
      typeof (event.startsAt as any).toDate === 'function'
        ? (event.startsAt as any).toDate()
        : new Date(event.startsAt as any);

    const startsAtTime = startsAtDate.getTime();
    if (isValidTime(startsAtTime)) return startsAtTime;
  }

  return parseLocalDate(event.date);
};

const compareNullableTimesAsc = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left - right;
};

const compareNullableTimesDesc = (left: number | null, right: number | null): number => {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return right - left;
};

const matchesFilter = (event: Event, filter: EventFilter): boolean => {
  if (filter === 'open') {
    return event.status === 'live' || event.status === 'upcoming' || event.status === 'locked';
  }
  if (filter === 'upcoming') {
    return event.status === 'upcoming';
  }
  return event.status === 'finished' || event.status === 'cancelled';
};

export const sortEventsForFilter = (events: Event[], filter: EventFilter): Event[] => {
  return events
    .map((event, index) => ({
      event,
      index,
      time: getEventSortTime(event),
    }))
    .filter(({ event }) => matchesFilter(event, filter))
    .sort((left, right) => {
      if (filter === 'open') {
        const leftPriority = OPEN_STATUS_PRIORITY[left.event.status as keyof typeof OPEN_STATUS_PRIORITY];
        const rightPriority = OPEN_STATUS_PRIORITY[right.event.status as keyof typeof OPEN_STATUS_PRIORITY];
        if (leftPriority !== rightPriority) return leftPriority - rightPriority;

        const timeComparison = compareNullableTimesAsc(left.time, right.time);
        if (timeComparison !== 0) return timeComparison;
        return left.index - right.index;
      }

      if (filter === 'upcoming') {
        const timeComparison = compareNullableTimesAsc(left.time, right.time);
        if (timeComparison !== 0) return timeComparison;
        return left.index - right.index;
      }

      const timeComparison = compareNullableTimesDesc(left.time, right.time);
      if (timeComparison !== 0) return timeComparison;
      return left.index - right.index;
    })
    .map(({ event }) => event);
};
