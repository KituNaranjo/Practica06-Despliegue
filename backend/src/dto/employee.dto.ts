import { z } from 'zod';

// Esquema para crear un empleado — todos los campos obligatorios
export const createEmployeeSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  cargo: z.string().trim().min(1, 'El cargo es obligatorio'),
  departamento: z.string().trim().min(1, 'El departamento es obligatorio'),
  sueldo: z.number().positive('El sueldo debe ser un número positivo'),
});

// Esquema para actualizar — todos los campos opcionales, pero si vienen deben ser válidos
export const updateEmployeeSchema = createEmployeeSchema.partial();

// Esquema para validar el :id que llega por la URL
export const idParamSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'ID de MongoDB inválido'),
});

// Tipos inferidos automáticamente desde los esquemas (ya no los escribes a mano)
export type CreateEmployeeDto = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDto = z.infer<typeof updateEmployeeSchema>;
export type IdParamDto = z.infer<typeof idParamSchema>;