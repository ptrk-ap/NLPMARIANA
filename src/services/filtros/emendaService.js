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
    "agrupamento_mensal", "agrupamento_bimestral", "agrupamento_trimestral", "agrupamento_semestral"
]);

function prepararTermo(text) {
    return text
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Ç/g, "C")
        .trim();
}

class EmendaService {

    async extrair(frase) {
        const fraseNormalizada = prepararTermo(frase);

        // ============================================================
        // 1️⃣ PRIORIDADE: Códigos de emenda específicos (Busca exata por código)
        // RegEx para códigos como E0000, I0090, IE0464, etc.
        // ============================================================
        const regexCodigoEmenda = /\b(?:E|I|IE)\d{4}\b/g;
        const codigosNaFrase = fraseNormalizada.match(regexCodigoEmenda) || [];

        if (codigosNaFrase.length > 0) {
            const rows = await pool("emendas")
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
        // 2️⃣ PREPARAÇÃO DOS TERMOS TEXTUAIS
        // ============================================================
        const palavras = fraseNormalizada.split(/\s+/);

        const temPalavraEmenda = palavras.includes("EMENDA") || palavras.includes("EMENDAS");

        if (temPalavraEmenda) {
            const termosValidos = palavras.filter(t =>
                t.length > 2 &&
                !STOPWORDS.has(t.toLowerCase())
            );

            // Remove as variações da palavra "emenda" para não usá-las como termo de busca no banco
            const termosParaBusca = termosValidos.filter(t => t !== "EMENDA" && t !== "EMENDAS");

            if (termosParaBusca.length === 0) {
                // Se a palavra EMENDA está na frase mas não há termos de busca (ex: "sem emendas" ou "por emenda"),
                // retornamos o valor padrão acompanhado de uma flag.
                // O FiltroService decidirá se mantém esse filtro baseado no contexto de exclusão.
                return [{
                    codigo: "E0000",
                    descricao: "Não definida",
                    trecho_encontrado: "emenda",
                    autoGerado: true
                }];
            }

            // Identificar o trecho mínimo na frase original (aproximado usando bound index da frase normalizada)
            const firstIdx = Math.min(...termosParaBusca.map(t => fraseNormalizada.indexOf(t)).filter(idx => idx !== -1));
            const lastIdx = termosParaBusca.reduce((last, t) => {
                const idx = fraseNormalizada.indexOf(t) + t.length;
                return idx > last ? idx : last;
            }, -1);

            let trechoMinimo = frase;
            if (firstIdx !== Infinity && firstIdx !== -1 && lastIdx !== -1) {
                // Preservar a capitalizacao e pontuacoes baseadas apenas no substring inicial original da frase
                trechoMinimo = frase.substring(firstIdx, lastIdx).trim();
            }

            let query = pool("emendas").select("codigo", "descricao");

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

module.exports = EmendaService;
