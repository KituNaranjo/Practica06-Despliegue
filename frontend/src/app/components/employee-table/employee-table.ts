import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Employee } from '../../models/employee.model';

@Component({
  selector: 'app-employee-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './employee-table.html',
  styleUrl: './employee-table.css',
})
export class EmployeeTableComponent {
  @Input() employees: Employee[] = [];
  @Output() editRequested = new EventEmitter<Employee>();
  @Output() deleteRequested = new EventEmitter<string>();

  onEdit(emp: Employee): void {
    this.editRequested.emit(emp);
  }

  onDelete(id: string): void {
    this.deleteRequested.emit(id);
  }
}