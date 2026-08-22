'use client';

import React from 'react';
import { ReceiptOcr } from '@/components/fazai/receipt-ocr';

/**
 * Receipt share page wrapper.
 * When the PWA is opened via the Web Share Target API (e.g., user shared
 * a receipt image from another app), this component handles the flow.
 *
 * Authentication is handled by page.tsx before rendering this —
 * if the user is not logged in, they see PinLogin first.
 */
export function ReceiptShare() {
  return <ReceiptOcr />;
}
