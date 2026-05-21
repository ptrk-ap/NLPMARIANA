const { ENTITY_COLUMNS, VALUE_COLUMNS } = require("./QueryConfig");

const ALL_ALLOWED = new Set([...ENTITY_COLUMNS, ...VALUE_COLUMNS]);

/**
 * Valida se todos os campos solicitados são permitidos.
 * Lança erro com os campos inválidos encontrados.
 */
function validateFields(fields = []) {
    const invalid = fields.filter(f => !ALL_ALLOWED.has(f));
    if (invalid.length) {
        throw new Error(`Campos inválidos: ${invalid.join(", ")}`);
    }
}

/**
 * Garante que ao menos um campo de valor foi solicitado.
 */
function validateValueFields(valoresSolicitados = []) {
    if (valoresSolicitados.length === 0) {
        throw new Error("É obrigatório informar ao menos um campo de valor.");
    }
}

/**
 * Garante que ao menos uma entidade foi informada.
 */
function validateEntities(entidadesFinais = new Set()) {
    if (entidadesFinais.size === 0) {
        throw new Error("É obrigatório informar ao menos uma entidade.");
    }
}

module.exports = {
    validateFields,
    validateValueFields,
    validateEntities
};
