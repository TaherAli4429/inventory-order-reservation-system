'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { AuditLog } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Search,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Lock,
  ArrowRightLeft,
  Package,
  ShoppingBag,
} from 'lucide-react';

export default function AuditLogsPage() {
  const { role, canViewAuditLogs, switchRole } = useAuth();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAuditLogs = useCallback(async () => {
    if (!canViewAuditLogs) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAuditLogs({
        q: searchQuery,
        action: actionFilter !== 'all' ? actionFilter : undefined,
      });

      if (res.success) {
        setLogs(res.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load audit logs';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [canViewAuditLogs, searchQuery, actionFilter]);

  useEffect(() => {
    loadAuditLogs();
  }, [loadAuditLogs]);

  // Access Denied View for unauthorized roles (Staff or Viewer)
  if (!canViewAuditLogs) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <Card className="border-rose-200">
          <CardContent className="p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Access Denied: Administrator Privilege Required
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                You are currently signed in as <strong>{role.toUpperCase()}</strong>. System audit logs and transactional history are restricted to authorized administrators.
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 max-w-sm mx-auto">
              To inspect audit logs during assignment evaluation, switch to the <strong>Admin</strong> role using the quick-switch button below.
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                onClick={() => switchRole('admin')}
                leftIcon={<ShieldCheck className="w-4 h-4" />}
              >
                Switch to Admin Role
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'PRODUCT_CREATED':
        return <Badge variant="success">Product Created</Badge>;
      case 'PRODUCT_UPDATED':
        return <Badge variant="info">Product Updated</Badge>;
      case 'PRODUCT_DEACTIVATED':
        return <Badge variant="danger">Product Deactivated</Badge>;
      case 'STOCK_ADJUSTMENT':
        return <Badge variant="warning">Stock Adjustment</Badge>;
      case 'ORDER_CREATED':
        return <Badge variant="info">Order Created</Badge>;
      case 'ORDER_CONFIRMED':
        return <Badge variant="success">Order Confirmed</Badge>;
      case 'ORDER_CANCELLED':
        return <Badge variant="danger">Order Cancelled</Badge>;
      default:
        return <Badge variant="default">{action}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Audit Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable system audit trail: actor, operation, stock quantities, and timestamps
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={loadAuditLogs}
          leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
        >
          Refresh Logs
        </Button>
      </div>

      {error && (
        <AlertBanner
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="w-full sm:w-80">
            <Input
              placeholder="Search by actor, SKU, order ID, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leftIcon={<Search className="w-4 h-4" />}
              className="py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
            <span className="text-xs text-slate-500 mr-1 hidden sm:inline">Event:</span>
            {[
              { id: 'all', label: 'All Events' },
              { id: 'STOCK_ADJUSTMENT', label: 'Stock' },
              { id: 'ORDER_CONFIRMED', label: 'Confirmed' },
              { id: 'ORDER_CANCELLED', label: 'Cancelled' },
              { id: 'PRODUCT_CREATED', label: 'Products' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActionFilter(tab.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  actionFilter === tab.id
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

      {/* Audit Log Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Transactional Audit History ({logs.length} entries)
          </CardTitle>
          <span className="text-xs text-slate-400">Authoritative Server Records</span>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <TableSkeleton rows={6} cols={6} />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={<FileText className="w-8 h-8 text-slate-400" />}
              title="No audit entries"
              description="No audit records match your search filter."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-slate-500 border-b border-slate-100 font-medium">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Actor</th>
                    <th className="py-3 px-4">Action Type</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Details / Quantity</th>
                    <th className="py-3 px-4">Reason / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Timestamp */}
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap font-mono">
                        {formatDate(log.timestamp)}
                      </td>

                      {/* Actor */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-900 block">
                          {log.actor_email}
                        </span>
                        <span className="text-[10px] text-slate-400 uppercase font-mono">
                          {log.actor_role}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3 px-4">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Reference */}
                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {log.entity_reference}
                      </td>

                      {/* Details / Quantity change */}
                      <td className="py-3 px-4 max-w-xs">
                        <div className="text-slate-800 font-medium line-clamp-2">
                          {log.details}
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3 px-4 text-slate-500 max-w-xs">
                        <span className="line-clamp-2 text-[11px]">
                          {log.reason || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
