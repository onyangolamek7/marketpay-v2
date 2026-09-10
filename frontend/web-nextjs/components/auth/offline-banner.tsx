'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

/**
 * Connectivity is often the real cause of a failed sign-in on these markets, so
 * say so before the user blames their password.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning-tint px-4 py-2 text-center text-sm font-medium text-warning"
    >
      <WifiOff className="size-4" aria-hidden="true" />
      You are offline. MarketPay will work again once your connection returns.
    </div>
  );
}
