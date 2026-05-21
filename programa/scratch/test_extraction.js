const PeriodoService = require('./src/services/filtros/dateService');
const OrcamentoService = require('./src/services/entidades/OrcamentoService');

async function test() {
    const frase = "pagamenos no prodap em março de 2026";
    const fraseProcessada = OrcamentoService.traduzirParaTermosSql(frase);
    console.log("Frase Processada:", fraseProcessada);
    
    const service = new PeriodoService();
    const result = await service.extrair(fraseProcessada, 2026);
    console.log("Resultado Extração:", JSON.stringify(result, null, 2));
}

test();
