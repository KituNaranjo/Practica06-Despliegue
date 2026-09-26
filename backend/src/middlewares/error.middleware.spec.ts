import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { errorMiddleware } from './error.middleware.js';
import { AppError } from '../errors/app-error.js';

describe('🧪 Unit Test: Middleware global de errores (Response Wrapper)', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let res: Partial<Response>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = { status: statusMock } as Partial<Response>;
  });

  it('traduce un AppError a su código y formato estándar', () => {
    errorMiddleware(new AppError('Empleado no encontrado', 404), {} as Request, res as Response, jest.fn() as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Empleado no encontrado', details: undefined },
    });
  });

  it('oculta errores no controlados detrás de un 500 genérico (sin stack trace)', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    errorMiddleware(new Error('detalle interno'), {} as Request, res as Response, jest.fn() as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: { message: 'Error interno del servidor', details: undefined },
    });
    consoleSpy.mockRestore();
  });
});
