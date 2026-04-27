require("dotenv").config();

const knex = require("knex")({
  client: "pg",
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  },
  pool: { min: 0, max: 10 }
});

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


module.exports = knex;


