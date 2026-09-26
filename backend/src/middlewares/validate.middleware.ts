import type { Request, Response, NextFunction } from 'express';
import type { ZodType } from 'zod';
import { AppError } from '../errors/app-error.js';

type ValidationTarget = 'body' | 'params';

export function validate(schema: ZodType, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      next(new AppError('Error de validación', 422, result.error.flatten()));
      return;
    }

    req[target] = result.data;
    next();
  };
}