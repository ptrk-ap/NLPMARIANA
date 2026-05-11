const { ENTITY_COLUMNS, VALUE_COLUMNS, COLUMN_TO_SUFFIX, SUFFIX_TO_DATE_COLUMN } = require("./QueryConfig");
const { validateFields, validateValueFields, validateEntities } = require("./QueryValidator");
const { processFiltros, separateFiltros } = require("./FilterProcessor");
const { buildSelectAndGroupBy, buildWhere, buildOrderBy } = require("./QueryBuilder");
const knex = require("../../database/connection");

class QueryService {
    /**
     * Monta as queries SQL necessárias baseadas nos campos solicitados.
     * Retorna um objeto onde as chaves são os sufixos (DI, NE, etc) e os valores são as queries.
     */
    buildQuery(camposSolicitados = [], filtrosEncontrados = {}, anos = [2026]) {
        if (!Array.isArray(anos)) anos = [anos];

        // 1. Validação dos campos solicitados
        validateFields(camposSolicitados);

        const entidadesSolicitadas = camposSolicitados.filter(c => ENTITY_COLUMNS.includes(c));
        const valoresSolicitados   = camposSolicitados.filter(c => VALUE_COLUMNS.includes(c));

        validateValueFields(valoresSolicitados);

        // 2. Processamento dos filtros
        const filtrosValidos = processFiltros(filtrosEncontrados);

        // 2.1 Identifica entidades que possuem ao menos um filtro inclusivo
        const entidadesFiltradasInclusivas = Object.keys(filtrosValidos).filter(entidade => {
            const valores = filtrosValidos[entidade];
            return valores.some(v => v.excluir === false || v.excluir === undefined);
        });

        // 3. Entidades finais
        const entidadesFinais = new Set([
            ...entidadesSolicitadas,
            ...entidadesFiltradasInclusivas
        ]);
        
        // Remove 'periodo' das entidades finais para select/group, pois é apenas um filtro temporal
        entidadesFinais.delete("periodo");

        validateEntities(entidadesFinais);

        // 4. Separação hierárquicos x independentes
        const { hierarquicos, independentes } = separateFiltros(filtrosValidos);

        // 5. Agrupamento de valores por sufixo
        const valoresPorSufixo = {};
        for (const val of valoresSolicitados) {
            const sufixo = COLUMN_TO_SUFFIX[val];
            if (!valoresPorSufixo[sufixo]) valoresPorSufixo[sufixo] = [];
            valoresPorSufixo[sufixo].push(val);
        }

        // Se não houver valores específicos mas houver busca por entidade (ex: listar UGs), 
        // usamos um sufixo padrão (OB ou o primeiro disponível)
        if (Object.keys(valoresPorSufixo).length === 0) {
            valoresPorSufixo["OB"] = []; 
        }

        const queries = {};

        for (const [sufixo, valoresDoSufixo] of Object.entries(valoresPorSufixo)) {
            const dataReferencia = SUFFIX_TO_DATE_COLUMN[sufixo] ? `"${SUFFIX_TO_DATE_COLUMN[sufixo]}"` : null;
            
            const { selectParts, groupByParts } = buildSelectAndGroupBy(entidadesFinais, valoresDoSufixo, dataReferencia);
            const { whereClause, params: baseParams } = buildWhere(hierarquicos, independentes, filtrosEncontrados, dataReferencia);
            const orderClause = buildOrderBy(entidadesFinais, selectParts, dataReferencia);

            // Colunas brutas para o UNION
            const rawColumns = new Set();
            for (const entidade of entidadesFinais) {
                if (entidade.startsWith("agrupamento_") && dataReferencia) {
                    rawColumns.add(dataReferencia.replace(/"/g, ''));
                } else if (!entidade.startsWith("agrupamento_")) {
                    rawColumns.add(entidade);
                }
            }
            for (const val of valoresDoSufixo) {
                rawColumns.add(val);
            }

            const rawSelectList = rawColumns.size > 0 
                ? Array.from(rawColumns).map(c => `"${c}"`).join(", ")
                : "1 AS dummy";

            const anoAtual = new Date().getFullYear();
            const cutoffAnoAtual = dataReferencia ? this._calcularCutoffAnoAtual(entidadesFinais, dataReferencia) : null;

            const unionQueries = [];
            const finalParams = [];

            for (const anoLoop of anos) {
                const tempTable = `"${anoLoop}${sufixo}"`;

                if (anoLoop === anoAtual && cutoffAnoAtual && dataReferencia) {
                    const separator = whereClause.trim().toUpperCase().startsWith('WHERE') ? 'AND' : 'WHERE';
                    const whereComCutoff = `${whereClause} ${separator} ${dataReferencia} <= ?`;
                    unionQueries.push(`SELECT ${rawSelectList} FROM ${tempTable} ${whereComCutoff}`);
                    finalParams.push(...baseParams, cutoffAnoAtual);
                } else {
                    unionQueries.push(`SELECT ${rawSelectList} FROM ${tempTable} ${whereClause}`);
                    finalParams.push(...baseParams);
                }
            }

            const joinedUnions = unionQueries.join("\n                UNION ALL\n                ");

            const sql = `
                SELECT ${selectParts.join(", ")}
                FROM (
                    ${joinedUnions}
                ) AS base
                ${groupByParts.length > 0 ? `GROUP BY ${groupByParts.join(", ")}` : ""}
                ${orderClause}
                LIMIT 100
            `.trim().replace(/\s+/g, ' ');

            queries[sufixo] = { sql, params: finalParams, groupByParts };
        }

        return { queries, valoresSolicitados };
    }

    /**
     * Executa as queries e consolida os resultados.
     */
    async executar(buildResult) {
        const { queries, valoresSolicitados } = buildResult;
        const resultsBySuffix = {};
        const allSuffixes = Object.keys(queries);

        // Executa todas em paralelo
        await Promise.all(allSuffixes.map(async (sufixo) => {
            const { sql, params } = queries[sufixo];
            const result = await knex.raw(sql, params);
            resultsBySuffix[sufixo] = result.rows;
        }));

        if (allSuffixes.length === 1 && Object.keys(resultsBySuffix).length === 1) {
            return resultsBySuffix[allSuffixes[0]];
        }

        return this._mergeResults(resultsBySuffix, queries, valoresSolicitados);
    }

    /**
     * Une múltiplos conjuntos de resultados baseando-se nas colunas de agrupamento (entidades).
     */
    _mergeResults(resultsBySuffix, queries, valoresSolicitados) {
        const mergedMap = new Map();
        const allSuffixes = Object.keys(resultsBySuffix);
        const requestedSomaFields = new Set(valoresSolicitados.map(v => `soma_${v}`));

        for (const sufixo of allSuffixes) {
            const rows = resultsBySuffix[sufixo];
            const { groupByParts } = queries[sufixo];

            for (const row of rows) {
                // Cria uma chave única baseada nos valores das colunas de agrupamento
                const keyParts = groupByParts.map(col => {
                    const cleanCol = col.replace(/"/g, '');
                    return `${cleanCol}:${row[cleanCol]}`;
                });
                const key = keyParts.join('|');

                if (!mergedMap.has(key)) {
                    // Inicializa o objeto com as colunas de entidade
                    const baseObj = {};
                    groupByParts.forEach(col => {
                        const cleanCol = col.replace(/"/g, '');
                        baseObj[cleanCol] = row[cleanCol];
                    });
                    // Inicializa APENAS os campos de valor que foram solicitados
                    requestedSomaFields.forEach(field => baseObj[field] = 0);
                    mergedMap.set(key, baseObj);
                }

                const target = mergedMap.get(key);
                // Copia os valores específicos deste sufixo, se foram solicitados
                Object.keys(row).forEach(field => {
                    if (field.startsWith('soma_') && requestedSomaFields.has(field)) {
                        target[field] = row[field];
                    }
                });
            }
        }

        return Array.from(mergedMap.values());
    }

    _calcularCutoffAnoAtual(entidadesFinais, dataReferencia) {
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = hoje.getMonth(); 

        if (entidadesFinais.has("agrupamento_mensal")) {
            return new Date(ano, mes, 0).toISOString().split('T')[0];
        }

        if (entidadesFinais.has("agrupamento_bimestral")) {
            const bimestreAnterior = Math.floor(mes / 2);
            return new Date(ano, bimestreAnterior * 2, 0).toISOString().split('T')[0];
        }

        if (entidadesFinais.has("agrupamento_trimestral")) {
            const trimestreAnterior = Math.floor(mes / 3);
            return new Date(ano, trimestreAnterior * 3, 0).toISOString().split('T')[0];
        }

        if (entidadesFinais.has("agrupamento_semestral")) {
            const semestreAnterior = Math.floor(mes / 6);
            return new Date(ano, semestreAnterior * 6, 0).toISOString().split('T')[0];
        }

        return hoje.toISOString().split('T')[0];
    }
}

module.exports = QueryService;
