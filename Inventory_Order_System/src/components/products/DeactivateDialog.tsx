'use client';

import React, { useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { api } from '@/lib/api';
import { Product } from '@/types';
import { AlertTriangle } from 'lucide-react';

interface DeactivateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export function DeactivateDialog({
  isOpen,
  onClose,
  product,
  onSuccess,
}: DeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!product) return null;

  const handleDeactivate = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      await api.deactivateProduct(product.id);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deactivate product';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Product Deactivation"
      maxWidth="sm"
    >
      <div className="space-y-4">
        {error && (
          <AlertBanner
            type="error"
            message={error}
            onClose={() => setError(null)}
          />
        )}

        <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200 text-amber-900 text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p>
            Deactivating <strong>{product.name}</strong> ({product.sku}) will prevent staff from adding it to new orders. Existing order history will remain intact.
          </p>
        </div>

        <p className="text-xs text-slate-600">
          Are you sure you want to proceed with deactivation? This action will be recorded in the system audit log.
        </p>

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
            type="button"
            variant="danger"
            size="sm"
            isLoading={isSubmitting}
            onClick={handleDeactivate}
          >
            Deactivate Product
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
