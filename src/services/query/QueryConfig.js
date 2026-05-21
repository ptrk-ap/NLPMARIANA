const HIERARCHY_LEVEL = {
    poder: 1,
    unidade_gestora: 2,
    unidade_orcamentaria: 3
};

const ENTITY_COLUMNS = [
    "poder",
    "unidade_gestora",
    "unidade_orcamentaria",
    "eixo",
    "programa",
    "acao",
    "ods",
    "emenda",
    "funcao",
    "categoria_despesa",
    "grupo_despesa",
    "elemento_despesa",
    "natureza_despesa",
    "fonte",
    "convenio_receita",
    "convenio_despesa",
    "contrato",
    "credor",
    "ordem_bancaria",
    "nota_empenho",
    "nota_liquidacao",
    "agrupamento_mensal",
    "agrupamento_bimestral",
    "agrupamento_trimestral",
    "agrupamento_semestral",
    "agrupamento_diario",
    "agrupamento_anual"
];

const VALUE_COLUMNS = [
    "dotacao_inicial",
    "despesas_empenhadas",
    "despesas_liquidadas",
    "despesas_exercicio_pagas",
    "despesas_pagas"
];

const ORDER_PRIORITY = [
    "soma_despesas_empenhadas",
    "soma_despesas_liquidadas",
    "soma_despesas_pagas",
    "soma_despesas_exercicio_pagas"
];

const COLUMN_TO_SUFFIX = {
    dotacao_inicial: "DI",
    nota_empenho: "NE",
    despesas_empenhadas: "NE",
    nota_liquidacao: "NL",
    despesas_liquidadas: "NL",
    ordem_bancaria: "OB",
    despesas_pagas: "OB",
    despesas_exercicio_pagas: "OB"
};

const SUFFIX_TO_DATE_COLUMN = {
    DI: null, // DI usually doesn't have a specific document date in the same way, but common entity columns exist
    NE: "nota_empenho",
    NL: "nota_liquidacao",
    OB: "ordem_bancaria"
};

module.exports = {
    HIERARCHY_LEVEL,
    ENTITY_COLUMNS,
    VALUE_COLUMNS,
    ORDER_PRIORITY,
    COLUMN_TO_SUFFIX,
    SUFFIX_TO_DATE_COLUMN
};
