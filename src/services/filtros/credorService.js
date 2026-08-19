const pool = require("../../database/connection");
const fs = require("fs");
const path = require("path");

// ===== Carrega Dicionário =====
const credorDict = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../../data/entidades/credor.json"), "utf-8")
);

const SOBRENOMES = new Set(credorDict.sobrenomes.map(s => s.toUpperCase()));
const CNPJ_TERMOS = new Set(credorDict.cnpj_termos.map(t => t.toUpperCase()));

// ===== Stopwords =====
const STOPWORDS = new Set([
    "unidade_gestora", "fonte", "natureza_despesa", "programa", "acao",
    "unidade_orcamentaria", "elemento_despesa", "grupo_despesa",
    "categoria_despesa", "funcao", "dotacao_inicial", "despesas_empenhadas",
    "despesas_liquidadas", "despesas_pagas", "despesas_exercicio_pagas",
    "ods", "eixo", "poder", "emenda", "contrato", "convenio_despesa",
    "convenio_receita", "a", "ante", "apos", "ate", "com", "contra", "de",
    "desde", "em", "entre", "para", "por", "perante", "sem", "sobre",
    "agrupamento_mensal", "agrupamento_bimestral", "agrupamento_trimestral", "agrupamento_semestral"
]);

function prepararTermo(text) {
    return text
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/Ç/g, "C")
        .replace(/[^\w\s]/g, "") 
        .trim();
}

// ===== Controle de inicialização da extensão unaccent =====
// Garante que o CREATE EXTENSION rode apenas uma vez por ciclo de vida do processo,
// não a cada chamada de extrair().
let unaccentReadyPromise = null;

function garantirExtensaoUnaccent() {
    if (!unaccentReadyPromise) {
        unaccentReadyPromise = pool.raw("CREATE EXTENSION IF NOT EXISTS unaccent;")
            .then(() => {
                console.log("[CredorService] Extensão 'unaccent' verificada/criada com sucesso.");
            })
            .catch((err) => {
                // Se falhar (ex: usuário sem permissão de superuser), loga o erro mas não
                // derruba a aplicação — a extensão pode já ter sido criada manualmente por um DBA.
                console.error("[CredorService] Falha ao criar extensão 'unaccent'. Verifique se ela já existe ou se o usuário do banco tem permissão. Erro:", err.message);
                // Reseta a promise para tentar novamente na próxima chamada, caso o problema seja transitório.
                unaccentReadyPromise = null;
            });
    }
    return unaccentReadyPromise;
}

class CredorService {

    async extrair(frase) {
        // Garante que a extensão unaccent esteja disponível antes de qualquer busca textual.
        await garantirExtensaoUnaccent();

        const fraseNormalizada = prepararTermo(frase);


        // ============================================================
        // 1️⃣ PRIORIDADE: CPF ou CNPJ (Busca exata por código)
        // ============================================================
        const numerosNaFrase = fraseNormalizada.match(/\b\d{11}\b|\b\d{14}\b/g) || [];

        if (numerosNaFrase.length > 0) {
            const rows = await pool("credor")
                .select("codigo", "descricao")
                .whereIn("codigo", numerosNaFrase)
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


        const termosValidos = palavras.filter(t =>
            t.length > 2 &&
            !STOPWORDS.has(t.toLowerCase())
        );

        const temPalavraCredor = termosValidos.includes("CREDOR");

        // Remove a palavra 'CREDOR' para não buscar por ela no banco
        const termosParaBusca = termosValidos.filter(t => t !== "CREDOR");


        // Verificação por dicionário
        const temSobrenome = termosParaBusca.some(t => SOBRENOMES.has(t));
        const temTermoCnpj = termosParaBusca.some(t => CNPJ_TERMOS.has(t));

        // ============================================================
        // 3️⃣ BUSCA TEXTUAL (Caso tenha a trigger 'CREDOR' ou termos conhecidos)
        // ============================================================
        if (temPalavraCredor || temSobrenome || temTermoCnpj) {

            if (termosParaBusca.length === 0) return [];

            // Identificar o trecho mínimo na frase (aproximado usando bound index da frase normalizada)
            const firstIdx = Math.min(...termosParaBusca.map(t => fraseNormalizada.indexOf(t)).filter(idx => idx !== -1));
            const lastIdx = termosParaBusca.reduce((last, t) => {
                const idx = fraseNormalizada.indexOf(t) + t.length;
                return idx > last ? idx : last;
            }, -1);

            let trechoMinimo = frase;
            if (firstIdx !== Infinity && firstIdx !== -1 && lastIdx !== -1) {
                // Em JS, devido a normalizações, os tamanhos podem variar sutilmente, mas é seguro na maioria dos casos.
                trechoMinimo = frase.substring(firstIdx, lastIdx).trim();
            }

            /**
             * SOLUÇÃO PARA DELMA CARMO CAMARAO:
             * Usamos ILIKE com unaccent() dos dois lados (coluna e termo buscado) para que
             * acentos no banco (ex: "CONTÁBIL", "CAMARÃO") não impeçam o match contra termos
             * de busca já normalizados sem acento pela função prepararTermo().
             * O AND garante que TODOS os termos (Delma, Carmo, Camarao) estejam na descrição.
             */
            let query = pool("credor").select("codigo", "descricao");

            termosParaBusca.forEach(t => {
                query = query.whereRaw("unaccent(descricao) ILIKE unaccent(?)", [`%${t}%`]);
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

module.exports = CredorService;
