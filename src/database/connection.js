const knex = require("knex")({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
  },
  pool: {
    min: 0,
    max: 10
  }
});

module.exports = knex;

