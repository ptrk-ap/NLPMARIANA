
require('dotenv').config();
const path = require('path');
const projectRoot = 'c:/Users/Psantos/Documents/GitHub/programa/programa';
const knex = require(path.join(projectRoot, 'src/database/connection'));

async function check() {
    try {
        const query = "SELECT DISTINCT convenio_despesa FROM `execucao2025` LIMIT 50";
        console.log(`Executando: ${query}`);
        const [rows] = await knex.raw(query);
        
        console.log("\nValores encontrados para convenio_despesa:");
        rows.forEach(r => {
            console.log(`'${r.convenio_despesa}'`);
        });

        // Testar também convenio_receita
        const queryRec = "SELECT DISTINCT convenio_receita FROM `execucao2025` LIMIT 10";
        const [rowsRec] = await knex.raw(queryRec);
        console.log("\nValores encontrados para convenio_receita (Top 10):");
        rowsRec.forEach(r => {
            console.log(`'${r.convenio_receita}'`);
        });

        process.exit(0);
    } catch (err) {
        console.error("Erro ao acessar o banco:", err);
        process.exit(1);
    }
}

check();
