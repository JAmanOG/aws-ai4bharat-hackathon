/**
 * AuthContext – manages user authentication state.
 *
 * - Persists JWT in expo-secure-store
 * - Provides login / register / logout functions
 * - Exposes `user`, `token`, `isAuthenticated`, `isLoading`
 * - Falls back to demo mode when not authenticated (backward-compatible)
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ENV } from '../config/env';
import { logger } from '../utils/logger';
import { setAuthCredentials } from '../services/api';
import {
  normalizeAppLanguage,
  readStoredLanguagePreference,
  writeStoredLanguagePreference,
} from '../utils/languagePreference';

/* ────────────────────────────────────── */
/*  Types                                  */
/* ────────────────────────────────────── */

export interface User {
  userId: string;
  phone: string;
  name: string;
  preferredLanguage: string;
  state: string;
  district: string;
  isVerified: boolean;
  profileComplete: boolean;
  onboardingDone: boolean;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (phone: string, pin: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (user: User) => void;
  skipAuth: () => void;
}

interface RegisterData {
  phone: string;
  pin: string;
  name?: string;
  language?: string;
  state?: string;
  district?: string;
}

const TOKEN_KEY = 'rural_ai_token';
const USER_KEY = 'rural_ai_user';

/* ────────────────────────────────────── */
/*  Context                                */
/* ────────────────────────────────────── */

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // ── Restore persisted auth on mount ──
  useEffect(() => {
    (async () => {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (storedToken && storedUser) {
          const user: User = JSON.parse(storedUser);
          writeStoredLanguagePreference(user.preferredLanguage).catch(() => {});
          setAuthCredentials(storedToken, user.userId, user.name);
          setState({ user, token: storedToken, isAuthenticated: true, isLoading: false });
          logger.info('Auth', 'Restored session', { userId: user.userId });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch (err) {
        logger.error('Auth', 'Failed to restore session', err);
        setState(prev => ({ ...prev, isLoading: false }));
      }
    })();
  }, []);

  // ── Login ──
  const login = useCallback(async (phone: string, pin: string) => {
    const res = await fetch(`${ENV.API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, pin }),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || 'Login failed');

    const { user, token } = json;
    writeStoredLanguagePreference(user.preferredLanguage).catch(() => {});
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
    ]);

    setAuthCredentials(token, user.userId, user.name);
    setState({ user, token, isAuthenticated: true, isLoading: false });
    logger.info('Auth', 'Login successful', { userId: user.userId });
  }, []);

  // ── Register ──
  const register = useCallback(async (data: RegisterData) => {
    const res = await fetch(`${ENV.API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.message || 'Registration failed');

    const { user: regUser, token: regToken } = json;
    writeStoredLanguagePreference(regUser.preferredLanguage ?? data.language ?? 'hi').catch(() => {});
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, regToken),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(regUser)),
    ]);

    setAuthCredentials(regToken, regUser.userId, regUser.name);
    setState({ user: regUser, token: regToken, isAuthenticated: true, isLoading: false });
    logger.info('Auth', 'Registration successful', { userId: regUser.userId });
  }, []);

  // ── Logout ──
  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
    setAuthCredentials(null);
    setState({ user: null, token: null, isAuthenticated: false, isLoading: false });
    logger.info('Auth', 'Logged out');
  }, []);

  // ── Update user locally (e.g., after profile edit) ──
  const updateUser = useCallback((user: User) => {
    writeStoredLanguagePreference(user.preferredLanguage).catch(() => {});
    setState(prev => {
      setAuthCredentials(prev.token, user.userId, user.name);
      return { ...prev, user };
    });
    SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)).catch(() => {});
  }, []);

  // ── Skip auth (demo mode) ──
  const skipAuth = useCallback(() => {
    readStoredLanguagePreference()
      .then((storedLanguage) => {
        const preferredLanguage = normalizeAppLanguage(storedLanguage ?? 'hi');
        const demoUser: User = {
          userId: ENV.DEMO_USER_ID,
          phone: '',
          name: 'Demo User',
          preferredLanguage,
          state: '',
          district: '',
          isVerified: false,
          profileComplete: false,
          onboardingDone: false,
          createdAt: new Date().toISOString(),
        };
        writeStoredLanguagePreference(demoUser.preferredLanguage).catch(() => {});
        setAuthCredentials(null, ENV.DEMO_USER_ID, demoUser.name);
        setState({ user: demoUser, token: null, isAuthenticated: true, isLoading: false });
        logger.info('Auth', 'Demo mode activated');
      })
      .catch(() => {
        const demoUser: User = {
          userId: ENV.DEMO_USER_ID,
          phone: '',
          name: 'Demo User',
          preferredLanguage: 'hi',
          state: '',
          district: '',
          isVerified: false,
          profileComplete: false,
          onboardingDone: false,
          createdAt: new Date().toISOString(),
        };
        setAuthCredentials(null, ENV.DEMO_USER_ID, demoUser.name);
        setState({ user: demoUser, token: null, isAuthenticated: true, isLoading: false });
        logger.info('Auth', 'Demo mode activated');
      });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout, updateUser, skipAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

/** Hook to access auth state & actions. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
