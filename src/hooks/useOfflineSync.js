import { useState, useEffect, useCallback, useRef } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { getSyncCounts, syncPendingData } from "../lib/sync";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [counts, setCounts] = useState({ pending: 0, conflicts: 0, patients: 0, cases: 0 });
  const [countsLoaded, setCountsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);
  const running = useRef(null);

  const updatePendingCount = useCallback(async () => {
    try {
      const next = await getSyncCounts();
      setCounts(next);
      setCountsLoaded(true);
      return next;
    } catch (error) {
      console.error("Gagal hitung pending:", error);
      return null;
    }
  }, []);

  const performSync = useCallback(async () => {
    if (!isOnline) return null;
    if (running.current) return running.current;
    const work = (async () => {
      setIsSyncing(true);
      try {
        const result = await syncPendingData();
        const fresh = await updatePendingCount();
        const complete = !!fresh && fresh.pending === 0 && fresh.conflicts === 0 &&
          result.patients.failed === 0 && result.cases.failed === 0;
        const finalResult = { ...result, remaining: fresh, complete };
        setLastSyncResult(finalResult);
        return finalResult;
      } catch (error) {
        console.error("Sync gagal:", error);
        await updatePendingCount();
        return null;
      } finally {
        setIsSyncing(false);
        running.current = null;
      }
    })();
    running.current = work;
    return work;
  }, [isOnline, updatePendingCount]);

  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  // Startup hydration and offline→online transitions trigger sync. The count
  // timer never becomes a constant cloud retry loop.
  useEffect(() => {
    if (countsLoaded && isOnline && counts.pending > 0) performSync();
  }, [isOnline, countsLoaded, counts.pending, performSync]);

  return {
    isOnline,
    pendingCount: counts.pending,
    conflictCount: counts.conflicts,
    isSyncing,
    lastSyncResult,
    performSync,
    updatePendingCount,
  };
}
