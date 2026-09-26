// ecosystem.config.cjs — PM2 (Práctica 06: Despliegue en AWS con Nginx y PM2)
// Extensión .cjs porque el backend usa "type": "module".
// Los secretos NO van aquí: se leen de /var/www/empleados-app/shared/.env (fuera del repo).

const APP_DIR = '/var/www/empleados-app';

module.exports = {
  apps: [
    {
      name: 'mi-node-app',
      cwd: `${APP_DIR}/current/backend`,
      script: 'dist/index.js',
      instances: 'max',          // Modo Cluster: una réplica por vCPU
      exec_mode: 'cluster',
      node_args: `--env-file=${APP_DIR}/shared/.env`,
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '300M',
      error_file: `${APP_DIR}/shared/logs/err.log`,
      out_file: `${APP_DIR}/shared/logs/out.log`,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],

  deploy: {
    production: {
      user: 'ubuntu',
      host: ['18.220.70.44'],
      key: '~/.ssh/llave-empleados.pem',
      ref: 'origin/main',
      repo: 'git@github.com:KituNaranjo/Practica06-Despliegue.git',
      path: APP_DIR,
      'post-deploy':
        'cd backend && npm ci && npm run build' +
        ' && cd ../frontend && npm ci && npm run build' +
        ' && cd .. && pm2 startOrReload ecosystem.config.cjs && pm2 save',
    },
  },
};
