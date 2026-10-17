'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { NotificationItem } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { FCMBanner } from '@/components/notifications/FCMBanner';
import { formatRelativeTime, formatDate } from '@/lib/utils';
import {
  Bell,
  CheckCheck,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
  SlidersHorizontal,
  ExternalLink,
} from 'lucide-react';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotifications = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getNotifications(unreadOnly);
      if (res.success) {
        setNotifications(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load notifications';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // quiet error
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // quiet error
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            System Notifications
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time event stream for low-stock triggers and order status lifecycle updates
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadNotifications}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              leftIcon={<CheckCheck className="w-3.5 h-3.5 text-teal-600" />}
            >
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* FCM Integration Banner */}
      <FCMBanner />

      {/* Notification Center Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">In-App Events</CardTitle>
            {unreadCount > 0 && (
              <Badge variant="warning">{unreadCount} unread</Badge>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                !unreadOnly
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Events
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                unreadOnly
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Unread Only
            </button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={4} cols={3} />
          ) : notifications.length === 0 ? (
            <EmptyState
              icon={<Bell className="w-8 h-8 text-slate-400" />}
              title="No notifications"
              description={
                unreadOnly
                  ? 'You have caught up with all notifications.'
                  : 'No notification records exist yet in the database.'
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((item) => {
                const isLowStock = item.type === 'low_stock';
                const isOrder = item.type === 'order_status';

                return (
                  <div
                    key={item.id}
                    className={`p-4 transition-colors flex items-start justify-between gap-4 hover:bg-slate-50/80 ${
                      !item.read ? 'bg-teal-50/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Event icon */}
                      <div
                        className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                          isLowStock
                            ? 'bg-amber-100/70 text-amber-700'
                            : isOrder
                            ? 'bg-sky-100/70 text-sky-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isLowStock ? (
                          <AlertTriangle className="w-4 h-4" />
                        ) : isOrder ? (
                          <ShoppingBag className="w-4 h-4" />
                        ) : (
                          <SlidersHorizontal className="w-4 h-4" />
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900">
                            {item.title}
                          </h4>
                          {!item.read && (
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                          )}
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {item.message}
                        </p>

                        <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-0.5">
                          <span>{formatDate(item.timestamp)}</span>
                          <span>•</span>
                          <span>{formatRelativeTime(item.timestamp)}</span>

                          {/* Reference link */}
                          {item.reference_id && (
                            <>
                              <span>•</span>
                              <Link
                                href={
                                  item.reference_type === 'order'
                                    ? `/orders/${item.reference_id}`
                                    : `/products`
                                }
                                className="text-teal-600 hover:text-teal-800 font-medium inline-flex items-center gap-1"
                              >
                                View {item.reference_type || 'record'}
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {!item.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleMarkRead(item.id)}
                        className="text-xs text-slate-400 hover:text-teal-700 shrink-0"
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
