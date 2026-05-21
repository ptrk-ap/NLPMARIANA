const { ENTITY_COLUMNS, ORDER_PRIORITY } = require("./QueryConfig");

function quoteIdent(name) {
    return `"${name}"`;
}

/**
 * Monta as partes do SELECT e GROUP BY com base nas entidades e valores solicitados.
 */
function buildSelectAndGroupBy(entidadesFinais, valoresSolicitados, dataReferencia = null) {
    const selectParts = [];
    const groupByParts = [];

    for (const entidade of ENTITY_COLUMNS) {
        if (!entidadesFinais.has(entidade)) continue;

        if (dataReferencia) {
            if (entidade === "agrupamento_mensal") {
                selectParts.push(`EXTRACT(MONTH FROM ${dataReferencia})::int AS mes`);
                groupByParts.push(`mes`);
            } else if (entidade === "agrupamento_bimestral") {
                selectParts.push(`CEIL(EXTRACT(MONTH FROM ${dataReferencia}) / 2.0)::int AS bimestre`);
                groupByParts.push(`bimestre`);
            } else if (entidade === "agrupamento_trimestral") {
                selectParts.push(`CEIL(EXTRACT(MONTH FROM ${dataReferencia}) / 3.0)::int AS trimestre`);
                groupByParts.push(`trimestre`);
            } else if (entidade === "agrupamento_semestral") {
                selectParts.push(`CASE WHEN EXTRACT(MONTH FROM ${dataReferencia}) <= 6 THEN 1 ELSE 2 END AS semestre`);
                groupByParts.push(`semestre`);
            } else if (entidade === "agrupamento_diario") {
                selectParts.push(`TO_CHAR(${dataReferencia}, 'DD/MM/YYYY') AS dia`);
                groupByParts.push(`${dataReferencia}::date`);
                groupByParts.push(`dia`);
            }
        }

        if (entidade !== "ordem_bancaria" && entidade !== "nota_empenho" && entidade !== "nota_liquidacao" && !entidade.startsWith("agrupamento_")) {
            selectParts.push(quoteIdent(entidade));
            groupByParts.push(quoteIdent(entidade));
        }
    }

    for (const val of valoresSolicitados) {
        selectParts.push(
            `SUM(${quoteIdent(val)}) AS ${quoteIdent(`soma_${val}`)}`
        );
    }

    return { selectParts, groupByParts };
}

/**
 * Monta a cláusula WHERE a partir dos blocos hierárquicos e independentes.
 * Retorna { whereClause, params }.
 */
