import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api, setAuthToken } from './api';

export type Role = 'citizen' | 'technician' | 'supervisor';

export type User = {
  id: number;
  full_name: string;
  phone: string;
  email: string | null;
  role: Role;
  district: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: (phone: string, password: string) => Promise<void>;
  register: (payload: Record<string, string>) => Promise<void>;
  signOut: () => Promise<void>;
};

const TOKEN_KEY = 'iyambere.token';
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on launch so the app opens where the user left off.
  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem(TOKEN_KEY);
      if (token) {
        setAuthToken(token);
        try {
          setUser(await api.me());
        } catch {
          await AsyncStorage.removeItem(TOKEN_KEY);
          setAuthToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  async function persist(result: { token: string; user: User }) {
    await AsyncStorage.setItem(TOKEN_KEY, result.token);
    setAuthToken(result.token);
    setUser(result.user);
  }

  const value: AuthState = {
    user,
    loading,
    signIn: async (phone, password) => persist(await api.login(phone, password)),
    register: async (payload) => persist(await api.register(payload)),
    signOut: async () => {
      await AsyncStorage.removeItem(TOKEN_KEY);
      setAuthToken(null);
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}

/** Where each role lands after signing in. */
export const homeRoute: Record<Role, string> = {
  citizen: '/citizen',
  technician: '/technician',
  supervisor: '/ops',
};
