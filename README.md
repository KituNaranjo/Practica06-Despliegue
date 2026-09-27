# practica 06 - Despliegue
# Gestión de Empleados Stack MEAN en Producción (AWS · Nginx · PM2)

Aplicación CRUD de gestión de personal construida sobre el Stack MEAN (MongoDB, Express, Angular, Node.js) con TypeScript, refactorizada con patrones de diseño, evaluada con pruebas unitarias y de estrés, y desplegada en producción sobre AWS EC2.

**Asignatura:** Patrones de Diseño de APIs — Maestría en Ingeniería de Software (UPS)
**Docente:** Ing. Patsy Prieto, MSc.

![Node](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![Angular](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white)
![AWS](https://img.shields.io/badge/AWS-EC2-FF9900?logo=amazonaws&logoColor=white)
![Nginx](https://img.shields.io/badge/Nginx-1.24-009639?logo=nginx&logoColor=white)
![PM2](https://img.shields.io/badge/PM2-cluster-2B037A?logo=pm2&logoColor=white)
![HTTPS](https://img.shields.io/badge/HTTPS-Let's%20Encrypt-003A70?logo=letsencrypt&logoColor=white)

## 🌐 En producción

| Recurso | URL |
|---|---|
| Aplicación (HTTPS) | https://gestionempleadoscn.duckdns.org |
| API REST | https://gestionempleadoscn.duckdns.org/api/v1/empleados |
| Acceso directo por IP (HTTP) | http://18.220.70.44 |

---

## 📚 Evolución del proyecto

| Práctica | Tema | Documentación |
|---|---|---|
| 03 | Refactorización con patrones de diseño (Repository, DTO + Zod, Response Wrapper, RxJS, Smart/Dumb) | Este README |
| 05 | Atributos de calidad ISO/IEC 25010: pruebas unitarias (Jest) y de estrés (Artillery) | [`ANALISIS-PRUEBAS.md`](ANALISIS-PRUEBAS.md) |
| 06 | Despliegue en producción con AWS EC2, Nginx, PM2, CI/CD y alertas | [`DEPLOY.md`](DEPLOY.md) |

---

## 🏗️ Arquitectura de producción

```mermaid
flowchart LR
    U[Usuario<br/>Navegador] -->|:80 / :443| N

    subgraph EC2 [AWS EC2 · Ubuntu 24.04 · t3.micro · IP elástica]
        N[Nginx<br/>Angular estático<br/>TLS Let's Encrypt] -->|/api → 127.0.0.1:3000| P
        subgraph P [PM2 · modo clúster]
            A0[mi-node-app #0]
            A1[mi-node-app #1]
        end
    end

    P -->|TLS| M[(MongoDB Atlas)]
    P -.->|eventos| D[Discord<br/>#alertas-servidor]

    DEV[PC del desarrollador] -->|git push| GH[GitHub]
    DEV -->|pm2 deploy · SSH| EC2
    GH -->|git pull · deploy key| EC2
```

- **Nginx** recibe todo el tráfico público, sirve el build de Angular directamente desde disco y reenvía solo `/api/` al backend.
- **PM2** ejecuta el backend en modo clúster (una réplica por vCPU), lo recupera ante fallos y lo relanza al reiniciar el servidor (`pm2 startup` + systemd).
- **El puerto 3000 nunca se expone:** el grupo de seguridad solo abre 80/443 al público y 22 a las IP del administrador.
- **MongoDB Atlas** está fuera de la instancia y solo acepta conexiones desde la IP elástica.
- **Discord** recibe en tiempo real los eventos de PM2 (stop, exit, restart, online, reload) y el log HTTP.

---

## 🧩 Patrones de diseño aplicados

### Backend (`/backend`)
- **Patrón Repository:** `IEmployeeRepository` (interfaz agnóstica a Mongoose) + `EmployeeMongoRepository` (única clase que conoce Mongoose). El controlador nunca importa `mongoose`.
- **Validación con Zod:** esquemas declarativos (`employee.dto.ts`) que blindan `req.body` y `req.params` antes de llegar al controlador.
- **Response Wrapper Pattern:** toda respuesta HTTP (éxito o error) sigue el formato `{ success, data/error, message? }`.
- **Middleware global de errores:** intercepta cualquier excepción y la traduce al formato del wrapper; nunca se filtra un stack trace al cliente.
- **Configuración por entorno:** la cadena de conexión y el puerto se leen de variables de entorno; ninguna credencial vive en el código.

### Frontend (`/frontend`)
- **Servicio reactivo (`EmployeeService`):** `BehaviorSubject` privado + `Observable<Employee[]>` público de solo lectura (`employees$`), con mutaciones inmutables (`[...current, new]`, `.map()`, `.filter()`).
- **Sin `.subscribe()` en componentes:** las suscripciones viven en el servicio; los componentes llaman acciones y consumen estado con `async` pipe.
- **Smart vs Dumb Components:**
  - `EmployeeManagerComponent` (Smart) — orquesta el servicio y el estado de edición.
  - `EmployeeTableComponent` (Dumb) — `@Input() employees`, `@Output() editRequested / deleteRequested`.
  - `EmployeeFormComponent` (Dumb) — `@Input() employeeToEdit`, `@Output() save / cancelEdit`.
- **URL relativa de la API** (`/api/v1/empleados`): en producción la enruta Nginx y en desarrollo `proxy.conf.json`.

---

## 💻 Ejecución local

### Requisitos
- Node.js **24.15+** (Angular 22 lo exige)
- Una base MongoDB: local o un cluster de MongoDB Atlas (con tu IP en la lista de acceso)

### 1. Backend
```bash
cd backend
cp .env.example .env      # completar MONGO_URI
npm install
npm run dev               # http://localhost:3000
```

`backend/.env`:
```env
PORT=3000
MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.xxxxx.mongodb.net/usuarios_db
```
> `.env` está en `.gitignore`: nunca se sube al repositorio.

### 2. Frontend
```bash
cd frontend
npm install
npm start                 # http://localhost:4200
```
`ng serve` usa `proxy.conf.json` para reenviar `/api` a `localhost:3000`, así que ambos proyectos deben correr a la vez en terminales separadas.

### 3. Pruebas
```bash
cd backend && npm test              # Jest: 14 pruebas
cd frontend && npx ng test --watch=false   # 6 pruebas
```

### 4. Build de producción
```bash
cd backend && npm run build && npm start   # compila src/ → dist/ y ejecuta node dist/index.js
cd frontend && npm run build               # genera dist/frontend/browser
```

---

## 🚀 Despliegue

El procedimiento completo, paso a paso, está en [`DEPLOY.md`](DEPLOY.md). Resumen del flujo de CI/CD una vez configurado el servidor:

```bash
# Desde la PC del desarrollador (Git Bash; no funciona en PowerShell)
git push origin main
pm2 deploy ecosystem.config.cjs production
```

PM2 se conecta por SSH a la EC2, descarga el último commit, ejecuta `npm ci` + `build` en backend y frontend, y recarga las réplicas **sin tiempo de inactividad** (`pm2 startOrReload`).

| Archivo | Propósito |
|---|---|
| [`ecosystem.config.cjs`](ecosystem.config.cjs) | Procesos PM2 (clúster, logs, `--env-file`) y destino del despliegue |
| [`deploy/nginx-empleados.conf`](deploy/nginx-empleados.conf) | Proxy inverso de `/api` y servicio del build de Angular |
| `backend/tsconfig.build.json` | Compilación de producción de TypeScript |
| `backend/.env.example` | Plantilla de variables de entorno |

### Seguridad del despliegue
- Secretos en `/var/www/empleados-app/shared/.env` del servidor (permisos `600`), inyectados por PM2 con `--env-file`; nunca en el repositorio.
- Deploy key de GitHub de **solo lectura**.
- Grupo de seguridad con 80/443 públicos, 22 restringido y 3000 cerrado; UFW como segunda capa.
- HTTPS con certificado de Let's Encrypt y renovación automática (Certbot).
- `pm2-logrotate` (10 MB por archivo, 7 archivos) para evitar que los logs llenen el disco.

### Correcciones aplicadas a la guía de la práctica
| Guía | Problema | Solución |
|---|---|---|
| `curl https://nodesource.com` | No es un script de instalación | `https://deb.nodesource.com/setup_24.x` |
| `sudo apt install npm` | Conflicto con el npm de NodeSource | Se omite |
| Credenciales en `env` del ecosystem | Quedarían publicadas en GitHub | `--env-file` con `shared/.env` |
| `pm2-notify` con `discordUrl` | Es un notificador por SMTP | `pm2-discord` con `discord_url` |

---

## 🔌 Endpoints del API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/empleados` | Lista todos los empleados |
| GET | `/api/v1/empleados/:id` | Consulta un empleado por ID |
| POST | `/api/v1/empleados` | Crea un empleado (valida con Zod) |
| PUT | `/api/v1/empleados/:id` | Actualiza un empleado (parcial) |
| DELETE | `/api/v1/empleados/:id` | Elimina un empleado |

Formato de respuesta exitosa:
```json
{ "success": true, "data": { ... }, "message": "..." }
```
Formato de error:
```json
{ "success": false, "error": { "message": "...", "details": { ... } } }
```

---

## 📁 Estructura del repositorio

```
├── backend/
│   ├── src/
│   │   ├── config/          # conexión a MongoDB (por variable de entorno)
│   │   ├── controllers/     # capa HTTP, sin Mongoose
│   │   ├── domain/          # entidad Employee
│   │   ├── dto/             # esquemas Zod
│   │   ├── errors/          # AppError
│   │   ├── middlewares/     # validación y manejo global de errores
│   │   ├── models/          # esquema de Mongoose
│   │   ├── repositories/    # IEmployeeRepository + implementación Mongo
│   │   ├── routes/
│   │   └── utils/           # Response Wrapper
│   ├── .env.example
│   ├── stress-test.yml      # escenario de Artillery (Práctica 05)
│   └── tsconfig.build.json
├── frontend/
│   ├── src/app/
│   │   ├── components/      # employee-manager (Smart), employee-table / employee-form (Dumb)
│   │   ├── models/
│   │   └── services/        # EmployeeService reactivo
│   └── proxy.conf.json
├── deploy/
│   └── nginx-empleados.conf
├── ecosystem.config.cjs
├── ANALISIS-PRUEBAS.md      # Práctica 05
├── DEPLOY.md                # Práctica 06
└── README.md
```

---

**Autor:** Christian Naranjo — Maestría en Ingeniería de Software, UPS
