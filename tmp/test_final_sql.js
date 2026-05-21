
const path = require('path');
const projectRoot = 'c:/Users/Psantos/Documents/GitHub/programa/programa';

// Mock database connection
const mockKnex = () => {
    const fn = (table) => ({
        select: () => fn(),
        whereIn: () => fn(),
        whereRaw: () => fn(),
        limit: () => Promise.resolve([])
    });
    return fn;
};

// We need to override the knex instance before it's used
const knex = {
    raw: (sql, params) => Promise.resolve([[]]),
    select: () => knex,
    whereIn: () => knex,
    whereRaw: () => knex,
    limit: () => Promise.resolve([])
};

// Mocking the connection module
require.cache[require.resolve(path.join(projectRoot, 'src/database/connection'))] = {
    exports: knex
};

const OrcamentoService = require(path.join(projectRoot, 'src/services/entidades/OrcamentoService'));
const ExtratorTermosService = require(path.join(projectRoot, 'src/services/entidades/ExtratorTermosService'));
const SplitService = require(path.join(projectRoot, 'src/services/entidades/splitService'));
const FiltroService = require(path.join(projectRoot, 'src/services/filtros/filtroService'));
const QueryService = require(path.join(projectRoot, 'src/services/query/queryService'));

async function test() {
    const frase = "despesas pagas na feas em 2025 sem convenio";
    console.log("=== EXECUTANDO BUSCA (SIMULAÇÃO) ===");
    console.log("Frase:", frase);

    const traduzida = OrcamentoService.traduzirParaTermosSql(frase);
    const paramsEncontrados = ExtratorTermosService.identificarParametros(traduzida);
    const divisor = SplitService.quebrarFrase(traduzida);
    const filtros = await FiltroService.processarFiltros(divisor);
    const anosQuery = FiltroService.resolverAnos(filtros);

    console.log("\nFiltros Processados:");
    console.log(JSON.stringify(filtros, null, 2));

    const queryService = new QueryService();
    const { sql, params } = queryService.buildQuery(paramsEncontrados, filtros, anosQuery);

    console.log("\nSQL GERADO:");
    // Formatting SQL for readability in the output
    console.log(sql.replace(/UNION ALL/g, "\nUNION ALL\n"));
    
    console.log("\nPARÂMETROS DO SQL:");
    console.log(params);
}

test().catch(console.error);
