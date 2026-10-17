'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';
import { ShieldCheck, UserCheck, Eye, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RoleIndicator() {
  const { user, role, switchRole, isSupabaseActive } = useAuth();

  const roleConfigs: Record<
    UserRole,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    admin: {
      label: 'Admin',
      bg: 'bg-emerald-50',
      text: 'text-emerald-800',
      border: 'border-emerald-200',
      icon: <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />,
    },
    staff: {
      label: 'Staff',
      bg: 'bg-sky-50',
      text: 'text-sky-800',
      border: 'border-sky-200',
      icon: <UserCheck className="w-3.5 h-3.5 text-sky-600" />,
    },
    viewer: {
      label: 'Viewer (Read-Only)',
      bg: 'bg-slate-100',
      text: 'text-slate-700',
      border: 'border-slate-300',
      icon: <Eye className="w-3.5 h-3.5 text-slate-500" />,
    },
  };

  const currentConfig = roleConfigs[role] || roleConfigs.viewer;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Active Role Badge */}
      <div
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border',
          currentConfig.bg,
          currentConfig.text,
          currentConfig.border
        )}
      >
        {currentConfig.icon}
        <span>{currentConfig.label}</span>
      </div>

      {/* Role Quick Switcher for Evaluation */}
      <div className="hidden sm:inline-flex items-center p-0.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
        <span className="px-2 text-slate-400 text-[11px] font-medium flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          Test Role:
        </span>
        {(['admin', 'staff', 'viewer'] as UserRole[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => switchRole(r)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-all',
              role === r
                ? 'bg-white text-slate-900 shadow-xs font-semibold'
                : 'text-slate-500 hover:text-slate-800'
            )}
          >
            {r}
          </button>
        ))}
      </div>
    </div>
  );
}
