const pool = require("../../database/connection");

// ===== Stopwords =====
const STOPWORDS = new Set([
    "unidade_gestora", "fonte", "natureza_despesa", "programa", "acao",
    "unidade_orcamentaria", "elemento_despesa", "grupo_despesa",
    "categoria_despesa", "funcao", "dotacao_inicial", "despesas_empenhadas",
    "despesas_liquidadas", "despesas_pagas", "despesas_exercicio_pagas",
    "ods", "eixo", "poder", "emenda", "contrato", "convenio_despesa",
    "convenio_receita", "a", "ante", "apos", "ate", "com", "contra", "de",
    "desde", "em", "entre", "para", "por", "perante", "sem", "sobre", "ao", "aos", "na", "no", "nas", "nos",
    "agrupamento_mensal", "agrupamento_bimestral", "agrupamento_trimestral", "agrupamento_semestral",
    "despesa", "despesas"
]);

function prepararTermo(text) {
    return text
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Ç/g, "C")
        .trim();
}

/**
 * Service responsável por extrair contratos da frase.
 * Segue o padrão do EmendaService: busca no banco de dados.
 */
class ContratoService {

    async extrair(frase) {
        const fraseNormalizada = prepararTermo(frase);

        // ============================================================
        // 1️⃣ PRIORIDADE: Códigos de contrato específicos (8 dígitos)
        // ============================================================
        const regexCodigoContrato = /\b\d{8}\b/g;
        const codigosNaFrase = fraseNormalizada.match(regexCodigoContrato) || [];

        if (codigosNaFrase.length > 0) {
            const rows = await pool("contratos")
                .select("codigo", "descricao")
                .whereIn("codigo", codigosNaFrase)
                .limit(10);

            if (rows.length > 0) {
                return rows.map(r => ({
                    codigo: r.codigo,
                    descricao: r.descricao,
                    trecho_encontrado: r.codigo
                }));
            }
        }

        // ============================================================
        // 2️⃣ PREPARAÇÃO DOS TERMOS TEXTUAIS (Se contiver "CONTRATO")
        // ============================================================
        const palavras = fraseNormalizada.split(/\s+/);
        const temPalavraContrato = palavras.some(p => p.startsWith("CONTRATO"));

        if (temPalavraContrato) {
            const termosValidos = palavras.filter(t =>
                t.length > 2 &&
                !STOPWORDS.has(t.toLowerCase())
            );

            // Remove variações da palavra "contrato" da busca textual
            const termosParaBusca = termosValidos.filter(t => !t.startsWith("CONTRATO"));

            if (termosParaBusca.length === 0) {
                // Se a palavra CONTRATO está na frase mas não há termos de busca (ex: "sem contratos" ou "por contrato"),
                // retornamos o valor padrão acompanhado de uma flag.
                // O FiltroService decidirá se mantém esse filtro baseado no contexto de exclusão.
                return [{
                    codigo: "00000000",
                    descricao: "SEM CONTRATO",
                    trecho_encontrado: "contrato",
                    autoGerado: true
                }];
            }

            // Identificar o trecho mínimo na frase original
            const firstIdx = Math.min(...termosParaBusca.map(t => fraseNormalizada.indexOf(t)).filter(idx => idx !== -1));
            const lastIdx = termosParaBusca.reduce((last, t) => {
                const idx = fraseNormalizada.indexOf(t) + t.length;
                return idx > last ? idx : last;
            }, -1);

            let trechoMinimo = frase;
            if (firstIdx !== Infinity && firstIdx !== -1 && lastIdx !== -1) {
                trechoMinimo = frase.substring(firstIdx, lastIdx).trim();
            }

            let query = pool("contratos").select("codigo", "descricao");

            termosParaBusca.forEach(t => {
                query = query.whereRaw("descricao ILIKE ?", [`%${t}%`]);
            });

            const rows = await query.limit(10);

            return rows.map(r => ({
                codigo: r.codigo,
                descricao: r.descricao,
                trecho_encontrado: trechoMinimo
            }));
        }

        return [];
    }
}

module.exports = ContratoService;

