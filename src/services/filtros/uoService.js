const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "unidade_orcamentaria.csv");

/**
 * Palavras ignoradas na busca
 */
const STOPWORDS = new Set([
    "estado",
    "estadual"
]);

const PERCENTUAL_PADRAO = 0.6;

/**
 * Normaliza texto para comparação:
 * - lowercase
 * - remove acentos
 * - remove pontuação
 * - trim
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, "")
        .trim();
}

/**
 * Remove stopwords do texto já normalizado
 */
function removeStopwords(text) {
    return text
        .split(/\s+/)
        .filter(p => !STOPWORDS.has(p))
        .join(" ");
}

class UnidadeOrcamentariaService {

    constructor() {
        // Carrega CSV uma única vez
        this.unidades = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.unidades.map(u => [u.codigo, u])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [unidade, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por unidade — usados para calcular o threshold
        this.tokensPorUnidade = new Map();

        for (const unidade of this.unidades) {
            const tokens = removeStopwords(normalize(unidade.descricao))
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorUnidade.set(unidade.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(unidade);
            }
        }
    }

    /**
     * Lê CSV e transforma em objetos
     */
    carregarCsv(caminho) {
        const conteudo = fs.readFileSync(caminho, "utf8");

        return conteudo
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(1) // remove cabeçalho
            .map(linha => {
                const [codigo, descricao] = linha.split(",");

                return {
                    codigo: (codigo || "").trim(),
                    descricao: (descricao || "").trim()
                };
            })
            .filter(item =>
                item.codigo &&
                item.descricao &&
                /^\d{5}$/.test(item.codigo)
            );
    }

    /**
     * Encontra o menor trecho contíguo da frase original que abrange
     * as palavras-chave encontradas.
     *
     * Complexidade: O(N) — uma única passagem pelos tokens da frase.
     */
    _extrairTrechoDescricao(fraseOriginal, palavrasMatch) {
        if (palavrasMatch.length === 0) return fraseOriginal;

        const setMatch = new Set(palavrasMatch);
        const tokensOriginais = fraseOriginal.split(/\s+/);

        let inicio = -1;
        let fim = -1;

        for (let i = 0; i < tokensOriginais.length; i++) {
            const tokenNorm = normalize(tokensOriginais[i]);

            if (setMatch.has(tokenNorm)) {
                if (inicio === -1) inicio = i;
                fim = i;
            }
        }

        if (inicio === -1) return fraseOriginal;

        return tokensOriginais.slice(inicio, fim + 1).join(" ");
    }

    /**
     * Extrai unidades orçamentárias de uma frase:
     * 1. Por código (5 dígitos) — O(matches)
     * 2. Por descrição           — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        // 🔥 Remove stopwords também da frase digitada
        const textoNormalizado = removeStopwords(normalize(frase));

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{5}\b/g) || [];

        for (const codigo of codigos) {
            const unidade = this.mapaPorCodigo.get(codigo);

            if (unidade && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: unidade.codigo,
                    descricao: unidade.descricao,
                    trecho_encontrado: codigo
                });
                encontrados.add(codigo);
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────

        // Conjunto de tokens relevantes da frase (len > 3)
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3)
        );

        // Conta quantos tokens de cada unidade aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const unidade of candidatos) {
                if (encontrados.has(unidade.codigo)) continue;
                contagem.set(unidade.codigo, (contagem.get(unidade.codigo) || 0) + 1);
            }
        }

        // Aplica threshold de 60%
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorUnidade.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= PERCENTUAL_PADRAO) {
                const unidade = this.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: unidade.codigo,
                    descricao: unidade.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        return resultados;
    }
}

module.exports = UnidadeOrcamentariaService;
