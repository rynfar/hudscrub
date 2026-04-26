'use client';
import { useEffect } from 'react';
import { startPersistBridge } from './persist-bridge';
import { useSessions } from '@/src/store/session-store';

/**
 * Mounted once at the app root. Starts the IDB persistence bridge and
 * hydrates the sessions list (which also runs the 30-day prune).
 */
export function AppBoot() {
  const hydrate = useSessions((s) => s.hydrate);
  useEffect(() => {
    startPersistBridge();
    hydrate().catch((e) => console.warn('[boot] sessions hydrate failed:', e));
  }, [hydrate]);
  return null;
}
