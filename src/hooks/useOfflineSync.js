import { useState, useEffect, useCallback } from "react";
import { useOnlineStatus } from "./useOnlineStatus";
import { syncPendingCases } from "../lib/sync";
import localDb from "../lib/db";

export function useOfflineSync() {
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Hitung jumlah kasus yang belum ter-sync
  const updatePendingCount = useCallback(async () => {
    try {
      const count = await localDb.cases.where("synced").equals(0).count();
      setPendingCount(count);
    } catch (error) {
      console.error("Gagal hitung pending:", error);
    }
  }, []);

  // Sync otomatis saat koneksi kembali
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      performSync();
    }
  }, [isOnline]);

  // Update pending count secara berkala
  useEffect(() => {
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 5000);
    return () => clearInterval(interval);
  }, [updatePendingCount]);

  const performSync = useCallback(async () => {
    if (isSyncing || !isOnline) return;

    setIsSyncing(true);
    try {
      const result = await syncPendingCases();
      setLastSyncResult(result);
      await updatePendingCount();
    } catch (error) {
      console.error("Sync gagal:", error);
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, updatePendingCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    lastSyncResult,
    performSync,
    updatePendingCount,
  };
}
