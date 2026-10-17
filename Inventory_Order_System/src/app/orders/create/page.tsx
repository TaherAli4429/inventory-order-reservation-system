'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Product, OrderItemInput } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { formatCurrency, generateIdempotencyKey } from '@/lib/utils';
import {
  Plus,
  Trash2,
  ArrowLeft,
  ShieldAlert,
  Info,
  CheckCircle2,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

interface DraftItem {
  id: string; // client temporary ID for React key
  productId: string;
  quantity: number;
}

export default function CreateOrderPage() {
  const router = useRouter();
  const { role, canCreateOrder } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize idempotency key and products
  useEffect(() => {
    setIdempotencyKey(generateIdempotencyKey());

    const loadProducts = async () => {
      setIsLoadingProducts(true);
      try {
        const res = await api.getProducts({ status: 'active' });
        if (res.success && res.data.length > 0) {
          setProducts(res.data);
          // Set first initial line item
          setItems([
            {
              id: 'draft-item-1',
              productId: res.data[0].id,
              quantity: 1,
            },
          ]);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch catalog';
        setError(msg);
      } finally {
        setIsLoadingProducts(false);
      }
    };

    loadProducts();
  }, []);

  const handleAddItem = () => {
    if (products.length === 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: `draft-item-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        productId: products[0].id,
        quantity: 1,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      setError('An order must contain at least one line item.');
      return;
    }
    setError(null);
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleProductChange = (index: number, newProductId: string) => {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], productId: newProductId };
      return updated;
    });
  };

  const handleQuantityChange = (index: number, val: string) => {
    const qty = parseInt(val, 10);
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        quantity: isNaN(qty) ? 0 : Math.max(0, qty),
      };
      return updated;
    });
  };

  const handleRegenerateKey = () => {
    setIdempotencyKey(generateIdempotencyKey());
  };

  // Calculate estimated totals for UI preview
  const estimatedSubtotal = items.reduce((acc, item) => {
    const prod = products.find((p) => p.id === item.productId);
    return acc + (prod ? prod.unit_price * item.quantity : 0);
  }, 0);

  const totalQuantityUnits = items.reduce((acc, item) => acc + item.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canCreateOrder) {
      setError('Unauthorized: Your role does not have permission to create orders.');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one line item.');
      return;
    }

    // Validate quantities
    for (const item of items) {
      if (item.quantity <= 0) {
        setError('All product quantities must be greater than zero.');
        return;
      }
      const prod = products.find((p) => p.id === item.productId);
      if (prod && prod.available_quantity < item.quantity) {
        setError(
          `Requested quantity for "${prod.name}" (${item.quantity}) exceeds available stock (${prod.available_quantity}).`
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: OrderItemInput[] = items.map((i) => ({
        product_id: i.productId,
        quantity: i.quantity,
      }));

      const res = await api.createOrder({
        items: payload,
        idempotency_key: idempotencyKey,
      });

      if (res.success && res.data) {
        router.push(`/orders/${res.data.id}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Order creation failed';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <Link
            href="/orders"
            className="text-xs text-teal-600 hover:text-teal-700 font-medium flex items-center gap-1 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Orders
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Create New Order
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Add one or more product line items with idempotency retry protection
          </p>
        </div>
      </div>

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Backend Authoritative Notice Banner (PDF Requirement) */}
      <div className="flex items-start gap-3 p-3.5 bg-teal-50/70 border border-teal-200 rounded-xl text-teal-900 text-xs">
        <Info className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">Server-Authoritative Pricing & Stock: </span>
          Line prices and order totals shown below are live estimates. The backend authoritative server validates all catalog prices, checks atomic stock, and generates final totals on submission.
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Line Items Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Order Line Items ({items.length})</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddItem}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
              disabled={products.length === 0}
            >
              Add Product
            </Button>
          </CardHeader>

          <CardContent className="p-4 space-y-3">
            {isLoadingProducts ? (
              <div className="p-6 text-center text-xs text-slate-500">
                Loading product catalog...
              </div>
            ) : products.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No active products available in catalog to order.
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item, index) => {
                  const selectedProd = products.find((p) => p.id === item.productId);
                  const lineTotal = selectedProd ? selectedProd.unit_price * item.quantity : 0;
                  const hasStockWarning = selectedProd && selectedProd.available_quantity < item.quantity;

                  return (
                    <div
                      key={item.id}
                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                    >
                      {/* Product Selector (6 cols) */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Product #{index + 1}
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                          className="block w-full rounded-md border border-slate-300 text-xs text-slate-900 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.name} ({formatCurrency(p.unit_price)})
                            </option>
                          ))}
                        </select>
                        {selectedProd && (
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                            <span>Available stock: {selectedProd.available_quantity} units</span>
                            {selectedProd.available_quantity <= selectedProd.low_stock_threshold && (
                              <span className="text-amber-600 font-medium">(Low Stock)</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Quantity Input (3 cols) */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          required
                          value={item.quantity || ''}
                          onChange={(e) => handleQuantityChange(index, e.target.value)}
                          className={`block w-full rounded-md border text-xs text-slate-900 bg-white px-2.5 py-1.5 focus:outline-none focus:ring-1 ${
                            hasStockWarning
                              ? 'border-rose-400 focus:ring-rose-400'
                              : 'border-slate-300 focus:ring-teal-500'
                          }`}
                        />
                        {hasStockWarning && (
                          <p className="text-[10px] text-rose-600 mt-0.5">
                            Exceeds stock ({selectedProd?.available_quantity})
                          </p>
                        )}
                      </div>

                      {/* Line total & Remove (3 cols) */}
                      <div className="sm:col-span-3 flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-4">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block sm:hidden">
                            Estimated Total:
                          </span>
                          <span className="font-bold text-xs text-slate-900">
                            {formatCurrency(lineTotal)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          title="Remove Line Item"
                          disabled={items.length <= 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Idempotency Key & Order Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Idempotency Protection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xs flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-teal-600" />
                Idempotency Protection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-slate-500 leading-relaxed">
                Prevents duplicate order creation if network retries occur.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={idempotencyKey}
                  className="bg-slate-100 border border-slate-200 text-[11px] font-mono text-slate-700 rounded-md px-2 py-1.5 flex-1 select-all"
                />
                <button
                  type="button"
                  onClick={handleRegenerateKey}
                  title="Generate New Idempotency Key"
                  className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md border border-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Authoritative Order Summary */}
          <Card className="bg-slate-50/50">
            <CardHeader>
              <CardTitle className="text-xs">Order Preview Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Line Items:</span>
                <span className="font-semibold text-slate-800">{items.length} items</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Total Quantity:</span>
                <span className="font-semibold text-slate-800">{totalQuantityUnits} units</span>
              </div>
              <div className="flex justify-between text-xs text-slate-600">
                <span>Initial Status on Submission:</span>
                <Badge variant="warning">Pending</Badge>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-slate-900">Estimated Total:</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(estimatedSubtotal)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Submission Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
          <Link href="/orders">
            <Button type="button" variant="outline" disabled={isSubmitting}>
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={items.length === 0 || !canCreateOrder}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Submit Order
          </Button>
        </div>
      </form>
    </div>
  );
}
