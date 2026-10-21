const OrcamentoService = require("../src/services/entidades/OrcamentoService");
const ExtratorTermosService = require("../src/services/entidades/ExtratorTermosService");
const Splitservice = require("../src/services/entidades/splitService");
const filtroService = require("../src/services/filtros/filtroService");

async function testarPipelineCompleta() {
    const frase = "empenhado na Secretaria de cultura em 2026";
    console.log("Frase original:", frase);

    const fraseProcessada = OrcamentoService.traduzirParaTermosSql(frase);
    console.log("Frase processada:", fraseProcessada);

    const parametrosEncontrados = ExtratorTermosService.identificarParametros(fraseProcessada);
    console.log("Parâmetros (valores/dimensões):", parametrosEncontrados);

    const divisor = Splitservice.quebrarFrase(fraseProcessada);
    console.log("Quebras/divisão:", divisor);

    const filtros = await filtroService.processarFiltros(divisor);
    console.log("Filtros extraídos:", JSON.stringify(filtros, null, 2));

    const anosQuery = filtroService.resolverAnos(filtros, parametrosEncontrados);
    console.log("Anos resolvidos:", anosQuery);

    process.exit(0);
}

testarPipelineCompleta().catch(err => {
    console.error(err);
    process.exit(1);
});
