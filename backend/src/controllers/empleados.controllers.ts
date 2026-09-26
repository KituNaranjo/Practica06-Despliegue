import type { Request, Response, NextFunction } from 'express';
import type { IEmployeeRepository } from '../repositories/employee.repository.interface.js';
import { sendSuccess } from '../utils/api-response.js';
import { AppError } from '../errors/app-error.js';

// El controlador depende SOLO de la abstracción (IEmployeeRepository).
// La implementación concreta (Mongo) se inyecta desde fuera: Inversión de Dependencias.
export class EmpleadosController {
  constructor(private readonly employeeRepository: IEmployeeRepository) {}

  getEmpleados = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const empleados = await this.employeeRepository.findAll();
      sendSuccess(res, empleados);
    } catch (err) {
      next(err);
    }
  };

  getEmpleadoById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const empleado = await this.employeeRepository.findById(id);
      if (!empleado) {
        throw new AppError('Empleado no encontrado', 404);
      }
      sendSuccess(res, empleado);
    } catch (err) {
      next(err);
    }
  };

  addEmpleado = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const empleado = await this.employeeRepository.create(req.body);
      sendSuccess(res, empleado, 201, 'Empleado guardado');
    } catch (err) {
      next(err);
    }
  };

  updateEmpleado = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const empleado = await this.employeeRepository.update(id, req.body);
      if (!empleado) {
        throw new AppError('Empleado no encontrado', 404);
      }
      sendSuccess(res, empleado, 200, 'Empleado actualizado');
    } catch (err) {
      next(err);
    }
  };

  deleteEmpleado = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params as { id: string };
      const eliminado = await this.employeeRepository.delete(id);
      if (!eliminado) {
        throw new AppError('Empleado no encontrado', 404);
      }
      sendSuccess(res, null, 200, 'Empleado eliminado');
    } catch (err) {
      next(err);
    }
  };
}
