import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/app-error.js';
import { sendError } from '../utils/api-response.js';

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    sendError(res, err.statusCode, err.message, err.details);
    return;
  }
  
  console.error('Error no controlado:', err);
  sendError(res, 500, 'Error interno del servidor');
}