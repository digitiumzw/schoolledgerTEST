import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';

export function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [wasPreviouslyOffline, setWasPreviouslyOffline] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => {
      setIsOnline(false);
      setWasPreviouslyOffline(true);
      setShowReconnected(false);
    };

    const handleOnline = () => {
      setIsOnline(true);
      if (wasPreviouslyOffline) {
        setShowReconnected(true);
        const t = setTimeout(() => setShowReconnected(false), 3000);
        return () => clearTimeout(t);
      }
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [wasPreviouslyOffline]);

  if (isOnline && showReconnected) {
    return (
      <div className="print:hidden bg-green-600 text-white text-sm text-center py-1.5 px-4 transition-all">
        Connection restored
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="print:hidden bg-amber-500 text-white text-sm flex items-center justify-center gap-2 py-1.5 px-4">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>You are offline — changes may not save until reconnected</span>
      </div>
    );
  }

  return null;
}
