import EmployeeModel from '../models/empleado.js';
import type { IEmployeeRepository } from './employee.repository.interface.js';
import type { Employee, CreateEmployeeData, UpdateEmployeeData } from '../domain/employee.entity.js';

function toDomain(doc: any): Employee {
  return {
    id: doc._id.toString(),
    nombre: doc.nombre,
    cargo: doc.cargo,
    departamento: doc.departamento,
    sueldo: doc.sueldo,
  };
}

export class EmployeeMongoRepository implements IEmployeeRepository {
  async findAll(): Promise<Employee[]> {
    const docs = await EmployeeModel.find();
    return docs.map(toDomain);
  }

  async findById(id: string): Promise<Employee | null> {
    const doc = await EmployeeModel.findById(id);
    return doc ? toDomain(doc) : null;
  }

  async create(data: CreateEmployeeData): Promise<Employee> {
    const doc = new EmployeeModel(data);
    await doc.save();
    return toDomain(doc);
  }

  async update(id: string, data: UpdateEmployeeData): Promise<Employee | null> {
    const doc = await EmployeeModel.findByIdAndUpdate(id, data, { returnDocument: 'after' });
    return doc ? toDomain(doc) : null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await EmployeeModel.findByIdAndDelete(id);
    return result !== null;
  }
}