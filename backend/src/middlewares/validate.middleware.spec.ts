import { jest, describe, it, expect } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { validate } from './validate.middleware.js';
import { createEmployeeSchema } from '../dto/employee.dto.js';
import { AppError } from '../errors/app-error.js';

describe('🧪 Unit Test: Barrera perimetral Zod (validate middleware)', () => {
  const middleware = validate(createEmployeeSchema, 'body');

  it('rechaza el payload corrupto de la prueba de estrés antes del controlador', () => {
    const req = { body: { nombre: 'Al', cargo: 'Dev', departamento: 'TI', sueldo: -500 } } as Request;
    const next = jest.fn();

    middleware(req, {} as Response, next as NextFunction);

    const error = next.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(422);
  });

  it('deja pasar un payload válido', () => {
    const req = { body: { nombre: 'Andrés Mendoza', cargo: 'Software Architect', departamento: 'I+D', sueldo: 4200 } } as Request;
    const next = jest.fn();

    middleware(req, {} as Response, next as NextFunction);

    expect(next).toHaveBeenCalledWith();
  });
});
