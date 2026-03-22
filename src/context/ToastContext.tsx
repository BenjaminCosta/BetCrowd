import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastConfig {
  type: ToastType;
  title?: string;
  message: string;
  /** Auto-dismiss delay in ms. Default: 3000 */
  duration?: number;
}

export interface ToastItem extends ToastConfig {
  id: number;
}

interface ToastContextType {
  /** Show a non-blocking toast notification */
  showToast: (config: ToastConfig) => void;
  /** Immediately hide the current toast */
  hideToast: () => void;
  /** The toast currently on screen (null when nothing is showing) */
  current: ToastItem | null;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

let _idCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /**
   * Show a toast. If one is already visible it is immediately replaced —
   * single-toast-at-a-time keeps the UI uncluttered.
   */
  const showToast = useCallback((config: ToastConfig) => {
    clearTimer();
    const item: ToastItem = { ...config, id: ++_idCounter };
    setCurrent(item);
    timerRef.current = setTimeout(() => {
      setCurrent(null);
    }, item.duration ?? 3000);
  }, []);

  const hideToast = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, []);

  // Clear the active timer when the provider unmounts to avoid calling
  // setCurrent on an already-unmounted component.
  useEffect(() => () => { clearTimer(); }, []);

  const value = useMemo(
    () => ({ showToast, hideToast, current }),
    [showToast, hideToast, current],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  );
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export const useToast = (): ToastContextType => {
  const ctx = useContext(ToastContext);
  if (ctx === undefined) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};
