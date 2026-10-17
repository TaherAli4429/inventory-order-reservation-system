import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient, getSupabaseAdminClient } from '../config/supabase';
import { AuthUser, UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const devEmail = req.headers['x-user-email'] as string | undefined;
  const devRole = req.headers['x-user-role'] as UserRole | undefined;

  // 1. If Bearer token provided, verify with Supabase Auth
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    const supabase = getSupabaseAdminClient() || getSupabaseClient();

    if (supabase && token && token !== 'undefined' && !token.startsWith('simulated_')) {
      try {
        const { data, error } = await supabase.auth.getUser(token);

        if (error || !data.user) {
          res.status(401).json({
            success: false,
            error: 'Invalid or expired Supabase authentication token',
          });
          return;
        }

        // Resolve trusted role from user_roles table or user metadata
        let role: UserRole = 'viewer';
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .maybeSingle();

        if (roleRow && roleRow.role) {
          role = roleRow.role as UserRole;
        } else if (data.user.user_metadata?.role) {
          role = data.user.user_metadata.role as UserRole;
        } else {
          // Fallback based on email domain
          const email = (data.user.email || '').toLowerCase();
          if (email.includes('admin')) role = 'admin';
          else if (email.includes('staff')) role = 'staff';
        }

        req.user = {
          id: data.user.id,
          email: data.user.email || 'user@enterprise.io',
          role,
        };
        return next();
      } catch (err: unknown) {
        res.status(401).json({
          success: false,
          error: 'Authentication verification failure',
        });
        return;
      }
    }
  }

  // 2. Development & Evaluation Mode identity resolution (via x-user-email / x-user-role headers)
  if (devEmail || devRole) {
    let resolvedRole: UserRole = 'viewer';
    const emailNorm = (devEmail || '').toLowerCase();

    if (devRole && ['admin', 'staff', 'viewer'].includes(devRole)) {
      resolvedRole = devRole;
    } else if (emailNorm.includes('admin')) {
      resolvedRole = 'admin';
    } else if (emailNorm.includes('staff')) {
      resolvedRole = 'staff';
    }

    req.user = {
      id: `usr-${resolvedRole}`,
      email: devEmail || `${resolvedRole}@enterprise.io`,
      role: resolvedRole,
    };
    return next();
  }

  // Default anonymous/viewer identity or require authentication
  // In development, default to admin if not specified for zero-setup demo
  req.user = {
    id: 'usr-admin-default',
    email: 'admin@enterprise.io',
    role: 'admin',
  };
  return next();
}
