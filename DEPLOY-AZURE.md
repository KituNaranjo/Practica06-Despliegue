# Práctica 06 (Azure): Despliegue en Azure VM con Nginx y PM2

Réplica del despliegue de [`DEPLOY.md`](./DEPLOY.md) (AWS EC2) sobre una máquina virtual de **Microsoft Azure**, usando el mismo repositorio, el mismo cluster de MongoDB Atlas y el mismo flujo de CI/CD con PM2 Deploy.

| Recurso | Valor |
|---|---|
| Suscripción | Azure for Students |
| Grupo de recursos | `rg-empleados-app` |
| VM | `empleados-app-azure` |
| Región | Chile Central |
| Imagen | Ubuntu Server 24.04 LTS (x64) |
| Tamaño | Standard B2ats v2 (2 vCPU, 1 GiB RAM) |
| IP pública | `57.156.68.131` (estática) |
| Dominio | `https://empleados-azure-cn.duckdns.org` |
| Usuario SSH | `azureuser` |

---

## 0. Equivalencias AWS ↔ Azure

| Concepto | AWS (`DEPLOY.md`) | Azure (este documento) |
|---|---|---|
| Servidor | EC2 instance | Virtual Machine |
| Firewall de red | Security Group | Network Security Group (NSG) |
| IP fija | Elastic IP | IP pública con asignación estática |
| Usuario por defecto | `ubuntu` | `azureuser` |
| Clave SSH | `llave-empleados.pem` | `empleados-app-azure_key.pem` |
| Entorno PM2 Deploy | `production` | `azure` |

Cambio en el repositorio: `ecosystem.config.cjs` ahora tiene dos entornos de despliegue (`production` para EC2 y `azure` para la VM) que comparten el mismo comando `POST_DEPLOY`. El bloque `apps` no cambia porque la ruta `/var/www/empleados-app` es la misma en ambos servidores.

---

## Fase 1 — Azure

### 1.1 Crear la VM

Portal de Azure → **Máquinas virtuales → Crear**:

- **Imagen:** Ubuntu Server 24.04 LTS
- **Tamaño:** Standard B2ats v2
- **Autenticación:** clave pública SSH, usuario `azureuser`; descargar la `.pem` al crear (solo se ofrece una vez)
- **Puertos de entrada públicos:** HTTP (80), HTTPS (443), SSH (22)

El puerto 3000 **no** se abre.

### 1.2 IP estática

VM → clic en la IP pública → **Configuración → Asignación: Estática** → Guardar. Evita que la IP cambie al detener la VM (lo que rompería Atlas y DuckDNS).

### 1.3 MongoDB Atlas

Atlas → **Network Access → IP Access List → Add IP Address** → `57.156.68.131/32`, comentario `Azure VM empleados-app`. Se mantiene la entrada de EC2: ambos servidores usan el mismo cluster.

---

## Fase 2 — Servidor (SSH desde PowerShell local)

```powershell
$key = "C:\ruta\a\empleados-app-azure_key.pem"
icacls $key /inheritance:r
icacls $key /grant:r "$($env:USERNAME):(R)"
ssh -i $key azureuser@57.156.68.131
```

### 2.1 Actualizar y reiniciar

```bash
sudo apt update && sudo apt upgrade -y
sudo reboot
```

El reinicio carga el kernel actualizado antes de montar la aplicación.

### 2.2 Swap de 2 GB (1 GiB de RAM no alcanza para compilar Angular)

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h
```

### 2.3 Node.js 24, Git, build-essential, Nginx, PM2

Angular 22 exige Node ≥ 24.15.

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git build-essential nginx
node -v && npm -v
sudo npm install -g pm2
```

### 2.4 Firewall local (UFW)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
sudo ufw status
```

Doble capa: NSG en Azure y UFW en el sistema operativo.

---

## Fase 3 — GitHub ↔ Azure VM

### 3.1 Deploy key

```bash
ssh-keygen -t ed25519 -C "azure-vm-empleados" -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```

GitHub → `Practica06-Despliegue` → **Settings → Deploy keys → Add deploy key**, título `Azure VM`, sin permiso de escritura. El repositorio queda con dos deploy keys (EC2 y Azure).

```bash
ssh -T git@github.com
```

### 3.2 Carpeta de despliegue y secretos

```bash
sudo mkdir -p /var/www/empleados-app/shared/logs
sudo chown -R azureuser:azureuser /var/www/empleados-app
nano /var/www/empleados-app/shared/.env
```

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
curl -fsSL https://raw.githubusercontent.com/KituNaranjo/Practica06-Despliegue/main/deploy/nginx-empleados.conf | sudo tee /etc/nginx/sites-available/default > /dev/null
sudo nginx -t && sudo systemctl reload nginx
```

---

## Fase 5 — CI/CD con PM2 Deploy (desde el PC, en Git Bash)

### 5.1 Clave en una ruta sin caracteres especiales

```bash
mkdir -p ~/.ssh
cp "/c/ruta/a/empleados-app-azure_key.pem" ~/.ssh/
chmod 600 ~/.ssh/empleados-app-azure_key.pem
ssh -i ~/.ssh/empleados-app-azure_key.pem azureuser@57.156.68.131 "echo conexion OK"
```

### 5.2 Entorno `azure` en `ecosystem.config.cjs`

```js
const POST_DEPLOY =
  'cd backend && npm ci && npm run build' +
  ' && cd ../frontend && npm ci && npm run build' +
  ' && cd .. && pm2 startOrReload ecosystem.config.cjs && pm2 save';

// dentro de deploy: { ... }
azure: {
  user: 'azureuser',
  host: ['57.156.68.131'],
  key: '~/.ssh/empleados-app-azure_key.pem',
  ref: 'origin/main',
  repo: 'git@github.com:KituNaranjo/Practica06-Despliegue.git',
  path: APP_DIR,
  'post-deploy': POST_DEPLOY,
},
```

