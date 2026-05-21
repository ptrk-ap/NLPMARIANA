const exclusaoFiltroService = require("../filtros/exclusaoFiltroService");

/**
 * ExtratorTermosService - Identifica quais chaves padronizadas estão presentes na frase.
 */
class ExtratorTermosService {
    constructor() {
        // Lista das chaves que queremos identificar
        this.chavesConfiguradas = [
            "unidade_gestora",
            "fonte",
            "natureza_despesa",
            "programa",
            "acao",
            "unidade_orcamentaria",
            "elemento_despesa",
            "grupo_despesa",
            "categoria_despesa",
            "funcao",
            "dotacao_inicial",
            "despesas_empenhadas",
            "despesas_liquidadas",
            "despesas_pagas",
            "despesas_exercicio_pagas",
            "ods",
            "eixo",
            "poder",
            "emenda",
            "contrato",
            "convenio_despesa",
            "convenio_receita",
            "credor",
            "agrupamento_mensal",
            "agrupamento_bimestral",
            "agrupamento_trimestral",
            "agrupamento_semestral",
            "agrupamento_diario"
        ];
    }

    /**
     * Analisa a frase e retorna um array com as chaves encontradas.
     * @param {string} textoNormatizado - A frase já processada pelo OrcamentoService.
     * @returns {string[]} - Array com as chaves detectadas (ex: ['fonte', 'acao']).
     */
    identificarParametros(textoNormatizado) {
        if (!textoNormatizado) return [];

        // Filtramos a lista de chaves, retornando apenas as que existem no texto
        return this.chavesConfiguradas.filter(chave => {
            // Usamos uma Regex com Word Boundary (\b) para garantir que
            // "despesa_paga" não seja confundido com "despesa_exercicio_paga"
            const regex = new RegExp(`\\b${chave}\\b`, 'g');
            if (!regex.test(textoNormatizado)) return false;
            
            // Ignora a chave explícita ("fonte", "natureza") se ela for apenas o alvo de uma exclusão ("sem a fonte")
            const isExcluded = exclusaoFiltroService.verificarExclusao(textoNormatizado, chave);

            // Regra especial: emendas, contratos e convênios possuem tratamento diferenciado em buscas negativas.
            // Mantemos a chave como parâmetro mesmo em contexto de exclusão (ex: "sem emendas", "sem convenio").
            if (["emenda", "contrato", "convenio_despesa", "convenio_receita"].includes(chave)) {
                return true;
            }

            return !isExcluded;
        });
    }
}

module.exports = new ExtratorTermosService();