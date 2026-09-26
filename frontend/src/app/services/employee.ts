import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Employee, CreateEmployeeDto, UpdateEmployeeDto } from '../models/employee.model';

interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
}

export interface Notification {
  type: 'success' | 'error';
  text: string;
}

const API_URL = 'http://localhost:3000/api/v1/empleados';

@Injectable({
  providedIn: 'root',
})
export class EmployeeService {
  private http = inject(HttpClient);

  private employeesSubject = new BehaviorSubject<Employee[]>([]);
  public readonly employees$: Observable<Employee[]> = this.employeesSubject.asObservable();

  private notificationSubject = new BehaviorSubject<Notification | null>(null);
  public readonly notification$: Observable<Notification | null> = this.notificationSubject.asObservable();

  private notify(type: 'success' | 'error', text: string): void {
    this.notificationSubject.next({ type, text });
    setTimeout(() => this.notificationSubject.next(null), 3500);
  }

  private extractErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse && err.error?.error?.message) {
      return err.error.error.message;
    }
    return 'Ocurrió un error inesperado. Intenta de nuevo.';
  }

  loadAll(): void {
    this.http.get<ApiSuccess<Employee[]>>(API_URL).subscribe({
      next: (res) => this.employeesSubject.next(res.data),
      error: (err) => this.notify('error', this.extractErrorMessage(err)),
    });
  }

  create(dto: CreateEmployeeDto): void {
    this.http.post<ApiSuccess<Employee>>(API_URL, dto).pipe(
      tap((res) => {
        const current = this.employeesSubject.getValue();
        this.employeesSubject.next([...current, res.data]);
      })
    ).subscribe({
      next: () => this.notify('success', 'Empleado creado exitosamente ✅'),
      error: (err) => this.notify('error', this.extractErrorMessage(err)),
    });
  }

  update(id: string, dto: UpdateEmployeeDto): void {
    this.http.put<ApiSuccess<Employee>>(`${API_URL}/${id}`, dto).pipe(
      tap((res) => {
        const current = this.employeesSubject.getValue();
        const updated = current.map((emp) => (emp.id === id ? res.data : emp));
        this.employeesSubject.next(updated);
      })
    ).subscribe({
      next: () => this.notify('success', 'Empleado actualizado exitosamente ✅'),
      error: (err) => this.notify('error', this.extractErrorMessage(err)),
    });
  }

  delete(id: string): void {
    this.http.delete<ApiSuccess<null>>(`${API_URL}/${id}`).pipe(
      tap(() => {
        const current = this.employeesSubject.getValue();
        const filtered = current.filter((emp) => emp.id !== id);
        this.employeesSubject.next(filtered);
      })
    ).subscribe({
      next: () => this.notify('success', 'Empleado eliminado exitosamente 🗑️'),
      error: (err) => this.notify('error', this.extractErrorMessage(err)),
    });
  }
}