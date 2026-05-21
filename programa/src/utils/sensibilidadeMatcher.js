/**
 * Decide o percentual mínimo de match com base na frase
 *
 * @param {string} fraseNormalizada
 * @param {number} percentualPadrao
 * @param {Array<{ palavra: string, percentual: number }>} regras
 */
function resolverPercentualMinimo(
    fraseNormalizada,
    percentualPadrao,
    regras = []
) {
    for (const regra of regras) {
        if (fraseNormalizada.includes(regra.palavra)) {
            return regra.percentual;
        }
    }

    return percentualPadrao;
}

module.exports = { resolverPercentualMinimo };
