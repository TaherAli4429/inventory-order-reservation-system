'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { RoleIndicator } from './RoleIndicator';
import { Bell, Menu, X, LogOut, CheckCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { NotificationItem } from '@/types';
import { formatRelativeTime } from '@/lib/utils';

interface AppHeaderProps {
  onMobileMenuToggle: () => void;
  isMobileMenuOpen: boolean;
}

export function AppHeader({ onMobileMenuToggle, isMobileMenuOpen }: AppHeaderProps) {
  const router = useRouter();
  const { user, signOut, isSupabaseActive } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState<boolean>(false);

  // Poll or fetch notifications
  useEffect(() => {
    let isMounted = true;
    const fetchNotifs = async () => {
      try {
        const res = await api.getNotifications();
        if (isMounted && res.success) {
          setUnreadCount(res.unread_count);
          setNotifications(res.data.slice(0, 5));
        }
      } catch {
        // quiet error
      }
    };

    fetchNotifs();
    const interval = setInterval(fetchNotifs, 15000); // 15s refresh
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // ignore
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
      {/* Left: Mobile hamburger & Backend status tag */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        {/* System Environment Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
          <span
            className={`w-2 h-2 rounded-full ${
              isSupabaseActive ? 'bg-emerald-500 animate-pulse' : 'bg-teal-500'
            }`}
          />
          <span>{isSupabaseActive ? 'Supabase Live' : 'API Service Active'}</span>
        </div>
      </div>

      {/* Center / Right: Role Indicator & Notification & User Profile */}
      <div className="flex items-center gap-3">
        <RoleIndicator />

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsNotifOpen(!isNotifOpen)}
            className="relative p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            aria-label="View notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-xs">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {isNotifOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsNotifOpen(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl bg-white shadow-xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between p-3.5 border-b border-slate-100 bg-slate-50/70">
                  <span className="text-xs font-semibold text-slate-900">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllRead}
                      className="text-[11px] text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No notifications yet
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 text-xs transition-colors hover:bg-slate-50 ${
                          !n.read ? 'bg-teal-50/30' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-semibold text-slate-900 leading-tight">
                            {n.title}
                          </p>
                          <span className="text-[10px] text-slate-400 shrink-0">
                            {formatRelativeTime(n.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-600 mt-1 text-[11px] leading-relaxed">
                          {n.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                <div className="p-2.5 border-t border-slate-100 bg-slate-50/50 text-center">
                  <Link
                    href="/notifications"
                    onClick={() => setIsNotifOpen(false)}
                    className="text-xs font-medium text-teal-600 hover:text-teal-700"
                  >
                    View all notifications & FCM settings &rarr;
                  </Link>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Identity & Sign Out */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-slate-900 leading-none">
              {user?.email || 'user@enterprise.io'}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
              Role: {user?.role || 'viewer'}
            </p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push('/login');
            }}
            title="Sign out to Login screen"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
