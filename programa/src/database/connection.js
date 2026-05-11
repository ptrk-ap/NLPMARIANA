require("dotenv").config();
const knex = require("knex")({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  },
  pool: { min: 0, max: 10 }
});

// Teste de conexão imediato para facilitar o diagnóstico
knex.raw("SELECT 1")
  .then(() => {
    console.log("✅ Conexão com o banco de dados estabelecida com sucesso.");
  })
  .catch((err) => {
    console.error("❌ Erro ao conectar ao banco de dados:");
    console.error(`   Motivo: ${err.message}`);
    console.error("   Verifique se o PostgreSQL está rodando e se as credenciais em 'connection.js' estão corretas.");
  });

module.exports = knex;
/*
const knex = require("knex")({
  client: "pg",
  connection: {
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password: "1234",
    database: "siafic"
  },
  pool: { min: 0, max: 10 }
});


*/