function buildWhere(hierarquicos, independentes, filtrosEncontrados, dataReferencia = null) {
    const params = [];
    const blocosHierarquicos = [];
    const partesIndependentes = [];

    // Blocos hierárquicos: OR entre níveis, AND dentro do mesmo nível
    for (const nivel of Object.keys(hierarquicos)) {
        const entidadesNivel = hierarquicos[nivel];
        const partes = [];

        for (const [entidade, valores] of Object.entries(entidadesNivel)) {
            const incluir = valores.filter(v => !v.excluir);
            const excluir = valores.filter(v => v.excluir);
            
            const partesEntidade = [];
            
            if (incluir.length > 0) {
                const likes = incluir.map(() => `${quoteIdent(entidade)} ILIKE ?`).join(" OR ");
                partesEntidade.push(`(${likes})`);
                params.push(...incluir.map(v => `${v.valor}%`));
            }
            
            if (excluir.length > 0) {
                const notLikes = excluir.map(() => `${quoteIdent(entidade)} NOT ILIKE ?`).join(" AND ");
                partesEntidade.push(`(${notLikes})`);
                params.push(...excluir.map(v => `${v.valor}%`));
            }
            
            if (partesEntidade.length > 0) {
                partes.push(`(${partesEntidade.join(" AND ")})`);
            }
        }

        blocosHierarquicos.push(`(${partes.join(" AND ")})`);
    }

    // Filtros independentes
    for (const [entidade, valores] of Object.entries(independentes)) {
        if (["credor", "emenda", "contrato", "convenio_despesa", "convenio_receita"].includes(entidade)) {
            const incluir = valores.filter(v => !v.excluir);
            const excluir = valores.filter(v => v.excluir);
            
            if (incluir.length > 0) {
                const likes = incluir.map(() => `${quoteIdent(entidade)} ILIKE ?`).join(" OR ");
                partesIndependentes.push(`(${likes})`);
                params.push(...incluir.map(v => `%${v.valor}%`));
            }
            if (excluir.length > 0) {
                const notLikes = excluir.map(() => `${quoteIdent(entidade)} NOT ILIKE ?`).join(" AND ");
                partesIndependentes.push(`(${notLikes})`);
                params.push(...excluir.map(v => `%${v.valor}%`));
            }

        } else if (entidade === "periodo" && dataReferencia) {
            const dateBlocks = [];
            const excludeBlocks = [];
            const arrOriginal = valores || [];

            for (const p of arrOriginal) {
                // Aplica o filtro de período na dataReferencia da tabela (ex: nota_empenho, ordem_bancaria)
                if (p.excluir) {
                    excludeBlocks.push(`${dataReferencia} NOT BETWEEN ? AND ?`);
                    params.push(p.data_inicio, p.data_fim);
                } else {
                    dateBlocks.push(`${dataReferencia} BETWEEN ? AND ?`);
                    params.push(p.data_inicio, p.data_fim);
                }
            }

            if (dateBlocks.length > 0) {
                partesIndependentes.push(`(${dateBlocks.join(" OR ")})`);
            }
            if (excludeBlocks.length > 0) {
                partesIndependentes.push(`(${excludeBlocks.join(" AND ")})`);
            }

        } else {
            const incluir = valores.filter(v => !v.excluir);
            const excluir = valores.filter(v => v.excluir);
            
            if (incluir.length > 0) {
                const likes = incluir.map(() => `${quoteIdent(entidade)} ILIKE ?`).join(" OR ");
                partesIndependentes.push(`(${likes})`);
                params.push(...incluir.map(v => `${v.valor}%`));
            }
            if (excluir.length > 0) {
                const notLikes = excluir.map(() => `${quoteIdent(entidade)} NOT ILIKE ?`).join(" AND ");
                partesIndependentes.push(`(${notLikes})`);
                params.push(...excluir.map(v => `${v.valor}%`));
            }
        }
    }

    // Monta a cláusula WHERE final
    let whereClause = "";
    if (blocosHierarquicos.length > 0 && partesIndependentes.length > 0) {
        whereClause = `WHERE (${blocosHierarquicos.join(" OR ")}) AND ${partesIndependentes.join(" AND ")}`;
    } else if (blocosHierarquicos.length > 0) {
        whereClause = `WHERE ${blocosHierarquicos.join(" OR ")}`;
    } else if (partesIndependentes.length > 0) {
        whereClause = `WHERE ${partesIndependentes.join(" AND ")}`;
    }

    return { whereClause, params };
}

/**
 * Monta a cláusula ORDER BY com base nas entidades finais e campos do SELECT.
 */
function buildOrderBy(entidadesFinais, selectParts, dataReferencia = null) {
    let orderClause = "";

    if (entidadesFinais.has("credor")) {
        const camposDisponiveis = ORDER_PRIORITY.filter(campo =>
            selectParts.some(p => p.includes(`AS "${campo}"`))
        );

        if (camposDisponiveis.length > 0) {
            orderClause = `ORDER BY ${camposDisponiveis.map(c => `"${c}" DESC`).join(", ")}`;
        }
    }

    if (entidadesFinais.has("agrupamento_mensal")) {
        orderClause = orderClause
            ? `${orderClause}, "mes" ASC`
            : `ORDER BY "mes" ASC`;
    }

    if (entidadesFinais.has("agrupamento_bimestral")) {
        orderClause = orderClause
            ? `${orderClause}, "bimestre" ASC`
            : `ORDER BY "bimestre" ASC`;
    }

    if (entidadesFinais.has("agrupamento_trimestral")) {
        orderClause = orderClause
            ? `${orderClause}, "trimestre" ASC`
            : `ORDER BY "trimestre" ASC`;
    }

    if (entidadesFinais.has("agrupamento_semestral")) {
        orderClause = orderClause
            ? `${orderClause}, "semestre" ASC`
            : `ORDER BY "semestre" ASC`;
    }

    if (entidadesFinais.has("agrupamento_diario")) {
        orderClause = orderClause
            ? `${orderClause}, ${dataReferencia}::date ASC`
            : `ORDER BY ${dataReferencia}::date ASC`;
    }

    return orderClause;
}

module.exports = {
    buildSelectAndGroupBy,
    buildWhere,
    buildOrderBy
};
