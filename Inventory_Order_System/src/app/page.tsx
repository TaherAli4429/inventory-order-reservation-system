'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Product, Order } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { Skeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { StockAdjustmentDialog } from '@/components/stock/StockAdjustmentDialog';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { getOrderStatusStyle, formatCurrency, formatDate } from '@/lib/utils';
import {
  Package,
  AlertTriangle,
  PlusCircle,
  SlidersHorizontal,
  FileText,
  ShoppingBag,
  ArrowRight,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Archive,
} from 'lucide-react';

export default function DashboardPage() {
  const { role, canManageProducts, canAdjustStock, canCreateOrder, canViewAuditLogs } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states for quick actions
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [selectedStockProduct, setSelectedStockProduct] = useState<Product | undefined>();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, orderRes] = await Promise.all([
        api.getProducts(),
        api.getOrders({ limit: 5 }),
      ]);

      if (prodRes.success) {
        setProducts(prodRes.data);
      }
      if (orderRes.success) {
        setOrders(orderRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Derived real data metrics (strictly from live products & orders)
  const totalProducts = products.length;
  const activeProducts = products.filter((p) => p.is_active).length;
  const lowStockProducts = products.filter(
    (p) => p.is_active && p.available_quantity <= p.low_stock_threshold
  );
  const outOfStockProducts = products.filter(
    (p) => p.is_active && p.available_quantity === 0
  );

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const confirmedOrders = orders.filter((o) => o.status === 'confirmed');
  const fulfilledOrders = orders.filter((o) => o.status === 'fulfilled');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled');

  const handleAdjustStockClick = (product?: Product) => {
    setSelectedStockProduct(product);
    setIsStockDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header section with shortcuts */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Operational Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time inventory levels, critical stock thresholds, and order pipeline
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadDashboardData}
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

          {canAdjustStock && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAdjustStockClick()}
              leftIcon={<SlidersHorizontal className="w-3.5 h-3.5" />}
            >
              Adjust Stock
            </Button>
          )}

          {canManageProducts && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsProductDialogOpen(true)}
              leftIcon={<Package className="w-3.5 h-3.5" />}
            >
              New Product
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

      {/* 4 Core Inventory Metrics Cards (Authoritative Real Data Only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <Card className="hover:border-slate-300 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Total Products
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {totalProducts}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {activeProducts} active in catalog
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
              <Package className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Low Stock Items */}
        <Card className={lowStockProducts.length > 0 ? 'border-amber-200 bg-amber-50/20' : ''}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-amber-700 uppercase tracking-wider">
                Low-Stock Attention
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-amber-900 mt-1">
                  {lowStockProducts.length}
                </p>
              )}
              <p className="text-[11px] text-amber-600/80 mt-1">
                At or below reorder threshold
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-amber-100/70 border border-amber-300 flex items-center justify-center text-amber-700">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Out of Stock */}
        <Card className={outOfStockProducts.length > 0 ? 'border-rose-200 bg-rose-50/20' : ''}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-rose-700 uppercase tracking-wider">
                Out of Stock
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-rose-900 mt-1">
                  {outOfStockProducts.length}
                </p>
              )}
              <p className="text-[11px] text-rose-600/80 mt-1">
                Zero available units
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-rose-100/70 border border-rose-300 flex items-center justify-center text-rose-700">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Active Order Pipeline */}
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Orders
              </p>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : (
                <p className="text-2xl font-bold text-slate-900 mt-1">
                  {pendingOrders.length + confirmedOrders.length}
                </p>
              )}
              <p className="text-[11px] text-slate-400 mt-1">
                {pendingOrders.length} pending, {confirmedOrders.length} confirmed
              </p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Section: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Products Requiring Low-Stock Attention */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  Products Requiring Low-Stock Attention
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Items requiring immediate restock or stock adjustment
                </p>
              </div>
              <Link href="/products?low_stock=true">
                <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                  View All
                </Button>
              </Link>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : lowStockProducts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  All inventory items are currently above their configured low-stock thresholds.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                      <tr>
                        <th className="py-2.5 px-4">SKU / Product</th>
                        <th className="py-2.5 px-4 text-center">Available</th>
                        <th className="py-2.5 px-4 text-center">Threshold</th>
                        <th className="py-2.5 px-4 text-right">Unit Price</th>
                        <th className="py-2.5 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {lowStockProducts.map((p) => {
                        const isZero = p.available_quantity === 0;
                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <div className="font-semibold text-slate-900">{p.sku}</div>
                              <div className="text-[11px] text-slate-500 line-clamp-1">{p.name}</div>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <Badge variant={isZero ? 'danger' : 'warning'} dot>
                                {p.available_quantity} units
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-center text-slate-500">
                              {p.low_stock_threshold}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-slate-900">
                              {formatCurrency(p.unit_price)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              {canAdjustStock ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleAdjustStockClick(p)}
                                  className="h-7 text-xs"
                                >
                                  Adjust
                                </Button>
                              ) : (
                                <span className="text-[11px] text-slate-400">View Only</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Role-Authorized Actions</CardTitle>
              <span className="text-xs text-slate-400">Active Role: {role.toUpperCase()}</span>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                <Link
                  href="/orders/create"
                  className={`p-3 rounded-lg border text-left transition-all ${
                    canCreateOrder
                      ? 'border-slate-200 hover:border-teal-400 hover:bg-teal-50/20'
                      : 'opacity-50 pointer-events-none bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 mb-1">
                    <PlusCircle className="w-4 h-4 text-teal-600" />
                    Create Order
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Draft order with multi-item line items and idempotency key
                  </p>
                </Link>

                <button
                  type="button"
                  onClick={() => handleAdjustStockClick()}
                  disabled={!canAdjustStock}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    canAdjustStock
                      ? 'border-slate-200 hover:border-teal-400 hover:bg-teal-50/20'
                      : 'opacity-50 pointer-events-none bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 mb-1">
                    <SlidersHorizontal className="w-4 h-4 text-teal-600" />
                    Stock Adjustment
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Submit reasoned inventory restock or shrinkage
                  </p>
                </button>

                <Link
                  href="/audit-logs"
                  className={`p-3 rounded-lg border text-left transition-all ${
                    canViewAuditLogs
                      ? 'border-slate-200 hover:border-teal-400 hover:bg-teal-50/20'
                      : 'opacity-50 pointer-events-none bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 font-semibold text-xs text-slate-900 mb-1">
                    <FileText className="w-4 h-4 text-teal-600" />
                    Audit Logs
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Inspect immutable transactional event log
                  </p>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 span): Order Pipeline Status Breakdown & Recent Orders */}
        <div className="space-y-6">
          {/* Order Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Order Lifecycle Pipeline</CardTitle>
              <Link href="/orders" className="text-xs text-teal-600 hover:text-teal-700 font-medium">
                All Orders &rarr;
              </Link>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between p-2 rounded-lg bg-amber-50/60 border border-amber-200/60">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span className="text-xs font-semibold text-amber-900">Pending</span>
                </div>
                <Badge variant="warning">{pendingOrders.length} orders</Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-sky-50/60 border border-sky-200/60">
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-semibold text-sky-900">Confirmed (Stock Reserved)</span>
                </div>
                <Badge variant="info">{confirmedOrders.length} orders</Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/60 border border-emerald-200/60">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-semibold text-emerald-900">Fulfilled</span>
                </div>
                <Badge variant="success">{fulfilledOrders.length} orders</Badge>
              </div>

              <div className="flex items-center justify-between p-2 rounded-lg bg-slate-100 border border-slate-200">
                <div className="flex items-center gap-2">
                  <XCircle className="w-4 h-4 text-slate-500" />
                  <span className="text-xs font-semibold text-slate-700">Cancelled</span>
                </div>
                <Badge variant="default">{cancelledOrders.length} orders</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Recent Orders List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : orders.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  No orders found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {orders.slice(0, 4).map((order) => {
                    const statusInfo = getOrderStatusStyle(order.status);
                    return (
                      <Link
                        key={order.id}
                        href={`/orders/${order.id}`}
                        className="block p-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-xs text-slate-900">
                            {order.id}
                          </span>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusInfo.badgeClass}`}
                          >
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>
                            {order.items.length} items ({order.total_quantity} units)
                          </span>
                          <span className="font-medium text-slate-900">
                            {formatCurrency(order.total_amount)}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Stock Adjustment Dialog */}
      <StockAdjustmentDialog
        isOpen={isStockDialogOpen}
        onClose={() => setIsStockDialogOpen(false)}
        products={products}
        initialProduct={selectedStockProduct}
        onSuccess={loadDashboardData}
      />

      {/* Product Form Dialog (Create Product) */}
      <ProductFormDialog
        isOpen={isProductDialogOpen}
        onClose={() => setIsProductDialogOpen(false)}
        onSuccess={loadDashboardData}
      />
    </div>
  );
}
