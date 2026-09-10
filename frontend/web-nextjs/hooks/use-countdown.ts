'use client';

import { useEffect, useState } from 'react';

/**
 * Seconds remaining until `deadline` (an epoch ms value), floored at zero.
 *
 * The clock lives in state and the remaining time is derived from it, so the
 * only thing the effect does is tick — no state is synchronised on mount.
 */
export function useCountdown(deadline: number | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [deadline]);

  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

/** "4:05" for a minutes-and-seconds display, "45s" below a minute. */
export function formatDuration(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
  return `${seconds}s`;
}
