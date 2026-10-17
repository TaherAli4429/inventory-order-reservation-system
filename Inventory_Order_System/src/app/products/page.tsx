'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductFormDialog } from '@/components/products/ProductFormDialog';
import { DeactivateDialog } from '@/components/products/DeactivateDialog';
import { StockAdjustmentDialog } from '@/components/stock/StockAdjustmentDialog';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  Package,
  Search,
  Plus,
  SlidersHorizontal,
  Edit2,
  Trash2,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export default function ProductsPage() {
  const { role, canManageProducts, canAdjustStock } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'low_stock'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [productToDeactivate, setProductToDeactivate] = useState<Product | null>(null);
  const [isStockAdjustmentOpen, setIsStockAdjustmentOpen] = useState(false);
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getProducts({
        q: searchQuery,
        status: statusFilter === 'active' ? 'active' : undefined,
        low_stock: statusFilter === 'low_stock' ? true : undefined,
      });
      if (res.success) {
        setProducts(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load products';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, statusFilter]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleCreateNew = () => {
    setProductToEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (product: Product) => {
    setProductToEdit(product);
    setIsFormOpen(true);
  };

  const handleDeactivate = (product: Product) => {
    setProductToDeactivate(product);
  };

  const handleAdjustStock = (product: Product) => {
    setProductToAdjust(product);
    setIsStockAdjustmentOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Products & Inventory
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage SKU records, real-time available quantities, and low-stock reorder thresholds
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadProducts}
            leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
          >
            Refresh
          </Button>

          {canManageProducts && (
            <Button
              size="sm"
              onClick={handleCreateNew}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Add Product
            </Button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
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

      {/* Filters & Search Bar */}
      <Card>
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search by SKU or product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="py-1.5 text-xs"
            />
          </div>

          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 mr-1 hidden sm:inline">Filter:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'all'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Items
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'active'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Active Only
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('low_stock')}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFilter === 'low_stock'
                  ? 'bg-amber-600 text-white font-semibold'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Low Stock Only
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Catalog Inventory ({products.length} {products.length === 1 ? 'item' : 'items'})
          </CardTitle>
          <span className="text-xs text-slate-400">
            Role: <strong className="capitalize text-slate-700">{role}</strong>
          </span>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="w-8 h-8 text-slate-400" />}
              title="No products found"
              description={
                searchQuery
                  ? `No products matching "${searchQuery}". Try adjusting your search query.`
                  : 'No inventory items are currently recorded.'
              }
              actionLabel={canManageProducts ? 'Add Product' : undefined}
              onAction={canManageProducts ? handleCreateNew : undefined}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                  <tr>
                    <th className="py-3 px-4">SKU</th>
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-4 text-right">Unit Price</th>
                    <th className="py-3 px-4 text-center">Available Stock</th>
                    <th className="py-3 px-4 text-center">Low-Stock Threshold</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {products.map((product) => {
                    const isLowStock =
                      product.available_quantity <= product.low_stock_threshold;
                    const isOutOfStock = product.available_quantity === 0;

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !product.is_active ? 'bg-slate-50/40 opacity-70' : ''
                        }`}
                      >
                        {/* SKU */}
                        <td className="py-3 px-4 font-mono font-semibold text-slate-900">
                          {product.sku}
                        </td>

                        {/* Name */}
                        <td className="py-3 px-4">
                          <span className="font-medium text-slate-900 block">
                            {product.name}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3 px-4 text-right font-medium text-slate-900">
                          {formatCurrency(product.unit_price)}
                        </td>

                        {/* Available Quantity */}
                        <td className="py-3 px-4 text-center">
                          {isOutOfStock ? (
                            <Badge variant="danger" dot>
                              0 (Out of stock)
                            </Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning" dot>
                              {product.available_quantity} (Low stock)
                            </Badge>
                          ) : (
                            <span className="font-semibold text-slate-900">
                              {product.available_quantity}
                            </span>
                          )}
                        </td>

                        {/* Low-Stock Threshold */}
                        <td className="py-3 px-4 text-center text-slate-500">
                          {product.low_stock_threshold}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 text-center">
                          {product.is_active ? (
                            <Badge variant="success">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Deactivated</Badge>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {canAdjustStock && product.is_active && (
                              <button
                                type="button"
                                title="Adjust Stock"
                                onClick={() => handleAdjustStock(product)}
                                className="p-1 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded transition-colors"
                              >
                                <SlidersHorizontal className="w-4 h-4" />
                              </button>
                            )}

                            {canManageProducts && (
                              <>
                                <button
                                  type="button"
                                  title="Edit Product"
                                  onClick={() => handleEdit(product)}
                                  className="p-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>

                                {product.is_active && (
                                  <button
                                    type="button"
                                    title="Deactivate Product"
                                    onClick={() => handleDeactivate(product)}
                                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}

                            {!canManageProducts && !canAdjustStock && (
                              <span className="text-[11px] text-slate-400">Read-Only</span>
                            )}
                          </div>
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

      {/* Product Form Modal (Create / Edit) */}
      <ProductFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={productToEdit}
        onSuccess={() => {
          loadProducts();
          setSuccessMessage(
            productToEdit
              ? `Product "${productToEdit.name}" updated successfully.`
              : 'Product created successfully.'
          );
        }}
      />

      {/* Deactivate Confirmation Modal */}
      <DeactivateDialog
        isOpen={Boolean(productToDeactivate)}
        onClose={() => setProductToDeactivate(null)}
        product={productToDeactivate}
        onSuccess={() => {
          loadProducts();
          setSuccessMessage(`Product "${productToDeactivate?.name}" deactivated.`);
        }}
      />

      {/* Stock Adjustment Modal */}
      <StockAdjustmentDialog
        isOpen={isStockAdjustmentOpen}
        onClose={() => setIsStockAdjustmentOpen(false)}
        products={products}
        initialProduct={productToAdjust}
        onSuccess={() => {
          loadProducts();
          setSuccessMessage('Stock adjustment recorded successfully.');
        }}
      />
    </div>
  );
}
