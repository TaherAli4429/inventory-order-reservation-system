'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Product, StockAdjustment } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import {
  SlidersHorizontal,
  Plus,
  Minus,
  ArrowRight,
  History,
  Lock,
  RefreshCw,
} from 'lucide-react';

export default function StockAdjustmentsPage() {
  const { role, canAdjustStock } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [prodRes, adjRes] = await Promise.all([
        api.getProducts({ status: 'active' }),
        api.getStockAdjustments(),
      ]);

      if (prodRes.success) {
        setProducts(prodRes.data);
        if (prodRes.data.length > 0 && !selectedProductId) {
          setSelectedProductId(prodRes.data[0].id);
        }
      }
      if (adjRes.success) {
        setAdjustments(adjRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load stock data';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedProductId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qtyNumber = parseInt(quantity, 10) || 0;
  const netChange = adjustmentType === 'increase' ? qtyNumber : -qtyNumber;
  const projectedQuantity = selectedProduct
    ? selectedProduct.available_quantity + netChange
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (!canAdjustStock) {
      setError('Unauthorized: Your role does not have permission to adjust inventory.');
      return;
    }

    if (!selectedProductId) {
      setError('Please select a product');
      return;
    }

    if (qtyNumber <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }

    if (!reason.trim()) {
      setError('A reason for the stock adjustment is mandatory');
      return;
    }

    if (projectedQuantity < 0) {
      setError(
        `Cannot reduce stock by ${qtyNumber} units. Only ${selectedProduct?.available_quantity || 0} units are currently available.`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createStockAdjustment({
        product_id: selectedProductId,
        quantity_change: netChange,
        reason: reason.trim(),
      });

      if (res.success) {
        setSuccessMessage(
          `Stock adjusted successfully: ${res.product.sku} now has ${res.product.available_quantity} available units.`
        );
        setReason('');
        setQuantity('1');
        loadData();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Stock adjustment failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Stock Adjustment
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Submit reasoned stock increases or deductions with authoritative server recording and audit logging
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh History
        </Button>
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

      {/* Permission warning if viewer */}
      {!canAdjustStock && (
        <div className="flex items-center gap-2 p-3 bg-slate-100 rounded-lg border border-slate-300 text-xs text-slate-700">
          <Lock className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            You are signed in as a <strong>Read-Only Viewer</strong>. Stock adjustments can only be submitted by Admin and authorized Staff users.
          </span>
        </div>
      )}

      {/* 2 Column Layout: Form on Left, History Table on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form (5 columns) */}
        <div className="lg:col-span-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <SlidersHorizontal className="w-4 h-4 text-teal-600" />
                Submit Adjustment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Product Selection */}
                <Select
                  label="Target Product"
                  required
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  disabled={!canAdjustStock}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({p.available_quantity} available)
                    </option>
                  ))}
                </Select>

                {/* Adjustment Direction Toggle */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Adjustment Direction <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!canAdjustStock}
                      onClick={() => setAdjustmentType('increase')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        adjustmentType === 'increase'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Plus className="w-4 h-4 text-emerald-600" />
                      Increase / Restock (+)
                    </button>

                    <button
                      type="button"
                      disabled={!canAdjustStock}
                      onClick={() => setAdjustmentType('decrease')}
                      className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
                        adjustmentType === 'decrease'
                          ? 'border-amber-600 bg-amber-50 text-amber-800 ring-2 ring-amber-500/20'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Minus className="w-4 h-4 text-amber-600" />
                      Decrease / Deduction (-)
                    </button>
                  </div>
                </div>

                {/* Units */}
                <Input
                  label="Adjustment Quantity"
                  type="number"
                  min="1"
                  step="1"
                  required
                  disabled={!canAdjustStock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Number of units"
                />

                {/* Live Preview Projection */}
                {selectedProduct && (
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
                    <span className="text-slate-500">Live Inventory Preview:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-700">
                        {selectedProduct.available_quantity}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      <span
                        className={
                          projectedQuantity < 0
                            ? 'text-rose-600 font-bold'
                            : projectedQuantity <= selectedProduct.low_stock_threshold
                            ? 'text-amber-600 font-bold'
                            : 'text-emerald-700 font-bold'
                        }
                      >
                        {projectedQuantity} units
                      </span>
                    </div>
                  </div>
                )}

                {/* Mandatory Reason */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-700">
                    Reason for Adjustment <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    disabled={!canAdjustStock}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Verified supplier delivery PO-4482; or damaged during shelf handling; or quarterly audit reconciliation..."
                    className="block w-full rounded-lg border border-slate-300 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 disabled:bg-slate-100 disabled:text-slate-400"
                  />
                  <p className="text-[11px] text-slate-500">
                    Every adjustment is immutably logged with the acting user and timestamp.
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  isLoading={isSubmitting}
                  disabled={!canAdjustStock || projectedQuantity < 0}
                >
                  Submit Stock Adjustment
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right History Table (7 columns) */}
        <div className="lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <History className="w-4 h-4 text-slate-600" />
                Recent Stock Adjustments ({adjustments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <TableSkeleton rows={5} cols={4} />
              ) : adjustments.length === 0 ? (
                <EmptyState
                  icon={<History className="w-8 h-8 text-slate-400" />}
                  title="No stock adjustments recorded"
                  description="Adjustments submitted through the form will appear here with actor and reason."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                      <tr>
                        <th className="py-2.5 px-4">Timestamp</th>
                        <th className="py-2.5 px-4">Product</th>
                        <th className="py-2.5 px-4 text-center">Change</th>
                        <th className="py-2.5 px-4">Actor</th>
                        <th className="py-2.5 px-4">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {adjustments.map((adj) => {
                        const isIncrease = adj.quantity_change > 0;
                        return (
                          <tr key={adj.id} className="hover:bg-slate-50/60">
                            <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">
                              {formatDate(adj.created_at)}
                            </td>
                            <td className="py-2.5 px-4">
                              <span className="font-semibold text-slate-900 block font-mono">
                                {adj.product_sku}
                              </span>
                              <span className="text-[11px] text-slate-500 line-clamp-1">
                                {adj.product_name}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <Badge variant={isIncrease ? 'success' : 'danger'}>
                                {isIncrease ? `+${adj.quantity_change}` : adj.quantity_change}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600">
                              <div className="font-medium text-slate-800">{adj.actor_email}</div>
                              <div className="text-[10px] text-slate-400 uppercase">
                                {adj.actor_role}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 max-w-xs">
                              <p className="line-clamp-2 text-[11px]">{adj.reason}</p>
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
        </div>
      </div>
    </div>
  );
}
