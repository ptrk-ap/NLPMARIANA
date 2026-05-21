
require('dotenv').config();
const path = require('path');
const projectRoot = 'c:/Users/Psantos/Documents/GitHub/programa/programa';
const knex = require(path.join(projectRoot, 'src/database/connection'));

async function check() {
    try {
        const queryCont = "SELECT DISTINCT contrato FROM `execucao2025` LIMIT 10";
        const [rowsCont] = await knex.raw(queryCont);
        console.log("\nValores encontrados para contrato:");
        rowsCont.forEach(r => {
            console.log(`'${r.contrato}'`);
        });

        const queryEmenda = "SELECT DISTINCT emenda FROM `execucao2025` LIMIT 10";
        const [rowsEmenda] = await knex.raw(queryEmenda);
        console.log("\nValores encontrados para emenda:");
        rowsEmenda.forEach(r => {
            console.log(`'${r.emenda}'`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Erro ao acessar o banco:", err);
        process.exit(1);
    }
}

check();
