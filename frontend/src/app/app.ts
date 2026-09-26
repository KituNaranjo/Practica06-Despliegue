import { Component } from '@angular/core';
import { EmployeeManagerComponent } from './components/employee-manager/employee-manager';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [EmployeeManagerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}