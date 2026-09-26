# Práctica 06 — Despliegue en AWS EC2 con Nginx y PM2

Adaptación de la guía PDA06 al proyecto MEAN de Gestión de Empleados (backend Express + TypeScript, frontend Angular 22, MongoDB Atlas).

Reemplaza en todo el documento: `TU_IP_ELASTICA`, `tu-llave-aws.pem` y la URL del webhook.

---

## 0. Cambios hechos al proyecto para producción

| Archivo | Cambio | Motivo |
|---|---|---|
| `backend/src/config/database.ts` | `MONGO_URI` se lee de `process.env` | La credencial de Atlas no debe estar en el código |
| `backend/src/index.ts` | `PORT` desde `process.env` | Configurable por entorno |
| `backend/tsconfig.build.json` | Nuevo: compila `src` → `dist` (excluye `*.spec.ts` y `app.ts` legado) | En producción se ejecuta JS compilado, no `tsx` |
| `backend/package.json` | Scripts `build` y `start`; `dev` usa `--env-file=.env` | |
| `backend/.env.example` | Plantilla de variables | |
| `frontend/src/app/services/employee.ts` | `API_URL = '/api/v1/empleados'` (relativa) | Nginx enruta `/api` al backend |
| `frontend/proxy.conf.json` + `angular.json` | Proxy de `ng serve` a `localhost:3000` | En desarrollo sigue funcionando igual |
| `ecosystem.config.cjs` | PM2 cluster + deploy | `.cjs` porque el backend es `"type": "module"` |
| `deploy/nginx-empleados.conf` | Sirve Angular y proxy de `/api` | |
| `.gitignore` | `dist/`, `coverage/`, `.angular/`, `.env`, `*.pem` | |

Verificado localmente: build del backend OK, 14/14 tests backend, 6/6 tests frontend, build de Angular OK, PM2 en modo cluster con ESM OK.

Desarrollo local ahora requiere `backend/.env` (copiar de `.env.example`).

---

## Fase 1 — AWS

### 1.1 Security Group (reglas de entrada)

| Tipo | Puerto | Origen |
|---|---|---|
| HTTP | 80 | 0.0.0.0/0 |
| HTTPS | 443 | 0.0.0.0/0 |
| SSH | 22 | Mi IP |

El puerto 3000 **no** se abre.

### 1.2 IP elástica

EC2 → Red y seguridad → IP elásticas → Asignar → Asociar a la instancia.

### 1.3 MongoDB Atlas (paso extra, no está en la guía)

Atlas → **Network Access** → Add IP Address → `TU_IP_ELASTICA/32`.
Sin esto el backend arranca pero no conecta a la base.

---

## Fase 2 — Servidor (conectado por SSH)

```bash
ssh -i "tu-llave-aws.pem" ubuntu@TU_IP_ELASTICA
```

### 2.1 Swap de 2 GB (necesario en t2/t3.micro para compilar Angular)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 2.2 Node.js 24, Git, build-essential, Nginx

> La URL de NodeSource del PDF (`https://nodesource.com`) no es un script de instalación. Angular 22 exige Node ≥ 22.22.3 o ≥ 24.15, por eso se usa Node 24. **No** instales el paquete `npm` de Ubuntu: NodeSource ya trae npm y el de Ubuntu entra en conflicto.

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx
node -v && npm -v
sudo npm install -g pm2
```

### 2.3 Firewall local (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

> Permite OpenSSH **antes** de habilitar UFW o pierdes la conexión.

---

## Fase 3 — GitHub ↔ EC2

### 3.1 Deploy key

```bash
ssh-keygen -t ed25519 -C "servidor-produccion" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

GitHub → repo `Practica03-DesarrolloAPI` → Settings → Deploy keys → Add deploy key (sin permiso de escritura).

```bash
ssh -T git@github.com
```

Debe responder `Hi KituNaranjo/Practica03-DesarrolloAPI! You've successfully authenticated...`

### 3.2 Carpeta de despliegue, logs y secretos

```bash
sudo mkdir -p /var/www/empleados-app/shared/logs
sudo chown -R ubuntu:ubuntu /var/www/empleados-app
nano /var/www/empleados-app/shared/.env
```

Contenido de `.env`:

