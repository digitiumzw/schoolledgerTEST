import { useState, useEffect } from 'react';

/**
 * Hook to get the current time that updates every minute
 * Returns formatted time string in 24-hour format (HH:MM)
 */
export function useCurrentTime() {
  const [currentTime, setCurrentTime] = useState(() => 
    new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  );

  useEffect(() => {
    // Update time every minute
    const interval = setInterval(() => {
      setCurrentTime(
        new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      );
    }, 60000); // 60 seconds

    // Cleanup interval on component unmount
    return () => clearInterval(interval);
  }, []);

  return currentTime;
}
