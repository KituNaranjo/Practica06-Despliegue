# Práctica 03 Stack MEAN: Gestión de Empleados

Refactorización de un CRUD tradicional de gestión de personal hacia una arquitectura desacoplada, reactiva y blindada, aplicando patrones de diseño sobre el Stack MEAN (MongoDB, Express, Angular, Node.js) con TypeScript.

**Asignatura:** Patrones de Diseño de APIs — Maestría en Ingeniería de Software (UPS)

---

## Arquitectura

### Backend (`/backend`)
- **Patrón Repository:** `IEmployeeRepository` (interfaz agnóstica a Mongoose) + `EmployeeMongoRepository` (única clase que conoce Mongoose). El controlador nunca importa `mongoose`.
- **Validación con Zod:** esquemas declarativos (`employee.dto.ts`) que blindan `req.body` y `req.params` antes de llegar al controlador.
- **Response Wrapper Pattern:** toda respuesta HTTP (éxito o error) sigue el formato `{ success, data/error, message? }`.
- **Middleware global de errores:** intercepta cualquier excepción y la traduce al formato del wrapper — nunca se filtra un stack trace crudo al cliente.

### Frontend (`/frontend`)
- **Servicio reactivo (`EmployeeService`):** `BehaviorSubject` privado + `Observable<Employee[]>` público de solo lectura (`employees$`). Mutaciones inmutables (`[...current, new]`, `.map()`, `.filter()`).
- **Sin `.subscribe()` en componentes:** las suscripciones viven dentro del servicio; los componentes solo llaman métodos de acción (`create()`, `update()`, `delete()`) y consumen estado vía `async` pipe.
- **Smart vs Dumb Components:**
  - `EmployeeManagerComponent` (Smart/Orquestador) — consume `EmployeeService`, coordina el estado de edición.
  - `EmployeeTableComponent` (Dumb) — recibe `@Input() employees`, emite `@Output() editRequested` / `deleteRequested`.
  - `EmployeeFormComponent` (Dumb) — recibe `@Input() employeeToEdit`, emite `@Output() save` / `cancelEdit`.

---

## Requisitos

- Node.js v20+ (probado en v24)
- Angular CLI v16+ (probado en v22)
- MongoDB corriendo en `mongodb://127.0.0.1/usuarios_db` (o ajustar en `backend/src/config/database.ts`)
- Cliente REST (Thunder Client, Postman, Insomnia) para pruebas manuales

---

## Instalación y ejecución

### Backend
```bash
cd backend
npm install
npm run dev
```
Levanta en `http://localhost:3000`. Rutas expuestas bajo `/api/v1/empleados`.

### Frontend
```bash
cd frontend
npm install
npm start
```
Levanta en `http://localhost:4200`.

> Ambos servidores deben correr simultáneamente, cada uno en su propia terminal.

---

## Endpoints del API

| Método | Ruta                       | Descripción                          |
|--------|----------------------------|---------------------------------------|
| GET    | `/api/v1/empleados`        | Lista todos los empleados             |
| GET    | `/api/v1/empleados/:id`    | Consulta un empleado por ID           |
| POST   | `/api/v1/empleados`        | Crea un empleado (valida con Zod)     |
| PUT    | `/api/v1/empleados/:id`    | Actualiza un empleado (parcial)       |
| DELETE | `/api/v1/empleados/:id`    | Elimina un empleado                   |

Todas las respuestas siguen el formato:
```json
{ "success": true, "data": { ... }, "message": "..." }
```
o, en caso de error:
```json
{ "success": false, "error": { "message": "...", "details": {...} } }
```

---

## Los 4 Retos resueltos

1. **Desacoplamiento del Backend (Patrón Repository)** — `backend/src/repositories/`, `backend/src/domain/`
2. **Validación DTO + Response Wrapper** — `backend/src/dto/`, `backend/src/utils/api-response.ts`, `backend/src/middlewares/`
3. **Servicio Reactivo con RxJS** — `frontend/src/app/services/employee.ts`
4. **Smart vs Dumb Components** — `frontend/src/app/components/`

---

**Autor:** Christian Naranjo — Maestría en Ingeniería de Software, UPS