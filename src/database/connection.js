require("dotenv").config();

const knex = require("knex")({
  client: "pg",

  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: false
  },

  pool: {
    min: 0,
    max: 10
  }
});

/* Antiga versão de conexão com banco:
const knex = require("knex")({
  client: "pg",
  connection: {
    host: "localhost",
    user: "postgres",
    password: " ",
    database: "siafic",
    ssl: false
  },
  pool: {
    min: 0,
    max: 10
  }
});
*/

module.exports = knex;
