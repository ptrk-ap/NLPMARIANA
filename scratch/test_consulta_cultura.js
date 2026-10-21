/**
 * Teste: "empenhado na Secretaria de Cultura em 2026"
 * Verifica se o filtro de unidade gestora reconhece essa consulta.
 */
const UgService = require("../src/services/filtros/ugService");
const AnoService = require("../src/services/filtros/anoService");

async function testar() {
    const frase = "empenhado na Secretaria de Cultura em 2026";
    
    // 1. Teste do AnoService
    const anoService = new AnoService();
    const anos = await anoService.extrair(frase);
    console.log("=== ANO ===");
    console.log("Anos encontrados:", JSON.stringify(anos, null, 2));
    
    // 2. Teste do UgService
    const ugService = new UgService();
    
    // Teste com ano 2026
    const ugResultados2026 = ugService.extrair(frase, ["2026"]);
    console.log("\n=== UNIDADE GESTORA (ano 2026) ===");
    console.log("UGs encontradas:", JSON.stringify(ugResultados2026, null, 2));
    
    // Teste sem especificar ano (default)
    const ugResultadoDefault = ugService.extrair(frase);
    console.log("\n=== UNIDADE GESTORA (ano default) ===");
    console.log("UGs encontradas:", JSON.stringify(ugResultadoDefault, null, 2));
    
    // 3. Mostrar dados carregados para 2026
    const dados2026 = ugService.dadosPorAno["2026"];
    if (dados2026) {
        console.log("\n=== DADOS 2026 ===");
        console.log("Total de UGs carregadas:", dados2026.unidades.length);
        
        // Buscar manualmente por "cultura"
        const comCultura = dados2026.unidades.filter(u => 
            u.descricao.toLowerCase().includes("cultura")
        );
        console.log("UGs com 'cultura' na descrição:", JSON.stringify(comCultura, null, 2));
        
        // Buscar por mnemônico SECULT
        const secult = dados2026.unidades.filter(u => 
            u.mnemonico.toLowerCase().includes("secult")
        );
        console.log("UGs com mnemônico SECULT:", JSON.stringify(secult, null, 2));
    } else {
        console.log("\n⚠ Dados para 2026 NÃO CARREGADOS!");
    }
}

testar().catch(console.error);
