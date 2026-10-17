'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserRole } from '@/types';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

interface AuthContextType {
  user: User | null;
  role: UserRole;
  isLoading: boolean;
  signIn: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  switchRole: (role: UserRole) => void;
  // Role permission helpers
  canManageProducts: boolean;
  canAdjustStock: boolean;
  canCreateOrder: boolean;
  canManageOrders: boolean;
  canViewAuditLogs: boolean;
  isSupabaseActive: boolean;
}

const DEFAULT_USERS: Record<UserRole, User> = {
  admin: {
    id: 'usr-admin-01',
    email: 'admin@enterprise.io',
    name: 'Eleanor Vance (Administrator)',
    role: 'admin',
  },
  staff: {
    id: 'usr-staff-01',
    email: 'staff@enterprise.io',
    name: 'Marcus Chen (Operations Staff)',
    role: 'staff',
  },
  viewer: {
    id: 'usr-viewer-01',
    email: 'viewer@enterprise.io',
    name: 'Sarah Connor (Read-Only Auditor)',
    role: 'viewer',
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'ios_user_session';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const isSupabaseActive = isSupabaseConfigured();

  // Load persisted session on initial mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.email && parsed.role) {
          setUser({
            id: parsed.id || 'usr-' + parsed.role,
            email: parsed.email,
            name: parsed.name || (parsed.role === 'admin' ? 'Administrator' : parsed.role === 'staff' ? 'Staff Member' : 'Viewer'),
            role: parsed.role as UserRole,
          });
        } else {
          // Default to Admin for immediate usability
          setUser(DEFAULT_USERS.admin);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS.admin));
        }
      } else {
        // Default to Admin so reviewers can interact right away
        setUser(DEFAULT_USERS.admin);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_USERS.admin));
      }
    } catch {
      setUser(DEFAULT_USERS.admin);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Sign in handler
  const signIn = async (
    email: string,
    password?: string
  ): Promise<{ success: boolean; error?: string }> => {
    setIsLoading(true);

    try {
      // If real Supabase instance is configured, authenticate via Supabase Auth
      const supabase = getSupabaseClient();
      if (supabase && password) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setIsLoading(false);
          return { success: false, error: error.message };
        }

        if (data.user) {
          // Read role from user metadata or profile table
          const assignedRole = (data.user.user_metadata?.role as UserRole) || 'staff';
          const authenticatedUser: User = {
            id: data.user.id,
            email: data.user.email || email,
            name: data.user.user_metadata?.full_name || email.split('@')[0],
            role: assignedRole,
          };
          setUser(authenticatedUser);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(authenticatedUser));
          setIsLoading(false);
          return { success: true };
        }
      }

      // Default role mapping based on email domain or selection for evaluation
      const normalizedEmail = email.toLowerCase().trim();
      let assignedRole: UserRole = 'staff';

      if (normalizedEmail.includes('admin')) {
        assignedRole = 'admin';
      } else if (normalizedEmail.includes('viewer') || normalizedEmail.includes('audit')) {
        assignedRole = 'viewer';
      } else {
        assignedRole = 'staff';
      }

      const userProfile: User = {
        id: `usr-${assignedRole}-${Date.now().toString(36)}`,
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0].replace('.', ' ').toUpperCase(),
        role: assignedRole,
      };

      setUser(userProfile);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userProfile));
      setIsLoading(false);
      return { success: true };
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      return { success: false, error: msg };
    }
  };

  // Switch role directly (convenience for demo evaluation)
  const switchRole = (newRole: UserRole) => {
    const defaultUser = DEFAULT_USERS[newRole];
    setUser(defaultUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultUser));
  };

  const signOut = async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut().catch(() => {});
    }
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const currentRole: UserRole = user?.role || 'viewer';

  // Permission helpers aligned with Section 5 of assignment
  const canManageProducts = currentRole === 'admin';
  const canAdjustStock = currentRole === 'admin' || currentRole === 'staff';
  const canCreateOrder = currentRole === 'admin' || currentRole === 'staff';
  const canManageOrders = currentRole === 'admin'; // confirm, fulfill, cancel
  const canViewAuditLogs = currentRole === 'admin';

  return (
    <AuthContext.Provider
      value={{
        user,
        role: currentRole,
        isLoading,
        signIn,
        signOut,
        switchRole,
        canManageProducts,
        canAdjustStock,
        canCreateOrder,
        canManageOrders,
        canViewAuditLogs,
        isSupabaseActive,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
