"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type PollingState<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
  lastUpdated: Date | null;
  refresh: () => Promise<T | undefined>;
};

const retryDelays = [15_000, 30_000, 60_000];

export default function usePolling<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  intervalSeconds = 15,
): PollingState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const fetcherRef = useRef(fetcher);
  const pollRef = useRef<() => Promise<T | undefined>>(async () => undefined);

  const refresh = useCallback(() => pollRef.current(), []);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  useEffect(() => {
    let active = true;
    let failureCount = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    const clearTimer = () => {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    };

    const schedule = (delay: number) => {
      clearTimer();
      if (active && !document.hidden) {
        timer = setTimeout(() => void poll(), delay);
      }
    };

    const poll = async (): Promise<T | undefined> => {
      if (!active || document.hidden) return undefined;
      clearTimer();
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;

      try {
        const result = await fetcherRef.current(requestController.signal);
        if (!active || requestController.signal.aborted) return undefined;
        failureCount = 0;
        setData(result);
        setError(null);
        setLastUpdated(new Date());
        setLoading(false);
        schedule(intervalSeconds * 1_000);
        return result;
      } catch (caught) {
        if (!active || requestController.signal.aborted) return undefined;
        failureCount += 1;
        const nextDelay =
          retryDelays[Math.min(failureCount - 1, retryDelays.length - 1)];
        setError(
          caught instanceof Error ? caught : new Error("Refresh failed"),
        );
        setLoading(false);
        schedule(nextDelay);
        return undefined;
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearTimer();
        controller?.abort();
      } else {
        void poll();
      }
    };
    const onFocus = () => {
      if (!document.hidden) void poll();
    };

    pollRef.current = poll;
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onFocus);
    void poll();

    return () => {
      active = false;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onFocus);
    };
  }, [intervalSeconds]);

  return { data, error, loading, lastUpdated, refresh };
}
