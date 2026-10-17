'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Order, OrderStatus } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { formatCurrency, formatDate, getOrderStatusStyle } from '@/lib/utils';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  PackageCheck,
  ShieldAlert,
  AlertTriangle,
  History,
  RefreshCw,
  Lock,
} from 'lucide-react';

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { role, canManageOrders } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Cancellation reason dialog
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('Cancelled by customer request');

  const loadOrder = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getOrderById(orderId);
      if (res.success && res.data) {
        setOrder(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order not found';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  // Order Confirmation action (atomic stock reservation)
  const handleConfirmOrder = async () => {
    if (!order) return;
    setError(null);
    setSuccessMessage(null);
    setIsActionLoading(true);

    try {
      const res = await api.confirmOrder(order.id);
      if (res.success) {
        setOrder(res.data);
        setSuccessMessage('Order confirmed successfully and stock was atomically reserved.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to confirm order';
      setError(msg);
      // Re-fetch authoritative state from server to reconcile
      loadOrder();
    } finally {
      setIsActionLoading(false);
    }
  };

  // Order Cancellation action (exact-once stock release)
  const handleCancelOrderSubmit = async () => {
    if (!order) return;
    setError(null);
    setSuccessMessage(null);
    setIsActionLoading(true);

    try {
      const res = await api.cancelOrder(order.id, cancelReason);
      if (res.success) {
        setOrder(res.data);
        setIsCancelModalOpen(false);
        setSuccessMessage(
          res.released_stock
            ? 'Order cancelled and reserved stock was released back to inventory.'
            : 'Order cancelled successfully.'
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel order';
      setError(msg);
      loadOrder();
    } finally {
      setIsActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-4xl mx-auto py-12 text-center space-y-3">
        <h2 className="text-lg font-bold text-slate-900">Order Not Found</h2>
        <p className="text-xs text-slate-500">Order ID &quot;{orderId}&quot; does not exist in the database.</p>
        <Link href="/orders">
          <Button size="sm" variant="outline">
            Return to Orders
          </Button>
        </Link>
      </div>
    );
  }

  const statusStyle = getOrderStatusStyle(order.status);
  const canConfirm = order.status === 'pending' && role !== 'viewer';
  const canCancel = (order.status === 'pending' || order.status === 'confirmed') && role !== 'viewer';

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Navigation & Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <Link
            href="/orders"
            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Orders
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {order.id}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusStyle.badgeClass}`}
            >
              <span className={`w-2 h-2 rounded-full ${statusStyle.dotClass}`} />
              {statusStyle.label}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadOrder}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              disabled={isActionLoading}
              onClick={() => setIsCancelModalOpen(true)}
              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
              leftIcon={<XCircle className="w-3.5 h-3.5" />}
            >
              Cancel Order
            </Button>
          )}

          {canConfirm && (
            <Button
              size="sm"
              isLoading={isActionLoading}
              onClick={handleConfirmOrder}
              leftIcon={<CheckCircle2 className="w-3.5 h-3.5" />}
            >
              Confirm & Reserve Stock
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
      {successMessage && (
        <AlertBanner
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {/* Role permission info */}
      {role === 'viewer' && (
        <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg border border-slate-300 text-xs text-slate-700">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            You are signed in with a <strong>Read-Only Viewer</strong> role. Confirming and cancelling orders is restricted to Admin and Staff roles.
          </span>
        </div>
      )}

      {/* Order Meta & Status Details Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Order Submitted
          </p>
          <p className="text-sm font-semibold text-slate-900 mt-1">
            {formatDate(order.created_at)}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            By {order.created_by} ({order.created_by_role})
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Inventory Reservation Status
          </p>
          <p className="text-sm font-semibold text-slate-900 mt-1 flex items-center gap-1.5">
            {order.status === 'confirmed' || order.status === 'fulfilled' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">Stock Atomically Reserved</span>
              </>
            ) : order.status === 'pending' ? (
              <>
                <Clock className="w-4 h-4 text-amber-600" />
                <span className="text-amber-700">Pending Reservation</span>
              </>
            ) : (
              <>
                <XCircle className="w-4 h-4 text-slate-500" />
                <span className="text-slate-600">Stock Released / Unreserved</span>
              </>
            )}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {order.total_quantity} total units across {order.items.length} line items
          </p>
        </Card>

        <Card className="p-4 bg-slate-50/50">
          <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Authoritative Order Total
          </p>
          <p className="text-xl font-bold text-slate-900 mt-1">
            {formatCurrency(order.total_amount)}
          </p>
          <p className="text-[11px] text-teal-600 font-medium mt-0.5">
            Calculated server-side from catalog
          </p>
        </Card>
      </div>

      {/* Ordered Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Ordered Products ({order.items.length} {order.items.length === 1 ? 'item' : 'items'})
          </CardTitle>
          <span className="text-xs text-slate-400">Database Verified Pricing</span>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                <tr>
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4 text-right">Unit Price</th>
                  <th className="py-3 px-4 text-center">Quantity</th>
                  <th className="py-3 px-4 text-right">Authoritative Line Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {order.items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                      {item.sku}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-700">
                      {formatCurrency(item.unit_price)}
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-slate-800">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      {formatCurrency(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50/80 border-t border-slate-200 font-semibold text-xs text-slate-900">
                <tr>
                  <td colSpan={3} className="py-3 px-4 text-right">
                    Total Order Value:
                  </td>
                  <td className="py-3 px-4 text-center">
                    {order.total_quantity} units
                  </td>
                  <td className="py-3 px-4 text-right text-base text-teal-800 font-bold">
                    {formatCurrency(order.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Order Status History Timeline (PDF Requirement) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="w-4 h-4 text-slate-600" />
            Order Status History Timeline
          </CardTitle>
          <span className="text-xs text-slate-400">
            Immutable Audit Events ({order.history?.length || 0})
          </span>
        </CardHeader>
        <CardContent className="p-5">
          {!order.history || order.history.length === 0 ? (
            <p className="text-xs text-slate-500">No status history available.</p>
          ) : (
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {order.history.map((hist, idx) => {
                const histStatusStyle = getOrderStatusStyle(hist.new_status);
                return (
                  <div key={hist.id} className="relative group">
                    {/* Timeline dot */}
                    <span
                      className={`absolute -left-6 mt-1 h-4 w-4 rounded-full border-2 border-white ring-2 ring-slate-200 ${histStatusStyle.dotClass}`}
                    />

                    <div className="bg-slate-50/80 p-3.5 rounded-lg border border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${histStatusStyle.badgeClass}`}
                          >
                            {hist.new_status.toUpperCase()}
                          </span>
                          {hist.previous_status && (
                            <span className="text-[11px] text-slate-400">
                              (transitioned from {hist.previous_status})
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {formatDate(hist.timestamp)}
                        </span>
                      </div>

                      <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                        {hist.note || 'Status updated'}
                      </p>

                      <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                        <span>Actor: <strong>{hist.actor_email}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span className="capitalize">{hist.actor_role}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cancel Order Confirmation Modal */}
      <Dialog
        isOpen={isCancelModalOpen}
        onClose={() => setIsCancelModalOpen(false)}
        title="Cancel Order"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 text-xs text-amber-900">
            {order.status === 'confirmed' ? (
              <p>
                This order is currently <strong>Confirmed</strong>. Cancelling will atomically release all reserved stock back to active inventory.
              </p>
            ) : (
              <p>
                Cancelling this pending order will move it to Cancelled status.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-700">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="e.g. Client requested cancellation; OR duplicate order..."
              className="block w-full rounded-lg border border-slate-300 text-xs text-slate-900 p-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCancelModalOpen(false)}
              disabled={isActionLoading}
            >
              Close
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              isLoading={isActionLoading}
              onClick={handleCancelOrderSubmit}
            >
              Confirm Cancellation
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
