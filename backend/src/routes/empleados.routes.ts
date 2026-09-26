import { Router } from 'express';
import type { EmpleadosController } from '../controllers/empleados.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { createEmployeeSchema, updateEmployeeSchema, idParamSchema } from '../dto/employee.dto.js';

// El router recibe el controlador ya construido (no sabe qué BD hay detrás)
export function createEmpleadosRouter(controller: EmpleadosController): Router {
  const router = Router();

  router.get('/empleados', controller.getEmpleados);
  router.get('/empleados/:id', validate(idParamSchema, 'params'), controller.getEmpleadoById);
  router.post('/empleados', validate(createEmployeeSchema, 'body'), controller.addEmpleado);
  router.put('/empleados/:id', validate(idParamSchema, 'params'), validate(updateEmployeeSchema, 'body'), controller.updateEmpleado);
  router.delete('/empleados/:id', validate(idParamSchema, 'params'), controller.deleteEmpleado);

  return router;
}
