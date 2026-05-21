const OrcamentoService = require("../services/entidades/OrcamentoService");
const ExtratorTermosService = require("../services/entidades/ExtratorTermosService");
const Splitservice = require("../services/entidades/splitService");
const filtroService = require("../services/filtros/filtroService");
const QueryService = require("../services/query/queryService");
const FormatterService = require("../services/entidades/formatterService");
const ValidacaoConsultaService = require("../services/entidades/ValidacaoConsultaService");

const queryService = new QueryService();

async function consulta(req, res, next) {
    const consultaFrase = req.body.frase;

    if (!consultaFrase || typeof consultaFrase !== "string") {
        return res.status(400).json({
            erro: "Campo 'frase' é obrigatório"
        });
    }
    if (consultaFrase.length > 200) {
        return res.status(400).json({
            erro: "Frase muito longa, por favor, reduza o tamanho da frase até 200 caracteres"
        });
    }

    try {
        // 1. Traduz termos naturais para termos SQL (ex: "unidade gestora" → "unidade_gestora")
        const fraseProcessada = OrcamentoService.traduzirParaTermosSql(consultaFrase);

        // 1.1 Extração de aviso de anos fora do limite
        const avisoAno = ValidacaoConsultaService.verificarAnoLimite(consultaFrase);

        // 2. Identifica os campos do relatório presentes na frase
        const parametrosEncontrados = ExtratorTermosService.identificarParametros(fraseProcessada);

        // 3. Quebra a frase em segmentos usando os termos como marcadores
        const divisor = Splitservice.quebrarFrase(fraseProcessada);

        // 4. Extrai filtros de cada segmento
        const filtros = await filtroService.processarFiltros(divisor);
        console.log(filtros);

        // 5. Validação: ao menos uma despesa ou dotação é obrigatória
        if (!ValidacaoConsultaService.temDespesaOuDotacao(parametrosEncontrados)) {
            return res.status(400).json({
                erro: "Requisição incompleta",
                mensagem: "Para que o sistema funcione, é obrigatório informar ao menos uma dessas despesas (Empenhada, Liquidada, Paga ou do Exercício) ou a Dotação Inicial."
            });
        }

        // 6. Validação: ao menos uma categoria ou filtro específico é necessário
        if (!ValidacaoConsultaService.temCategoriaOuFiltro(parametrosEncontrados, filtros)) {
            return res.json({
                mensagem: "Consulta muito genérica. Para obter resultados, informe ao menos uma categoria (ex: Órgão, Programa) ou filtro específico.",
                resultado: []
            });
        }

        // 7. Resolve a lista de anos (deduplica ou usa ano padrão)
        const anosQuery = filtroService.resolverAnos(filtros, parametrosEncontrados);

        // 8. Monta e executa a query
        const queries = queryService.buildQuery(parametrosEncontrados, filtros, anosQuery);

        const rows = await queryService.executar(queries);

        // 9. Formata os valores monetários e o credor
        const resultadoFormatado = FormatterService.formatarResultado(rows);

        // 10. Monta a mensagem de período
        let mensagemFinal = FormatterService.formatarMensagemPeriodo(filtros, anosQuery);
        if (avisoAno) {
            mensagemFinal += `\n${avisoAno}`;
        }

        // 11. Formata a resposta completa para WhatsApp
        const textoWhatsapp = FormatterService.formatarParaWhatsapp(mensagemFinal, resultadoFormatado);

        return res.json({
            whatsapp: textoWhatsapp
        });

    } catch (err) {
        console.error("Erro no ConsultaController:", err);
        return res.status(500).json({
            erro: "Erro interno no servidor",
            mensagem: "Desculpe, não entendi sua solicitação. Você poderia reformular sua pergunta? Lembre-se de usar termos técnicos e formais em consultas contábeis.",
            detalhes: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
}

module.exports = { consulta };