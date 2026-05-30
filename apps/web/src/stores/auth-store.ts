import { create } from 'zustand';
import type { Locale } from '@proxels/shared';

export interface AuthUser {
  id: string;
  email: string;
  role: 'user' | 'admin';
  locale: Locale;
  emailVerified: boolean;
  createdAt: string;
}

export type AuthStatus = 'loading' | 'anon' | 'auth';

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Access-токен живёт ТОЛЬКО в памяти (по §4b и §4a). Refresh — в httpOnly cookie. */
  accessToken: string | null;

  setAuth: (token: string, user: AuthUser) => void;
  setUser: (user: AuthUser) => void;
  setStatus: (status: AuthStatus) => void;
  clear: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  accessToken: null,

  setAuth: (token, user) => set({ accessToken: token, user, status: 'auth' }),
  setUser: (user) => set({ user }),
  setStatus: (status) => set({ status }),
  clear: () => set({ accessToken: null, user: null, status: 'anon' }),
}));
