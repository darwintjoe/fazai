import { create } from 'zustand';
import type { Lang } from './i18n';

interface AuthState {
  isAuthenticated: boolean;
  userId: string | null;
  userName: string | null;
  userRole: 'admin' | 'user' | null;
  lang: Lang;
  login: (userId: string, userName: string, role: 'admin' | 'user') => void;
  logout: () => void;
  setLang: (lang: Lang) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  userId: null,
  userName: null,
  userRole: null,
  lang: (typeof window !== 'undefined' && localStorage.getItem('fazai-lang') as Lang) || 'en',
  login: (userId, userName, role) => {
    set({ isAuthenticated: true, userId, userName, userRole: role });
    if (typeof window !== 'undefined') {
      localStorage.setItem('fazai-auth', JSON.stringify({ userId, userName, role }));
    }
  },
  logout: () => {
    set({ isAuthenticated: false, userId: null, userName: null, userRole: null });
    if (typeof window !== 'undefined') {
      localStorage.removeItem('fazai-auth');
    }
  },
  setLang: (lang) => {
    set({ lang });
    if (typeof window !== 'undefined') {
      localStorage.setItem('fazai-lang', lang);
    }
  },
}));

// Initialize from localStorage
if (typeof window !== 'undefined') {
  const stored = localStorage.getItem('fazai-auth');
  if (stored) {
    try {
      const { userId, userName, role } = JSON.parse(stored);
      useAuthStore.getState().login(userId, userName, role);
    } catch {
      localStorage.removeItem('fazai-auth');
    }
  }
}
