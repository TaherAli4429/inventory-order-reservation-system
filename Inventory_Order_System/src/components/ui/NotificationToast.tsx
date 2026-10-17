import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export interface AlertBannerProps {
  type?: 'success' | 'warning' | 'error' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  className?: string;
}

export function AlertBanner({
  type = 'info',
  title,
  message,
  onClose,
  className,
}: AlertBannerProps) {
  const styles = {
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    error: 'bg-rose-50 border-rose-200 text-rose-800',
    info: 'bg-sky-50 border-sky-200 text-sky-800',
  };

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />,
    error: <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />,
    info: <Info className="h-4 w-4 text-sky-600 shrink-0 mt-0.5" />,
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3.5 rounded-lg border text-xs transition-all shadow-sm',
        styles[type],
        className
      )}
      role="alert"
    >
      {icons[type]}
      <div className="flex-1 min-w-0">
        {title && <h5 className="font-semibold mb-0.5">{title}</h5>}
        <p className="leading-relaxed break-words">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          type="button"
          className="text-current opacity-70 hover:opacity-100 p-0.5"
          aria-label="Dismiss alert"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
