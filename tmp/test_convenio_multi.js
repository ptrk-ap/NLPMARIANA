
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
require.cache[require.resolve(path.join(projectRoot, 'src/database/connection'))] = {
    exports: mockKnex()
};

const OrcamentoService = require(path.join(projectRoot, 'src/services/entidades/OrcamentoService'));
const ExtratorTermosService = require(path.join(projectRoot, 'src/services/entidades/ExtratorTermosService'));
const SplitService = require(path.join(projectRoot, 'src/services/entidades/splitService'));
const FiltroService = require(path.join(projectRoot, 'src/services/filtros/filtroService'));

async function runTest(frase) {
    console.log(`\n--- TESTE: "${frase}" ---`);

    const traduzida = OrcamentoService.traduzirParaTermosSql(frase);
    const params = ExtratorTermosService.identificarParametros(traduzida);
    const divisor = SplitService.quebrarFrase(traduzida);
    const filtros = await FiltroService.processarFiltros(divisor);
    
    console.log("Parâmetros (Colunas):", params);
    console.log("Filtros Extraídos:", JSON.stringify(filtros, null, 2));
}

async function main() {
    await runTest('despesas pagas na feas em 2025 sem convenio');
    await runTest('despesas pagas na feas em 2025 sem convenio de receita');
    await runTest('despesas pagas na feas em 2025 sem convenio de despesa');
}

main().catch(console.error);
