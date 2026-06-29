import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { api } from '@/api/api';
import { useSubscription } from './useSubscription';

const GRACE_TOTAL_SECONDS = 300; // must match backend GRACE_SECONDS
const HEARTBEAT_MS = 30_000;     // 30 s between heartbeats

export interface GraceUsageState {
  /** True when the grace allowance for this clock hour is exhausted. */
  isBlocked: boolean;
  /** Seconds remaining in the current grace window (counts down from 300). */
  remainingSeconds: number;
  /** ISO timestamp for when the next clock hour begins (usage resets). */
  nextHourAt: string | null;
  /** True while the initial status fetch is in-flight. */
  isLoading: boolean;
}

/**
 * Manages the 5-min/hour grace usage window for expired subscriptions.
 *
 * - On mount (when subscription is expired) fetches the current usage status.
 * - Ticks down a local countdown every second.
 * - Sends a heartbeat to the backend every 30 s; the backend records the usage
 *   and returns the authoritative remaining-seconds value, which resets the
 *   local countdown so client and server stay in sync.
 * - The /billing page is always exempted so users can always renew.
 */
export function useGraceUsage(): GraceUsageState {
  const { isExpired, isLoadingCurrent } = useSubscription();
  const location = useLocation();

  const isBillingPage = location.pathname === '/billing';

  const [remainingSeconds, setRemainingSeconds] = useState(GRACE_TOTAL_SECONDS);
  const [nextHourAt, setNextHourAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const applyStatus = useCallback((remaining: number, nextHour: string | null) => {
    setRemainingSeconds(Math.max(0, remaining));
    setNextHourAt(nextHour);
  }, []);

  const clearTimers = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  // Fetch initial status when the subscription is expired
  useEffect(() => {
    if (!isExpired || isLoadingCurrent || isBillingPage) {
      return;
    }

    setIsLoading(true);
    api.getGraceUsageStatus()
      .then((status) => {
        applyStatus(status.remainingSeconds ?? GRACE_TOTAL_SECONDS, status.nextHourAt);
        setInitialized(true);
      })
      .catch(() => {
        // On fetch failure be permissive — don't punish the user for a network error
        applyStatus(GRACE_TOTAL_SECONDS, null);
        setInitialized(true);
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpired, isLoadingCurrent, isBillingPage]);

  // Local 1-second countdown once we have the initial value
  useEffect(() => {
    if (!isExpired || !initialized || isBillingPage) return;

    countdownTimerRef.current = setInterval(() => {
      setRemainingSeconds((prev) => Math.max(0, prev - 1));
    }, 1_000);

    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [isExpired, initialized, isBillingPage]);

  // Heartbeat every 30 s — records usage server-side and re-syncs the countdown
  useEffect(() => {
    if (!isExpired || !initialized || isBillingPage) return;

    heartbeatTimerRef.current = setInterval(async () => {
      try {
        const status = await api.recordGraceHeartbeat();
        if (status.remainingSeconds !== null) {
          applyStatus(status.remainingSeconds, status.nextHourAt);
        }
      } catch {
        // Ignore — the local countdown continues independently
      }
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [isExpired, initialized, isBillingPage, applyStatus]);

  // Reset when the subscription becomes active again (e.g. after renewal)
  useEffect(() => {
    if (!isExpired) {
      clearTimers();
      setRemainingSeconds(GRACE_TOTAL_SECONDS);
      setNextHourAt(null);
      setInitialized(false);
    }
  }, [isExpired, clearTimers]);

  const isBlocked = isExpired && !isBillingPage && initialized && remainingSeconds <= 0;

  return {
    isBlocked,
    remainingSeconds: isExpired ? remainingSeconds : GRACE_TOTAL_SECONDS,
    nextHourAt,
    isLoading: isExpired && isLoading,
  };
}
