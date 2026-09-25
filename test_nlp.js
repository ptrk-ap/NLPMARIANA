const OrcamentoService = require("./src/services/entidades/OrcamentoService");
const ExtratorTermosService = require("./src/services/entidades/ExtratorTermosService");
const Splitservice = require("./src/services/entidades/splitService");
const filtroService = require("./src/services/filtros/filtroService");
const QueryService = require("./src/services/query/queryService");

async function run() {
    try {
        const queryService = new QueryService();
        // A user query specifically asking for 2025 and "ação"
        const frase = "despesas pagas na acao 2000 em 2025"; 
        
        console.log("Original: ", frase);
        
        const fraseProcessada = OrcamentoService.traduzirParaTermosSql(frase);
        const parametrosEncontrados = ExtratorTermosService.identificarParametros(fraseProcessada);
        const divisor = Splitservice.quebrarFrase(fraseProcessada);
        const filtros = await filtroService.processarFiltros(divisor);
        const anosQuery = filtroService.resolverAnos(filtros, parametrosEncontrados);
        
        console.log("Filtros extraidos: ", JSON.stringify(filtros, null, 2));
        console.log("Anos filtrados: ", anosQuery);
        
        const queries = queryService.buildQuery(parametrosEncontrados, filtros, anosQuery);
        
        console.log("\n====== SQL GERADO ======\n");
        if (queries.queries) {
            for (const [sufixo, dados] of Object.entries(queries.queries)) {
                console.log(`-- SUFIXO: ${sufixo}`);
                console.log(dados.sql);
                console.log(`Parâmetros: ${JSON.stringify(dados.params)}`);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

run();
