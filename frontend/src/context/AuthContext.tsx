import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import api from '../services/api';

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (userData: User) => void;
  logout: () => Promise<void>;
  isLoading: boolean;
  checkAuth: () => Promise<void>;
  updateUser: (userData: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      // ✅ SECURITY FIX: Token is now in HTTPOnly cookie, automatically sent by browser
      // Just verify user is logged in by calling /auth/profile
      const response = await api.get('/auth/profile');
      setUser(response.data.user);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = (userData: User) => {
    // ✅ SECURITY FIX: Token is now in HTTPOnly cookie (browser manages it)
    // Frontend only stores user data, not the token
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = async () => {
    try {
      // ✅ SECURITY FIX: Call logout endpoint to clear HTTPOnly cookie
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Also clear any Clerk (Google/GitHub) session, otherwise the token
      // bridge would immediately sign the user back in.
      try {
        const clerk = (window as any).Clerk;
        if (clerk?.signOut) await clerk.signOut();
      } catch {
        // Clerk not configured or not loaded
      }
      // Clear local state regardless
      setIsAuthenticated(false);
      setUser(null);
    }
  };

  const updateUser = (userData: User) => {
    setUser(userData);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, isLoading, checkAuth, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
