'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { Plus, Minus, ArrowRight } from 'lucide-react';

interface StockAdjustmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  initialProduct?: Product | null;
  onSuccess: () => void;
}

export function StockAdjustmentDialog({
  isOpen,
  onClose,
  products,
  initialProduct,
  onSuccess,
}: StockAdjustmentDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'increase' | 'decrease'>('increase');
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialProduct) {
      setSelectedProductId(initialProduct.id);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
    setError(null);
  }, [initialProduct, products, isOpen, selectedProductId]);

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const qtyNumber = parseInt(quantity, 10) || 0;
  const netChange = adjustmentType === 'increase' ? qtyNumber : -qtyNumber;
  const projectedQuantity = selectedProduct
    ? selectedProduct.available_quantity + netChange
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Please select a product to adjust');
      return;
    }

    if (qtyNumber <= 0) {
      setError('Please enter a valid quantity greater than zero');
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
      await api.createStockAdjustment({
        product_id: selectedProductId,
        quantity_change: netChange,
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
      setQuantity('1');
      setReason('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process stock adjustment';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Record Stock Adjustment"
      description="Stock adjustments update inventory immediately and are permanently recorded in the audit log."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <AlertBanner
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        {/* Product selector */}
        <Select
          label="Target Product"
          required
          value={selectedProductId}
          onChange={(e) => setSelectedProductId(e.target.value)}
        >
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.sku} — {p.name} (Current: {p.available_quantity} available)
            </option>
          ))}
        </Select>

        {/* Increase / Decrease Toggle */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Adjustment Direction <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAdjustmentType('increase')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
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
              onClick={() => setAdjustmentType('decrease')}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-semibold transition-all ${
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

        {/* Quantity */}
        <Input
          label="Quantity"
          type="number"
          min="1"
          step="1"
          required
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="Enter quantity"
        />

        {/* Live Projection Pill */}
        {selectedProduct && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-center justify-between">
            <span className="text-slate-500">Inventory Projection:</span>
            <div className="flex items-center gap-2 font-medium">
              <span className="text-slate-700">
                Current: <strong>{selectedProduct.available_quantity}</strong>
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
                Projected: {projectedQuantity} units
              </span>
            </div>
          </div>
        )}

        {/* Reason */}
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-700">
            Reason for Adjustment <span className="text-rose-500">*</span>
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Supplier PO restock shipment received; OR Damaged packaging moved to QA..."
            className="block w-full rounded-lg border border-slate-300 text-xs text-slate-900 p-2.5 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
          />
          <p className="text-[11px] text-slate-400">
            Mandatory explanation required for backend audit trail.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            isLoading={isSubmitting}
            disabled={projectedQuantity < 0}
          >
            Submit Stock Adjustment
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
