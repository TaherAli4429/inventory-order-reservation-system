'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { api } from '@/lib/api';
import { Product, ProductInput } from '@/types';

interface ProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
  onSuccess: () => void;
}

export function ProductFormDialog({
  isOpen,
  onClose,
  productToEdit,
  onSuccess,
}: ProductFormDialogProps) {
  const isEditing = Boolean(productToEdit);

  const [sku, setSku] = useState('');
  const [name, setName] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [availableQuantity, setAvailableQuantity] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setSku(productToEdit.sku);
      setName(productToEdit.name);
      setUnitPrice(productToEdit.unit_price.toString());
      setAvailableQuantity(productToEdit.available_quantity.toString());
      setLowStockThreshold(productToEdit.low_stock_threshold.toString());
    } else {
      setSku('');
      setName('');
      setUnitPrice('');
      setAvailableQuantity('');
      setLowStockThreshold('5');
    }
    setError(null);
  }, [productToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!sku.trim()) {
      setError('SKU is required');
      return;
    }
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    const price = parseFloat(unitPrice);
    if (isNaN(price) || price < 0) {
      setError('Unit price must be a valid non-negative number');
      return;
    }

    const qty = parseInt(availableQuantity, 10);
    if (isNaN(qty) || qty < 0) {
      setError('Available quantity must be a non-negative integer');
      return;
    }

    const threshold = parseInt(lowStockThreshold, 10);
    if (isNaN(threshold) || threshold < 0) {
      setError('Low-stock threshold must be a non-negative integer');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && productToEdit) {
        await api.updateProduct(productToEdit.id, {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          unit_price: price,
          available_quantity: qty,
          low_stock_threshold: threshold,
        });
      } else {
        const newProductData: ProductInput = {
          sku: sku.trim().toUpperCase(),
          name: name.trim(),
          unit_price: price,
          available_quantity: qty,
          low_stock_threshold: threshold,
        };
        await api.createProduct(newProductData);
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save product';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product Details' : 'Create New Product'}
      description="All product attributes are validated on submission and recorded in the audit log."
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

        <Input
          label="SKU (Stock Keeping Unit)"
          required
          value={sku}
          onChange={(e) => setSku(e.target.value.toUpperCase())}
          placeholder="e.g. LOGI-MXM3S"
          helperText="Unique uppercase product identifier"
        />

        <Input
          label="Product Name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Logitech MX Master 3S Mouse"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Unit Price (USD)"
            type="number"
            step="0.01"
            min="0"
            required
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            placeholder="0.00"
          />

          <Input
            label="Initial Quantity"
            type="number"
            step="1"
            min="0"
            required
            value={availableQuantity}
            onChange={(e) => setAvailableQuantity(e.target.value)}
            placeholder="0"
            helperText="Initial on-hand inventory"
          />
        </div>

        <Input
          label="Low-Stock Warning Threshold"
          type="number"
          step="1"
          min="0"
          required
          value={lowStockThreshold}
          onChange={(e) => setLowStockThreshold(e.target.value)}
          placeholder="5"
          helperText="System triggers a warning and notification when stock reaches or drops below this number"
        />

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            {isEditing ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
