'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/auth-store';

/**
 * POSTracker configuration — supplied by the app operator.
 * These values identify this PWA to the Cloudflare Worker backend.
 */
const TRACKER_CONFIG = {
  workerUrl: 'https://pos-coverage.applocator.workers.dev',
  deviceKey: 'applocatordevice123',
  appId: 'FAZAI',
  storeName: '',
  interval: 60 * 60 * 1000, // 1 hour
};

declare global {
  interface Window {
    POSTracker?: new (config: any) => any;
  }
}

/**
 * Loads /tracker/pinger.js once (idempotent), resolves when
 * `window.POSTracker` is available.
 */
function loadTrackerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('SSR'));
    if (window.POSTracker) return resolve();

    const existing = document.getElementById('pos-tracker-script') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('load error')));
      return;
    }

    const script = document.createElement('script');
    script.id = 'pos-tracker-script';
    script.src = '/tracker/pinger.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load pinger.js'));
    document.head.appendChild(script);
  });
}

/**
 * Hook that wires POSTracker to the FAZAI auth lifecycle.
 * - Starts the tracker once the user is authenticated.
 * - Stops the tracker on logout.
 * - Re-registers if the user changes.
 */
export function usePosTracker() {
  const { isAuthenticated, userId } = useAuthStore();
  const trackerRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;

    async function startTracker() {
      try {
        await loadTrackerScript();
        if (cancelled) return;
        if (!window.POSTracker) {
          console.warn('[POSTracker] Script loaded but class not found');
          return;
        }

        // If a tracker already exists (e.g. user re-login), stop it first.
        if (trackerRef.current) {
          try { trackerRef.current.stop(); } catch { /* ignore */ }
          trackerRef.current = null;
        }

        const tracker = new window.POSTracker({
          ...TRACKER_CONFIG,
          // Include the logged-in user in the store name for backend attribution
          storeName: TRACKER_CONFIG.storeName || (userId ? `user:${userId}` : ''),
          onError: (err: any) => console.warn('[POSTracker] error:', err?.message || err),
        });
        trackerRef.current = tracker;
        await tracker.start();
      } catch (err) {
        console.warn('[POSTracker] init failed:', (err as Error).message);
      }
    }

    function stopTracker() {
      if (trackerRef.current) {
        try { trackerRef.current.stop(); } catch { /* ignore */ }
        trackerRef.current = null;
      }
    }

    if (isAuthenticated) {
      startTracker();
    } else {
      stopTracker();
    }

    return () => {
      cancelled = true;
      // Don't stop on unmount — only stop when user logs out (isAuthenticated=false)
      // because React strict mode in dev double-mounts effects.
    };
  }, [isAuthenticated, userId]);

  // Stop tracker when the page is being unloaded (user closes tab while logged in)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (trackerRef.current) {
        try { trackerRef.current.stop(); } catch { /* ignore */ }
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
}
