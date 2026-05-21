/**
 * ValidacaoConsultaService
 *
 * Centraliza todas as regras de negócio de validação de uma consulta orçamentária.
 * O controller não deve conhecer listas de termos nem lógica de decisão sobre o domínio.
 */
class ValidacaoConsultaService {

    /**
     * Campos de despesa ou dotação — ao menos um é obrigatório na consulta.
     */
    static TERMOS_OBRIGATORIOS = [
        "dotacao_inicial",
        "despesas_empenhadas",
        "despesas_liquidadas",
        "despesas_pagas",
        "despesas_exercicio_pagas"
    ];

    /**
     * Categorias orçamentárias aceitas como dimensões de agrupamento.
     * Se ao menos uma estiver presente na consulta, a query é considerada específica o suficiente.
     */
    static CATEGORIAS_OBRIGATORIAS = [
        "unidade_gestora", "fonte", "natureza_despesa", "programa", "acao",
        "unidade_orcamentaria", "elemento_despesa", "grupo_despesa",
        "categoria_despesa", "funcao", "ods", "eixo", "poder", "emenda",
        "contrato", "convenio_despesa", "convenio_receita", "credor",
        "agrupamento_mensal", "agrupamento_bimestral", "agrupamento_trimestral", "agrupamento_semestral"
    ];

    /**
     * Filtros que, sozinhos, não são considerados suficientes para tornar
     * a consulta específica (ex: apenas o ano não é um filtro temático).
     */
    static FILTROS_INSUFICIENTES = ["ano", "periodo"];

    /**
     * Verifica se os parâmetros encontrados na frase contêm ao menos
     * um termo de despesa ou dotação.
     *
     * @param {string[]} parametros - Lista de termos identificados na frase.
     * @returns {boolean}
     */
    static temDespesaOuDotacao(parametros) {
        return parametros.some(p => ValidacaoConsultaService.TERMOS_OBRIGATORIOS.includes(p));
    }

    /**
     * Verifica se a consulta possui ao menos uma categoria orçamentária
     * ou um filtro válido (além de 'ano' e 'ordem_bancaria').
     *
     * @param {string[]} parametros - Lista de termos identificados na frase.
     * @param {Object}   filtros    - Objeto retornado pelo filtroService.
     * @returns {boolean}
     */
    static temCategoriaOuFiltro(parametros, filtros) {
        const temCategoria = parametros.some(p =>
            ValidacaoConsultaService.CATEGORIAS_OBRIGATORIAS.includes(p)
        );

        const chavesFiltroValidos = Object.keys(filtros).filter(
            f => !ValidacaoConsultaService.FILTROS_INSUFICIENTES.includes(f)
        );
        const temFiltro = chavesFiltroValidos.length > 0;

        return temCategoria || temFiltro;
    }

    /**
     * Verifica e retorna um aviso se houver anos solicitados mas fora do limite suportado (2024 até o atual).
     */
    static verificarAnoLimite(frase) {
        if (!frase) return "";
        const regex = /\b(19\d{2}|20\d{2})\b/g;
        const anos = [...frase.matchAll(regex)].map(m => parseInt(m[1]));
        const anoAtual = new Date().getFullYear();
        const invalidos = [...new Set(anos.filter(a => a < 2024 || a > anoAtual))];

        if (invalidos.length > 0) {
            return ` Aviso: O sistema possui dados registrados apenas para o período de 2024 a ${anoAtual}. O(s) ano(s) ${invalidos.join(', ')} foi(ram) desconsiderado(s).`;
        }
        return "";
    }
}

module.exports = ValidacaoConsultaService;
