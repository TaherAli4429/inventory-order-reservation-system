'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Order, OrderStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCurrency, formatDate, getOrderStatusStyle } from '@/lib/utils';
import {
  ShoppingBag,
  PlusCircle,
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  PackageCheck,
} from 'lucide-react';

export default function OrdersPage() {
  const { canCreateOrder } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getOrders({
        page: currentPage,
        limit: 8,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        q: searchQuery,
      });

      if (res.success) {
        setOrders(res.data);
        setCurrentPage(res.pagination.page);
        setTotalPages(res.pagination.total_pages);
        setTotalCount(res.pagination.total);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load orders';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, statusFilter, searchQuery]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Orders Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor requisition lifecycle: Pending &rarr; Confirmed &rarr; Fulfilled &rarr; Cancelled
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrders}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {canCreateOrder && (
            <Link href="/orders/create">
              <Button size="sm" leftIcon={<PlusCircle className="w-3.5 h-3.5" />}>
                Create Order
              </Button>
            </Link>
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

      {/* Filter / Search Bar */}
      <Card>
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search by Order ID, item, or creator..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              leftIcon={<Search className="w-4 h-4" />}
              className="py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 mr-1 hidden sm:inline">Status:</span>
            {[
              { id: 'all', label: 'All Orders' },
              { id: 'pending', label: 'Pending' },
              { id: 'confirmed', label: 'Confirmed' },
              { id: 'fulfilled', label: 'Fulfilled' },
              { id: 'cancelled', label: 'Cancelled' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === tab.id
                    ? 'bg-teal-600 text-white font-semibold'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Orders Table Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Orders Pipeline ({totalCount} total)
          </CardTitle>
          <span className="text-xs text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : orders.length === 0 ? (
            <EmptyState
              icon={<ShoppingBag className="w-8 h-8 text-slate-400" />}
              title="No orders found"
              description={
                searchQuery || statusFilter !== 'all'
                  ? 'No orders match your filter criteria.'
                  : 'No orders have been submitted yet.'
              }
              actionLabel={canCreateOrder ? 'Create First Order' : undefined}
              onAction={
                canCreateOrder
                  ? () => {
                      window.location.href = '/orders/create';
                    }
                  : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                  <tr>
                    <th className="py-3 px-4">Order ID</th>
                    <th className="py-3 px-4">Date & Creator</th>
                    <th className="py-3 px-4">Ordered Products</th>
                    <th className="py-3 px-4 text-center">Total Units</th>
                    <th className="py-3 px-4 text-right">Server Authoritative Total</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {orders.map((order) => {
                    const statusInfo = getOrderStatusStyle(order.status);
                    return (
                      <tr
                        key={order.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* ID */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          <Link
                            href={`/orders/${order.id}`}
                            className="text-teal-700 hover:text-teal-900 hover:underline"
                          >
                            {order.id}
                          </Link>
                        </td>

                        {/* Date & Creator */}
                        <td className="py-3 px-4">
                          <div className="text-slate-900 font-medium">
                            {formatDate(order.created_at)}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {order.created_by} ({order.created_by_role})
                          </div>
                        </td>

                        {/* Item preview */}
                        <td className="py-3 px-4 max-w-xs">
                          <div className="text-[11px] text-slate-800 line-clamp-1 font-medium">
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {order.items.map((i) => i.sku).join(', ')}
                          </div>
                        </td>

                        {/* Total quantity */}
                        <td className="py-3 px-4 text-center font-medium text-slate-800">
                          {order.total_quantity}
                        </td>

                        {/* Server Total */}
                        <td className="py-3 px-4 text-right font-bold text-slate-900">
                          {formatCurrency(order.total_amount)}
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.badgeClass}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                            {statusInfo.label}
                          </span>
                        </td>

                        {/* Action link */}
                        <td className="py-3 px-4 text-right">
                          <Link href={`/orders/${order.id}`}>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              rightIcon={<Eye className="w-3.5 h-3.5" />}
                            >
                              Details
                            </Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing {(currentPage - 1) * 8 + 1} to{' '}
              {Math.min(currentPage * 8, totalCount)} of {totalCount} entries
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
              >
                Previous
              </Button>
              <span className="text-xs font-semibold px-2 text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
