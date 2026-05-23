'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, setAuth, clearAuth, getToken, getUser } from '@/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, fullName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth from localStorage on mount
  useEffect(() => {
    const savedUser = getUser();
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const { mockLogin } = await import('@/lib/auth');
      const response = await mockLogin(email, password);
      setAuth(response.accessToken, response.user);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const signup = async (email: string, password: string, fullName: string) => {
    setIsLoading(true);
    try {
      const { mockSignup } = await import('@/lib/auth');
      const response = await mockSignup(email, password, fullName);
      setAuth(response.accessToken, response.user);
      setUser(response.user);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    clearAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
