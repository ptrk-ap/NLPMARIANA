const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "unidade_gestora.csv");

/**
 * Palavras ignoradas na busca
 */
const STOPWORDS = new Set([
    "estado",
    "estadual"
]);

/**
 * Padrão de código de unidade gestora (ex: 220010)
 * Centralizado para evitar duplicação.
 */
const REGEX_CODIGO_FRASE = /\b\d{2}0\d{3}\b/g;
const REGEX_CODIGO_VALIDO = /^\d{2}0\d{3}$/;

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

/**
 * Parser CSV simples com suporte a campos entre aspas.
 * Corrige o problema de vírgulas dentro de descrições.
 */
function parseCsvLinha(linha) {
    const campos = [];
    let atual = "";
    let dentroDeAspas = false;

    for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === '"') {
            dentroDeAspas = !dentroDeAspas;
        } else if (c === "," && !dentroDeAspas) {
            campos.push(atual.trim());
            atual = "";
        } else {
            atual += c;
        }
    }

    campos.push(atual.trim());
    return campos;
}

class UnidadeGestoraService {

    constructor() {
        // Carrega CSV uma única vez
        this.unidades = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.unidades.map(u => [u.codigo, u])
        );

        // Índice por mnemônico — O(1)
        this.mapaPorMnemonico = new Map(
            this.unidades.map(u => [normalize(u.mnemonico), u])
        );

        // Índice invertido por token de descrição — evita loop O(U) na busca
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
     * Lê CSV e transforma em objetos.
     * Usa parser com suporte a campos entre aspas.
     */
    carregarCsv(caminho) {
        const conteudo = fs.readFileSync(caminho, "utf8");

        return conteudo
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(1) // remove cabeçalho
            .map(linha => {
                const [codigo, mnemonico, ...resto] = parseCsvLinha(linha);

                return {
                    codigo: (codigo || "").trim(),
                    mnemonico: (mnemonico || "").trim(),
                    descricao: (resto.join(",") || "").trim()
                };
            })
            .filter(item =>
                item.codigo &&
                item.mnemonico &&
                item.descricao &&
                REGEX_CODIGO_VALIDO.test(item.codigo)
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
            // Normaliza o token sem reaplicar removeStopwords redundantemente
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
     * Extrai unidades gestoras de uma frase:
     * 1. Por código     — O(matches)
     * 2. Por mnemônico  — O(tokens)
     * 3. Por descrição  — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = removeStopwords(normalize(frase));

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(REGEX_CODIGO_FRASE) || [];

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
        // 2️⃣  BUSCA POR MNEMÔNICO
        // ─────────────────────────────────────────
        const tokens = textoNormalizado.split(/\s+/);

        for (const token of tokens) {
            const unidade = this.mapaPorMnemonico.get(token);
            if (unidade && !encontrados.has(unidade.codigo)) {
                resultados.push({
                    codigo: unidade.codigo,
                    descricao: unidade.descricao,
                    trecho_encontrado: token
                });
                encontrados.add(unidade.codigo);
            }
        }

        // ─────────────────────────────────────────
        // 3️⃣  BUSCA POR DESCRIÇÃO via índice invertido
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

        // Aplica threshold de 60% sobre os tokens da descrição
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorUnidade.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= 0.6) {
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

module.exports = UnidadeGestoraService;
