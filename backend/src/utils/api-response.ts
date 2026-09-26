import type { Response } from 'express';

interface SuccessResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ErrorResponse {
  success: false;
  error: {
    message: string;
    details?: unknown;
  };
}

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
  message?: string
): void {
  const body: SuccessResponse<T> = message !== undefined
    ? { success: true, data, message }
    : { success: true, data };
  res.status(statusCode).json(body);
}

export function sendError(
  res: Response,
  statusCode: number,
  message: string,
  details?: unknown
): void {
  const body: ErrorResponse = { success: false, error: { message, details } };
  res.status(statusCode).json(body);
}