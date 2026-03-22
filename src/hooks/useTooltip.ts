import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Module-level cache shared across ALL component instances.
 * Prevents duplicate AsyncStorage reads and enables instant cross-instance updates.
 */
const _seen: Record<string, boolean> = {};
const _subscribers: Record<string, Set<() => void>> = {};

function subscribe(key: string, cb: () => void): () => void {
  if (!_subscribers[key]) _subscribers[key] = new Set();
  _subscribers[key].add(cb);
  return () => _subscribers[key].delete(cb);
}

function notify(key: string): void {
  _subscribers[key]?.forEach((cb) => cb());
}

/**
 * Show-once contextual tooltip hook backed by AsyncStorage.
 *
 * - `seen` starts as `true` (pessimistic) until AsyncStorage loads → no flash on mount.
 * - After load, `seen` is `false` if the tooltip has never been dismissed.
 * - Multiple components sharing the same `key` all update immediately when
 *   any one of them calls `markSeen()` — no double-shows.
 * - `loaded` signals when the AsyncStorage read is complete.
 */
export function useTooltip(key: string): {
  seen: boolean;
  markSeen: () => void;
  loaded: boolean;
} {
  const [seen, setSeen] = useState<boolean>(_seen[key] ?? true);
  const [loaded, setLoaded] = useState<boolean>(key in _seen);

  useEffect(() => {
    const unsub = subscribe(key, () => {
      setSeen(_seen[key] ?? true);
    });

    if (key in _seen) {
      setSeen(_seen[key]);
      setLoaded(true);
      return unsub;
    }

    AsyncStorage.getItem(`@tooltip_${key}`)
      .then((val) => {
        const isSeen = val === '1';
        _seen[key] = isSeen;
        setSeen(isSeen);
        setLoaded(true);
      })
      .catch(() => {
        _seen[key] = false;
        setSeen(false);
        setLoaded(true);
      });

    return unsub;
  }, [key]);

  const markSeen = useCallback(async () => {
    _seen[key] = true;
    setSeen(true);
    notify(key);
    try {
      await AsyncStorage.setItem(`@tooltip_${key}`, '1');
    } catch {
      /* non-critical */
    }
  }, [key]);

  return { seen, markSeen, loaded };
}
