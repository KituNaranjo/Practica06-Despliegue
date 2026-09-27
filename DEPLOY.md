# Práctica 06: Despliegue en AWS EC2 con Nginx y PM2

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

### 6.1 Webhook de Discord

Discord → servidor → canal `#alertas-servidor` → ⚙️ Editar canal → Integraciones → Webhooks → Nuevo webhook → **Copiar URL del webhook**.

> La URL del webhook funciona como una contraseña: no la subas al repositorio ni la muestres en capturas.

### 6.2 Notificaciones con pm2-discord

> La guía propone `pm2-notify`, pero ese paquete es un notificador **SMTP** y no admite `discordUrl` ni `slackUrl`: la alerta nunca llega. Se usa el módulo `pm2-discord` (o `pm2-slack` con `slack_url`).

```bash
pm2 install pm2-discord
pm2 set pm2-discord:discord_url "URL_DE_TU_WEBHOOK"
pm2 set pm2-discord:process_name mi-node-app
pm2 set pm2-discord:stop true
pm2 set pm2-discord:exit true
pm2 set pm2-discord:restart true
pm2 set pm2-discord:exception true
pm2 set pm2-discord:online true
# Opcional: enviar también el log HTTP (morgan), agrupado cada 2 s
pm2 set pm2-discord:log true
pm2 set pm2-discord:buffer true
pm2 set pm2-discord:buffer_seconds 2
pm2 save
```

Al instalarlo sin URL el módulo falla y se reinicia varias veces hasta que se configura `discord_url`; es normal. Para limpiar esos errores: `pm2 flush pm2-discord`.

### 6.3 Rotación de logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Fase 7 — Dominio y HTTPS (recomendación de la guía)

### 7.1 Subdominio gratuito
En https://www.duckdns.org crea un subdominio y en **current ip** escribe la IP elástica (no la de tu PC) → **update ip**. Verifica:

```bash
nslookup TU_SUBDOMINIO.duckdns.org
```

### 7.2 Certificado de Let's Encrypt (en el servidor)
```bash
DOMINIO=TU_SUBDOMINIO.duckdns.org
sudo sed -i "s/server_name _;/server_name $DOMINIO;/" /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMINIO --redirect --agree-tos -m TU_CORREO --no-eff-email -n
sudo certbot renew --dry-run
```

### 7.3 Mantener también el acceso por IP
Certbot deja un bloque `return 404` para cualquier host distinto del dominio, así que `http://IP` deja de funcionar. Para conservar la Prueba de Red se reorganiza Nginx en tres bloques: la IP por HTTP sirve la app, el dominio por HTTP redirige a HTTPS y el dominio por HTTPS sirve la app. La parte común va en `/etc/nginx/snippets/empleados-app.conf` (el `root` y los tres `location` de `deploy/nginx-empleados.conf`).

```nginx
upstream empleados_api { server 127.0.0.1:3000; keepalive 16; }

server {                      # IP directa por HTTP
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    include snippets/empleados-app.conf;
}

server {                      # dominio por HTTP -> HTTPS
    listen 80;
    listen [::]:80;
    server_name TU_SUBDOMINIO.duckdns.org;
    return 301 https://$host$request_uri;
}

server {                      # dominio por HTTPS
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name TU_SUBDOMINIO.duckdns.org;
    ssl_certificate /etc/letsencrypt/live/TU_SUBDOMINIO.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/TU_SUBDOMINIO.duckdns.org/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    include snippets/empleados-app.conf;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx && sudo certbot renew --dry-run
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
| SSH `Connection timed out` con la regla aparentemente correcta | Algunos ISP usan una IP de salida distinta para SSH. Crea un VPC Flow Log (filtro *Rechazar*) sobre la interfaz de la instancia, reintenta y agrega como regla 22 la IP de origen que aparezca con destino al puerto 22 |
| Nombre del grupo de seguridad rechazado | AWS no permite nombres que empiecen con `sg-` |
| `http://IP` devuelve 404 después de Certbot | Ver 7.3 |
