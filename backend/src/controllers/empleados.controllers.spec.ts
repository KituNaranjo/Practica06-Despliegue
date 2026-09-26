import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import type { Request, Response, NextFunction } from 'express';
import { EmpleadosController } from './empleados.controllers.js';
import type { IEmployeeRepository } from '../repositories/employee.repository.interface.js';
import type { Employee } from '../domain/employee.entity.js';
import { AppError } from '../errors/app-error.js';
// ⚠️ Ningún import de mongoose ni de EmployeeMongoRepository.

describe('🧪 Unit Test: EmpleadosController (Mantenibilidad & Testabilidad)', () => {
  let controller: EmpleadosController;
  let mockRepository: jest.Mocked<IEmployeeRepository>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let nextMock: jest.Mock;

  const fakeEmployee: Employee = {
    id: '66f1a2b3c4d5e6f7a8b9c0d1',
    nombre: 'Andrés Mendoza',
    cargo: 'Arquitecto',
    departamento: 'TI',
    sueldo: 4000,
  };

  beforeEach(() => {
    // 1. Mock 100% aislado de la interfaz (cero dependencia de Mongoose)
    mockRepository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IEmployeeRepository>;

    controller = new EmpleadosController(mockRepository);

    // 2. Mock del ciclo de vida de Express
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    mockResponse = { status: statusMock } as Partial<Response>;
    nextMock = jest.fn();
  });

  it('Debería retornar 200 y la lista de empleados de la abstracción', async () => {
    const fakeEmployees = [fakeEmployee];
    mockRepository.findAll.mockResolvedValue(fakeEmployees);
    mockRequest = {};

    await controller.getEmpleados(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    // Response Wrapper Pattern: { success, data }
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: fakeEmployees });
    expect(mockRepository.findAll).toHaveBeenCalledTimes(1);
  });

  it('Debería retornar 201 al crear un empleado', async () => {
    const { id: _id, ...nuevo } = fakeEmployee;
    mockRepository.create.mockResolvedValue(fakeEmployee);
    mockRequest = { body: nuevo };

    await controller.addEmpleado(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(201);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: fakeEmployee, message: 'Empleado guardado' });
    expect(mockRepository.create).toHaveBeenCalledWith(nuevo);
  });

  it('Debería delegar un AppError 404 al middleware cuando el empleado no existe', async () => {
    mockRepository.findById.mockResolvedValue(null);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.getEmpleadoById(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).not.toHaveBeenCalled();
    const error = nextMock.mock.calls[0]?.[0] as AppError;
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
  });

  it('Debería propagar al middleware los fallos de la capa de datos', async () => {
    const fallo = new Error('Conexión perdida');
    mockRepository.findAll.mockRejectedValue(fallo);

    await controller.getEmpleados({} as Request, mockResponse as Response, nextMock as NextFunction);

    expect(nextMock).toHaveBeenCalledWith(fallo);
    expect(statusMock).not.toHaveBeenCalled();
  });
  it('Debería retornar 200 y el empleado cuando existe', async () => {
    mockRepository.findById.mockResolvedValue(fakeEmployee);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.getEmpleadoById(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: fakeEmployee });
  });

  it('Debería propagar el error si falla la creación', async () => {
    const fallo = new Error('Fallo al guardar');
    mockRepository.create.mockRejectedValue(fallo);

    await controller.addEmpleado({ body: {} } as Request, mockResponse as Response, nextMock as NextFunction);

    expect(nextMock).toHaveBeenCalledWith(fallo);
  });

  it('Debería retornar 200 al actualizar un empleado existente', async () => {
    const actualizado = { ...fakeEmployee, sueldo: 5000 };
    mockRepository.update.mockResolvedValue(actualizado);
    mockRequest = { params: { id: fakeEmployee.id }, body: { sueldo: 5000 } };

    await controller.updateEmpleado(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: actualizado, message: 'Empleado actualizado' });
    expect(mockRepository.update).toHaveBeenCalledWith(fakeEmployee.id, { sueldo: 5000 });
  });

  it('Debería delegar un 404 al actualizar un empleado inexistente', async () => {
    mockRepository.update.mockResolvedValue(null);
    mockRequest = { params: { id: fakeEmployee.id }, body: { sueldo: 5000 } };

    await controller.updateEmpleado(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect((nextMock.mock.calls[0]?.[0] as AppError).statusCode).toBe(404);
  });

  it('Debería retornar 200 al eliminar un empleado existente', async () => {
    mockRepository.delete.mockResolvedValue(true);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.deleteEmpleado(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ success: true, data: null, message: 'Empleado eliminado' });
  });

  it('Debería delegar un 404 al eliminar un empleado inexistente', async () => {
    mockRepository.delete.mockResolvedValue(false);
    mockRequest = { params: { id: fakeEmployee.id } };

    await controller.deleteEmpleado(mockRequest as Request, mockResponse as Response, nextMock as NextFunction);

    expect((nextMock.mock.calls[0]?.[0] as AppError).statusCode).toBe(404);
  });
});
