"use client";
import { useEffect, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  reload: () => void;
}

/** Runs an async loader whenever `deps` change. Loading is derived from whether the latest key has resolved. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(deps) + ":" + tick;
  const [result, setResult] = useState<{ key: string; data?: T; error?: Error }>({ key: "" });

  useEffect(() => {
    let alive = true;
    loader().then(
      (data) => alive && setResult({ key, data }),
      (e: unknown) => alive && setResult({ key, error: e instanceof Error ? e : new Error(String(e)) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result.key === key;
  return {
    data: current ? result.data : result.data, // keep the previous data visible while the next load runs
    loading: !current,
    error: current ? result.error : undefined,
    reload: () => setTick((t) => t + 1),
  };
}
