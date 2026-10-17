import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export interface AppError extends Error {
  statusCode?: number;
  details?: unknown;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err.statusCode || (err.message.includes('INSUFFICIENT_STOCK') ? 409 : 500);
  const message = err.message || 'Internal Server Error';

  if (!env.isTest) {
    console.error(`[Error] ${req.method} ${req.url} -> ${statusCode}:`, err.message);
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(err.details ? { details: err.details } : {}),
    ...(env.isProduction ? {} : { stack: err.stack }),
  });
}
