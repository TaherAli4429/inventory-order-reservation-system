import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Forbidden: Action requires role [${allowedRoles.join(' or ')}]. Your current role is "${req.user.role}".`,
      });
      return;
    }

    next();
  };
}
