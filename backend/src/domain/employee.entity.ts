export interface Employee {
  id: string;
  nombre: string;
  cargo: string;
  departamento: string;
  sueldo: number;
}

// Datos que llegan para crear un empleado (sin id, lo genera la BD)
export type CreateEmployeeData = Omit<Employee, 'id'>;

// Datos que llegan para actualizar (todo opcional, actualización parcial)
export type UpdateEmployeeData = Partial<CreateEmployeeData>;