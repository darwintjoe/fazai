import { create } from 'zustand';

export type Page = 'dashboard' | 'income' | 'expense' | 'history' | 'reports' | 'report-viewer' | 'admin' | 'admin-users' | 'admin-accounts' | 'admin-custom' | 'admin-settings' | 'admin-backup' | 'settings' | 'guide' | 'share-target';

export interface PendingReceipt {
  amount: number;
  counterparty: string;
  description: string;
  accountId?: string;
  accountName?: string;
  date?: string; // ISO date string
}

interface AppState {
  currentPage: Page;
  previousPage: Page | null;
  reportType: string;
  selectedTransactionId: string | null;
  /** Incremented whenever a transaction is created or deleted, so other components can re-fetch data */
  txVersion: number;
  /** Pre-filled receipt data from OCR, to be consumed by TransactionForm */
  pendingReceipt: PendingReceipt | null;
  navigate: (page: Page) => void;
  setReportType: (type: string) => void;
  setSelectedTransactionId: (id: string | null) => void;
  bumpTxVersion: () => void;
  setPendingReceipt: (data: PendingReceipt | null) => void;
  clearPendingReceipt: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  previousPage: null,
  reportType: 'trial-balance',
  selectedTransactionId: null,
  txVersion: 0,
  pendingReceipt: null,
  navigate: (page) => {
    const current = get().currentPage;
    set({ previousPage: current, currentPage: page });
  },
  setReportType: (type) => set({ reportType: type }),
  setSelectedTransactionId: (id) => set({ selectedTransactionId: id }),
  bumpTxVersion: () => set({ txVersion: get().txVersion + 1 }),
  setPendingReceipt: (data) => set({ pendingReceipt: data }),
  clearPendingReceipt: () => set({ pendingReceipt: null }),
}));
