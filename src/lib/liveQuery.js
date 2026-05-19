/** רענון אוטומטי כשהטאב פעיל — גיבוי אם Realtime לא זמין */
export const LIVE_REFETCH_INTERVAL_MS = 4000;

export function getLiveQueryOptions(overrides = {}) {
  return {
    staleTime: 0,
    refetchInterval: LIVE_REFETCH_INTERVAL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    ...overrides,
  };
}
