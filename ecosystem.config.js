const path = require('path');
const dotenv = require('dotenv');

// Carrega o arquivo de ambiente específico do servidor se ele existir
dotenv.config({ path: path.join(__dirname, '.env.production') });

module.exports = {
    apps: [{
        name: 'portal-web',
        script: './src/server.js', // Altere para o seu ponto de entrada (ex: index.js)
        instances: 'max',
        exec_mode: 'cluster',
        env_production: {
            NODE_ENV: 'production',
            PORT: process.env.PORT || 3000,
            DATABASE_URL: process.env.DATABASE_URL,
            JWT_SECRET: process.env.JWT_SECRET
            // Adicione as demais chaves mapeadas no seu .env.example
        }
    }]
};