```
PORT=3000
MONGO_URI=mongodb+srv://USUARIO:PASSWORD@cluster0.e3yfw.mongodb.net/usuarios_db
```

```bash
chmod 600 /var/www/empleados-app/shared/.env
```

---

## Fase 4 — Nginx

```bash
sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.bak
sudo nano /etc/nginx/sites-available/default
```

Pega el contenido de `deploy/nginx-empleados.conf`, luego:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

(Hasta que corra el primer deploy verás 500/404 porque aún no existe el build de Angular. Es normal.)

---

## Fase 5 — CI/CD con PM2 Deploy (desde tu PC)

> En Windows `pm2 deploy` necesita **Git Bash** o **WSL**; no funciona en PowerShell/CMD.

### 5.1 Preparar el repo (local)

Edita `ecosystem.config.cjs`: `host` y `key` con tu IP y la ruta de tu `.pem`.

```bash
npm install -g pm2
git add .
git commit -m "feat: configuracion de despliegue PM2 + Nginx (Practica 06)"
git push origin main
```

### 5.2 Primer despliegue

```bash
pm2 deploy ecosystem.config.cjs production setup
pm2 deploy ecosystem.config.cjs production
```

El `post-deploy` compila backend y frontend en el servidor y levanta `mi-node-app` en modo cluster.

### 5.3 Arranque automático tras reinicio de la EC2 (en el servidor)

```bash
pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Copia y ejecuta la línea `sudo env PATH=...` que imprime, luego:

```bash
pm2 save
```

---

## Fase 6 — Monitoreo y alertas (en el servidor)

### 6.1 Webhook

Slack → Incoming WebHooks → canal `#alertas-servidor` → copiar URL (o Discord → Canal → Integraciones → Webhooks).

### 6.2 Notificaciones (según la guía)

```bash
sudo npm install pm2-notify -g
pm2 set pm2-notify:slackUrl "URL_DE_TU_WEBHOOK"
# pm2 set pm2-notify:discordUrl "URL_DE_TU_WEBHOOK"
pm2 set pm2-notify:events "error,exit"
pm2 set pm2-notify:apps "mi-node-app"
pm2 save --force
pm2 logs pm2-notify
```

> Si con esto no llega la alerta al hacer `pm2 stop`, usa el módulo PM2 dedicado (`pm2 install pm2-slack` o `pm2 install pm2-discord`) y configura su URL según su README. Documenta en el informe cuál funcionó.

### 6.3 Rotación de logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Pruebas de verificación

**1. Red** — en el navegador: `http://TU_IP_ELASTICA` → carga Angular y lista empleados. Además:

```bash
curl -s http://TU_IP_ELASTICA/api/v1/empleados
curl -s -m 5 http://TU_IP_ELASTICA:3000/api/v1/empleados || echo "Puerto 3000 cerrado: OK"
```

**2. Resiliencia** (en el servidor):

```bash
pm2 list
pm2 stop mi-node-app      # debe llegar la alerta al canal
pm2 start mi-node-app
```

**3. CI/CD** — cambia algo visible (p. ej. el título en `frontend/src/app/app.html`), luego desde tu PC:

```bash
git commit -am "chore: cambio visual para prueba CI/CD"
git push origin main
pm2 deploy ecosystem.config.cjs production
```

Refresca el navegador sin tocar la consola de AWS.

**Extra (opcional)** — reutilizar `backend/stress-test.yml` de la Práctica 05 contra producción: cambia `target` a `http://TU_IP_ELASTICA` y compara p99 con 1 réplica vs `instances: "max"`.

---

## Troubleshooting rápido

| Síntoma | Revisar |
|---|---|
| 502 Bad Gateway | `pm2 list`, `pm2 logs mi-node-app --lines 50` |
| App en loop de reinicios | `cat /var/www/empleados-app/shared/.env`; IP en Atlas Network Access |
| `JavaScript heap out of memory` en el build | Swap (2.1): `free -h` |
| 403/404 en `/` | `ls /var/www/empleados-app/current/frontend/dist/frontend/browser` |
| `Permission denied (publickey)` en deploy | Ruta `key` en `ecosystem.config.cjs`; deploy key en GitHub |
| Error de Node al compilar Angular | `node -v` ≥ 24.15 |