Verificación:

```bash
node -e "const c=require('./ecosystem.config.cjs'); console.log(Object.keys(c.deploy))"
# [ 'production', 'azure' ]
```

### 5.3 Primer despliegue

```bash
git add ecosystem.config.cjs
git commit -m "feat: entorno de despliegue Azure VM"
git push origin main
pm2 deploy ecosystem.config.cjs azure setup
pm2 deploy ecosystem.config.cjs azure
```

Resultado: `mi-node-app` en modo cluster con **2 instancias** (una por vCPU).

Despliegues posteriores a cada servidor:

```bash
pm2 deploy ecosystem.config.cjs azure        # Azure
pm2 deploy ecosystem.config.cjs production   # AWS EC2
```

### 5.4 Arranque automático (en la VM)

```bash
pm2 startup systemd -u azureuser --hp /home/azureuser
# ejecutar la línea "sudo env PATH=..." que imprime
pm2 save
```

Crea el servicio `pm2-azureuser.service`.

---

## Fase 6 — Monitoreo y alertas (en la VM)

### 6.1 pm2-discord

```bash
pm2 install pm2-discord
pm2 set pm2-discord:discord_url "URL_DE_TU_WEBHOOK"
pm2 set pm2-discord:process_name mi-node-app
pm2 set pm2-discord:stop true
pm2 set pm2-discord:exit true
pm2 set pm2-discord:restart true
pm2 set pm2-discord:exception true
pm2 set pm2-discord:online true
pm2 save
pm2 flush pm2-discord
```

Cada evento llega duplicado porque el cluster tiene 2 instancias. Si EC2 y Azure usan el mismo webhook, conviene renombrarlo o usar uno por servidor para distinguir el origen.

### 6.2 Rotación de logs

```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## Fase 7 — Dominio y HTTPS

### 7.1 DuckDNS

[duckdns.org](https://www.duckdns.org) → subdominio `empleados-azure-cn` → current ip `57.156.68.131` → update ip.

```bash
nslookup empleados-azure-cn.duckdns.org
```

### 7.2 Certificado Let's Encrypt

```bash
DOMINIO=empleados-azure-cn.duckdns.org
CORREO=TU_CORREO
sudo sed -i "s/server_name _;/server_name $DOMINIO;/" /etc/nginx/sites-available/default
sudo nginx -t && sudo systemctl reload nginx
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d $DOMINIO --redirect --agree-tos -m $CORREO --no-eff-email -n
sudo certbot renew --dry-run
```

### 7.3 Mantener el acceso por IP

Misma estructura de tres bloques del `DEPLOY.md` (7.3): snippet común en `/etc/nginx/snippets/empleados-app.conf` y en `default` un bloque para la IP por HTTP, uno para redirigir el dominio a HTTPS y uno para el dominio por HTTPS.

```bash
sudo nginx -t && sudo systemctl reload nginx && sudo certbot renew --dry-run
```

---

## Pruebas de verificación

**1. Red** (desde el PC):

```bash
curl -sI http://empleados-azure-cn.duckdns.org | head -n 3              # 301 -> https
curl -s https://empleados-azure-cn.duckdns.org/api/v1/empleados | head -c 120; echo
curl -s http://57.156.68.131/api/v1/empleados | head -c 120; echo
curl -s -m 5 http://57.156.68.131:3000/api/v1/empleados || echo "Puerto 3000 cerrado: OK"
```

**2. Resiliencia** (en la VM):

```bash
pm2 list
pm2 stop mi-node-app      # llega la alerta a Discord
pm2 start mi-node-app
```

**3. Reinicio del servidor:**

```bash
sudo reboot
```

Sin volver a entrar por SSH, la aplicación responde en el navegador y `pm2 list` muestra ambas instancias online con uptime reciente.

**4. CI/CD:** `git push` + `pm2 deploy ecosystem.config.cjs azure` actualiza el servidor con *reload* de las instancias, sin tocar el portal de Azure.

**5. Base de datos compartida:** un empleado creado desde Azure aparece también en la aplicación de EC2, porque ambos despliegues usan el mismo cluster de Atlas.

---

## Costos (Azure for Students)

- VM → **Operaciones → Apagado automático**: habilitado, 23:00, zona horaria UTC-05:00 (Bogotá, Lima, Quito).
- Al terminar: **Detener** la VM desde el portal (la desasigna y deja de cobrar cómputo).

---

## Troubleshooting rápido

| Síntoma | Revisar |
|---|---|
| `hostname contains invalid characters` al hacer SSH | Se dejó un marcador como `<IP_PUBLICA>` en lugar de la IP real |
| `Cannot find module './ecosystem.config.cjs'` | No se está en la raíz del repositorio (`ls` debe mostrar `backend/`, `frontend/`, `deploy/`) |
| Error de Node al compilar Angular | `node -v` ≥ 24.15 |
| `JavaScript heap out of memory` | Swap activo: `free -h` |
| App sin datos / reinicios en bucle | IP de Azure en Atlas Network Access; `cat /var/www/empleados-app/shared/.env` |
| Alertas de Discord no llegan | `pm2 conf pm2-discord`: la `discord_url` debe ser `https://discord.com/api/webhooks/...`, no un link de invitación ni el marcador |
| `http://IP` devuelve 404 después de Certbot | Aplicar la estructura de tres bloques (7.3) |
| La app deja de responder tras detener/iniciar la VM | La IP pasó a dinámica: fijarla como estática y actualizar Atlas y DuckDNS |
