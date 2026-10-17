'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  SlidersHorizontal,
  ShoppingBag,
  PlusCircle,
  Bell,
  FileText,
  Lock,
  Layers,
  LogIn,
} from 'lucide-react';

interface AppSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AppSidebar({ isOpen, onClose }: AppSidebarProps) {
  const pathname = usePathname();
  const { role, canViewAuditLogs, canCreateOrder } = useAuth();

  const navItems = [
    {
      label: 'Sign In / Roles',
      href: '/login',
      icon: LogIn,
      allowed: true,
    },
    {
      label: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
      allowed: true,
    },
    {
      label: 'Products / Inventory',
      href: '/products',
      icon: Package,
      allowed: true,
    },
    {
      label: 'Stock Adjustment',
      href: '/stock-adjustments',
      icon: SlidersHorizontal,
      allowed: true,
    },
    {
      label: 'Orders',
      href: '/orders',
      icon: ShoppingBag,
      allowed: true,
    },
    {
      label: 'Create Order',
      href: '/orders/create',
      icon: PlusCircle,
      allowed: canCreateOrder,
      badge: role === 'viewer' ? 'Disabled' : undefined,
    },
    {
      label: 'Notifications',
      href: '/notifications',
      icon: Bell,
      allowed: true,
    },
    {
      label: 'Audit Logs',
      href: '/audit-logs',
      icon: FileText,
      allowed: canViewAuditLogs,
      badge: !canViewAuditLogs ? 'Admin' : undefined,
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-100">
      {/* Brand logo & title */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
        <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
          <Layers className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-tight text-white leading-tight">
            Inventory & Orders
          </h1>
          <p className="text-[10px] text-teal-400 font-medium tracking-wide uppercase">
            Order Reservation System
          </p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-2 pb-2 text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
          Application Menu
        </div>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          const isRestricted = !item.allowed;

          if (isRestricted) {
            return (
              <div
                key={item.href}
                className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-500 cursor-not-allowed select-none bg-slate-950/20"
                title={`${item.label} requires elevated permissions`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-slate-600" />
                  <span>{item.label}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Lock className="w-3 h-3" />
                  <span>{item.badge}</span>
                </div>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors',
                isActive
                  ? 'bg-teal-600 text-white font-semibold shadow-xs'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Footer info: Role badge & system prompt */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
          <span>Active Role</span>
          <span className="font-semibold text-teal-400 uppercase tracking-wider">
            {role}
          </span>
        </div>
        <p className="text-[10px] text-slate-500 leading-tight">
          Permissions enforced by backend RLS & PostgreSQL transactions.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop static sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 z-40">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop and panel */}
      {isOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
            aria-hidden="true"
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-slate-900 z-10">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}
