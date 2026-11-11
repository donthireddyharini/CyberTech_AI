import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi } from '../api/client';
import type { User, LoginRequest, RegisterRequest, UpdateProfileRequest } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (data: LoginRequest) => Promise<User>;
  loginWithGoogle: (credential: string) => Promise<User>;
  loginWithGoogleDemo: () => Promise<User>;
  register: (data: RegisterRequest) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (data: UpdateProfileRequest) => Promise<User>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  login: async () => { throw new Error('Not implemented'); },
  loginWithGoogle: async () => { throw new Error('Not implemented'); },
  loginWithGoogleDemo: async () => { throw new Error('Not implemented'); },
  register: async () => { throw new Error('Not implemented'); },
  logout: async () => {},
  updateProfile: async () => { throw new Error('Not implemented'); },
});

function sanitizeUserProfile(u: User | null): User | null {
  if (!u) return null;
  const legacyRoleNames = [
    'lead administrator',
    'administrator',
    'safety moderator',
    'demo moderator',
    'moderator',
    'faculty evaluator',
    'officer',
    'admin',
  ];
  const rawName = (u.name || '').trim();
  const isLegacyRoleName = !rawName || legacyRoleNames.includes(rawName.toLowerCase());
  let cleanName = rawName;
  if (isLegacyRoleName) {
    const emailPrefix = (u.email || '').split('@')[0] || 'User';
    if (emailPrefix.toLowerCase() === 'donthireddyharini' || emailPrefix.toLowerCase() === 'admin') {
      cleanName = 'Donthireddy Harini';
    } else {
      cleanName = emailPrefix
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  return {
    ...u,
    name: cleanName,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('sentinel_token'));
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('sentinel_user');
    if (saved) {
      try {
        return sanitizeUserProfile(JSON.parse(saved));
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Verify session on mount if token exists
  useEffect(() => {
    const verifyUser = async () => {
      const storedToken = localStorage.getItem('sentinel_token');
      if (storedToken) {
        try {
          const resp = await authApi.me();
          const cleaned = sanitizeUserProfile(resp.data);
          setUser(cleaned);
          localStorage.setItem('sentinel_user', JSON.stringify(cleaned));
        } catch {
          // Token expired or invalid
          localStorage.removeItem('sentinel_token');
          localStorage.removeItem('sentinel_user');
          setToken(null);
          setUser(null);
        }
      }
      setIsLoading(false);
    };
    verifyUser();
  }, []);

  const login = useCallback(async (data: LoginRequest): Promise<User> => {
    const resp = await authApi.login(data);
    const { access_token, user: rawUser } = resp.data;
    const loggedInUser = sanitizeUserProfile(rawUser) || rawUser;
    localStorage.setItem('sentinel_token', access_token);
    localStorage.setItem('sentinel_user', JSON.stringify(loggedInUser));
    setToken(access_token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const loginWithGoogle = useCallback(async (credential: string): Promise<User> => {
    const resp = await authApi.googleLogin(credential);
    const { access_token, user: rawUser } = resp.data;
    const loggedInUser = sanitizeUserProfile(rawUser) || rawUser;
    localStorage.setItem('sentinel_token', access_token);
    localStorage.setItem('sentinel_user', JSON.stringify(loggedInUser));
    setToken(access_token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const loginWithGoogleDemo = useCallback(async (): Promise<User> => {
    const resp = await authApi.googleDemoLogin();
    const { access_token, user: rawUser } = resp.data;
    const loggedInUser = sanitizeUserProfile(rawUser) || rawUser;
    localStorage.setItem('sentinel_token', access_token);
    localStorage.setItem('sentinel_user', JSON.stringify(loggedInUser));
    setToken(access_token);
    setUser(loggedInUser);
    return loggedInUser;
  }, []);

  const register = useCallback(async (data: RegisterRequest): Promise<User> => {
    const resp = await authApi.register(data);
    const { access_token, user: rawUser } = resp.data;
    const registeredUser = sanitizeUserProfile(rawUser) || rawUser;
    localStorage.setItem('sentinel_token', access_token);
    localStorage.setItem('sentinel_user', JSON.stringify(registeredUser));
    setToken(access_token);
    setUser(registeredUser);
    return registeredUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('sentinel_token');
      localStorage.removeItem('sentinel_user');
      // Clear account-specific cache to enforce zero cross-account data leakage
      try {
        const keysToRemove = Object.keys(localStorage).filter(
          (k) =>
            k.startsWith('cybertech_') ||
            k.startsWith('sentinel_active_')
        );
        keysToRemove.forEach((k) => localStorage.removeItem(k));
      } catch {}
      setToken(null);
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileRequest): Promise<User> => {
    const resp = await authApi.updateProfile(data);
    const updatedUser = resp.data;
    localStorage.setItem('sentinel_user', JSON.stringify(updatedUser));
    setUser(updatedUser);
    return updatedUser;
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        loginWithGoogle,
        loginWithGoogleDemo,
        register,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
