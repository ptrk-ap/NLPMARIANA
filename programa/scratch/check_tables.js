const knex = require('./src/database/connection');
knex.raw("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'")
    .then(r => {
        console.log("Tabelas encontradas:");
        console.log(r.rows.map(t => t.tablename));
        process.exit(0);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
