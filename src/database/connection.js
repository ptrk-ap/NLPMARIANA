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

module.exports = knex;