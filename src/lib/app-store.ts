import { create } from 'zustand';

export type Page = 'dashboard' | 'income' | 'expense' | 'history' | 'reports' | 'report-viewer' | 'admin' | 'admin-users' | 'admin-accounts' | 'admin-custom' | 'admin-settings' | 'admin-backup' | 'settings' | 'guide';

interface AppState {
  currentPage: Page;
  previousPage: Page | null;
  reportType: string;
  selectedTransactionId: string | null;
  /** Incremented whenever a transaction is created or deleted, so other components can re-fetch data */
  txVersion: number;
  navigate: (page: Page) => void;
  setReportType: (type: string) => void;
  setSelectedTransactionId: (id: string | null) => void;
  bumpTxVersion: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  previousPage: null,
  reportType: 'trial-balance',
  selectedTransactionId: null,
  txVersion: 0,
  navigate: (page) => {
    const current = get().currentPage;
    set({ previousPage: current, currentPage: page });
  },
  setReportType: (type) => set({ reportType: type }),
  setSelectedTransactionId: (id) => set({ selectedTransactionId: id }),
  bumpTxVersion: () => set({ txVersion: get().txVersion + 1 }),
}));
