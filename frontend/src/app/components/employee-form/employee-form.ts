import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Employee, CreateEmployeeDto } from '../../models/employee.model';

@Component({
  selector: 'app-employee-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './employee-form.html',
  styleUrl: './employee-form.css',
})
export class EmployeeFormComponent implements OnChanges {
  @Input() employeeToEdit: Employee | null = null;
  @Output() save = new EventEmitter<CreateEmployeeDto>();
  @Output() cancelEdit = new EventEmitter<void>();

  private fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    cargo: ['', Validators.required],
    departamento: ['', Validators.required],
    sueldo: [0, [Validators.required, Validators.min(1)]],
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['employeeToEdit']) {
      if (this.employeeToEdit) {
        this.form.setValue({
          nombre: this.employeeToEdit.nombre,
          cargo: this.employeeToEdit.cargo,
          departamento: this.employeeToEdit.departamento,
          sueldo: this.employeeToEdit.sueldo,
        });
      } else {
        this.form.reset({ nombre: '', cargo: '', departamento: '', sueldo: 0 });
      }
    }
  }

  get sueldoInvalido(): boolean {
    const control = this.form.controls.sueldo;
    return control.invalid && (control.touched || control.dirty);
  }

  get nombreInvalido(): boolean {
    const control = this.form.controls.nombre;
    return control.invalid && (control.touched || control.dirty);
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.save.emit(this.form.getRawValue());
    this.form.reset({ nombre: '', cargo: '', departamento: '', sueldo: 0 });
  }

  onCancel(): void {
    this.cancelEdit.emit();
    this.form.reset({ nombre: '', cargo: '', departamento: '', sueldo: 0 });
  }
}