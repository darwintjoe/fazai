'use client';

import { useEffect } from 'react';
import { ReceiptOcr } from '@/components/fazai/receipt-ocr';

/**
 * Dedicated route for the Web Share Target API.
 * When another app shares an image to FAZAI, the service worker
 * redirects here (303 from POST /share-target/).
 *
 * This renders the receipt OCR scanner directly — no need to go
 * through the main SPA router since we know exactly what page to show.
 *
 * Authentication: if the user is not logged in, show a login prompt
 * and proceed to scanning after authentication succeeds.
 */
export default function ShareTargetPage() {
  return <ReceiptOcr />;
}
