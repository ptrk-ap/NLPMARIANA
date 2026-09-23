const path = require('path');
const dotenv = require('dotenv');

// Carrega o .env.production se existir, senão carrega o .env padrão
const fs = require('fs');
const envFile = fs.existsSync(path.join(__dirname, '.env.production')) ? '.env.production' : '.env';

dotenv.config({ path: path.join(__dirname, envFile) });

module.exports = {
  apps: [{
    name: 'portal-web',
    cwd: __dirname,
    script: './src/server.js',
    instances: '3',
    exec_mode: 'cluster',
    autorestart: true,
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 5000,
    max_memory_restart: '500M',
    kill_timeout: 10000,
    merge_logs: true,
    time: true,
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3000,
      DATABASE_URL: process.env.DATABASE_URL,
      API_USERNAME: process.env.API_USERNAME,
      API_PASSWORD: process.env.API_PASSWORD,
      TRIGGER_USERNAME: process.env.TRIGGER_USERNAME,
      TRIGGER_PASSWORD: process.env.TRIGGER_PASSWORD,
      DB_SSL: process.env.DB_SSL
    }
  }]
};
