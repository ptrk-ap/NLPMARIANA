const { ENTITY_COLUMNS, HIERARCHY_LEVEL } = require("./QueryConfig");

/**
 * Formata os valores vindos da busca.
 * Para 'credor', extrai apenas o código para busca por LIKE.
 * Para demais entidades, mantém o padrão "codigo - descricao".
 */
function toEntityValues(arr = [], entidade = "") {
    let result = [];
    for (const i of arr) {
        if (i == null) continue;

        // Specially handle date range filters
        const isDateField = ["periodo", "ordem_bancaria", "nota_empenho", "nota_liquidacao"].includes(entidade);
        if (isDateField && i.data_inicio && i.data_fim) {
            result.push({ ...i });
            continue;
        }

        const codigo = String(i.codigo || "").trim();
        const descricao = String(i.descricao || "").trim();
        if (!codigo) continue;

        let valor;
        if (["credor", "emenda", "contrato", "convenio_despesa", "convenio_receita"].includes(entidade)) {
            valor = codigo;
        } else {
            valor = descricao ? `${codigo} - ${descricao}` : codigo;
        }

        result.push({ valor, excluir: !!i.excluir });
    }
    return result;
}

/**
 * Recebe filtrosEncontrados brutos e retorna apenas os filtros válidos
 * com seus valores já formatados.
 */
function processFiltros(filtrosEncontrados = {}) {
    const filtrosValidos = {};

    for (const [entidade, arr] of Object.entries(filtrosEncontrados)) {
        if (
            (ENTITY_COLUMNS.includes(entidade) || entidade === "periodo") &&
            Array.isArray(arr) &&
            arr.length > 0
        ) {
            const values = toEntityValues(arr, entidade);
            if (values.length > 0) {
                filtrosValidos[entidade] = values;
            }
        }
    }

    return filtrosValidos;
}

/**
 * Separa os filtros válidos em dois grupos:
 * - hierarquicos: poder, unidade_gestora, unidade_orcamentaria (usam OR entre níveis)
 * - independentes: demais entidades (usam AND entre si)
 */
function separateFiltros(filtrosValidos = {}) {
    const hierarquicos = {};
    const independentes = {};

    for (const [entidade, valores] of Object.entries(filtrosValidos)) {
        const nivel = HIERARCHY_LEVEL[entidade];
        if (nivel) {
            if (!hierarquicos[nivel]) hierarquicos[nivel] = {};
            hierarquicos[nivel][entidade] = valores;
        } else {
            independentes[entidade] = valores;
        }
    }

    return { hierarquicos, independentes };
}

module.exports = {
    toEntityValues,
    processFiltros,
    separateFiltros
};
