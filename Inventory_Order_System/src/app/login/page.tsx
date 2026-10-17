'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AlertBanner } from '@/components/ui/NotificationToast';
import { Layers, ShieldCheck, UserCheck, Eye, LogIn, Lock, Mail } from 'lucide-react';
import { UserRole } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, isSupabaseActive } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Please provide an email address');
      return;
    }

    setIsSubmitting(true);
    const result = await signIn(email.trim(), password);
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Authentication failed. Please verify credentials.');
      return;
    }

    router.push('/');
  };

  const handleQuickLogin = async (role: UserRole) => {
    setError(null);
    const demoEmails: Record<UserRole, string> = {
      admin: 'admin@enterprise.io',
      staff: 'staff@enterprise.io',
      viewer: 'viewer@enterprise.io',
    };
    setEmail(demoEmails[role]);
    setPassword('DemoPass2026!');
    setIsSubmitting(true);
    const result = await signIn(demoEmails[role], 'DemoPass2026!');
    setIsSubmitting(false);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.error || 'Demo sign-in failed');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Brand Icon */}
        <div className="mx-auto w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-600/20 mb-3">
          <Layers className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Sign In to Inventory System
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Real-Time Inventory & Order Reservation System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-sm border border-slate-200/80 rounded-2xl sm:px-10">
          {error && (
            <AlertBanner
              type="error"
              message={error}
              onClose={() => setError(null)}
              className="mb-5"
            />
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email Address"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. admin@enterprise.io"
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              leftIcon={<Lock className="w-4 h-4" />}
              helperText={
                isSupabaseActive
                  ? 'Authenticated via Supabase Auth'
                  : 'Enter any password for evaluation mode'
              }
            />

            <Button
              type="submit"
              className="w-full mt-2"
              isLoading={isSubmitting}
              leftIcon={<LogIn className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Quick Demo Sign-In helper */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-700 text-center mb-3">
              One-Click Role Sign-In (Evaluation Mode)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 transition-colors group text-left"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Admin</span>
                <span className="text-[10px] text-slate-400">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('staff')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:border-sky-300 hover:bg-sky-50/50 transition-colors group text-left"
              >
                <UserCheck className="w-4 h-4 text-sky-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Staff</span>
                <span className="text-[10px] text-slate-400">Orders & Stock</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer')}
                className="flex flex-col items-center justify-center p-2.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition-colors group text-left"
              >
                <Eye className="w-4 h-4 text-slate-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-semibold text-slate-800">Viewer</span>
                <span className="text-[10px] text-slate-400">Read-Only</span>
              </button>
            </div>
          </div>

          {/* Assignment Note */}
          <div className="mt-6 bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-700">Notice: </span>
            In accordance with the assignment specifications, public user registration is disabled. Users and roles are provisioned by system administrators.
          </div>
        </div>
      </div>
    </div>
  );
}
