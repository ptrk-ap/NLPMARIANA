const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "poder.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.7;

const REGRAS_SENSIBILIDADE = [
    { palavra: "poder", percentual: 0.5 }
];

/**
 * Normaliza texto para comparação:
 * - lowercase
 * - remove acentos
 * - trim
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Remove zeros à esquerda.
 * Permite aceitar 01 ou 1.
 */
function normalizarCodigo(codigo) {
    return String(parseInt(codigo, 10));
}

class PoderService {

    constructor() {
        // Carrega CSV uma única vez
        this.poderes = this.carregarCsv(caminhoCsv);

        // Índice por código normalizado — O(1)
        this.mapaPorCodigo = new Map(
            this.poderes.map(p => [
                normalizarCodigo(p.codigo),
                p
            ])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [poder, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por poder — usados para calcular o threshold
        // Chave: normalizarCodigo(poder.codigo) — mesma chave do mapaPorCodigo
        this.tokensPorPoder = new Map();

        for (const poder of this.poderes) {
            const codigoNorm = normalizarCodigo(poder.codigo);

            const tokens = normalize(poder.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorPoder.set(codigoNorm, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(poder);
            }
        }
    }

    /**
     * Lê o CSV e transforma em objetos
     */
    carregarCsv(caminho) {
        const conteudo = fs.readFileSync(caminho, "utf8");

        return conteudo
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(1)
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
                item.codigo !== "-" &&
                item.descricao !== "-"
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
     * Extrai poderes de uma frase.
     *
     * 🔒 REGRA:
     * Só executa busca se a palavra "poder"
     * estiver explicitamente presente na frase.
     *
     * 1. Por código    — O(matches)
     * 2. Por descrição — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // 🔐 Se não mencionar explicitamente "poder", não busca nada
        if (!/\bpoder\b/.test(textoNormalizado)) return [];

        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{1,2}\b/g) || [];

        for (const codigoBruto of codigos) {
            const codigoNormalizado = normalizarCodigo(codigoBruto);
            const poder = this.mapaPorCodigo.get(codigoNormalizado);

            if (poder && !encontrados.has(codigoNormalizado)) {
                resultados.push({
                    codigo: poder.codigo,
                    descricao: poder.descricao,
                    trecho_encontrado: codigoBruto
                });
                encontrados.add(codigoNormalizado);
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────

        // Conjunto de tokens relevantes da frase (len > 3)
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3)
        );

        // Conta quantos tokens de cada poder aparecem na frase
        const contagem = new Map(); // codigoNorm → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const poder of candidatos) {
                const codigoNorm = normalizarCodigo(poder.codigo);
                if (encontrados.has(codigoNorm)) continue;
                contagem.set(codigoNorm, (contagem.get(codigoNorm) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigoNorm, hits] of contagem) {
            const palavrasTotais = this.tokensPorPoder.get(codigoNorm);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const poder = this.mapaPorCodigo.get(codigoNorm);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: poder.codigo,
                    descricao: poder.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigoNorm);
            }
        }

        return resultados;
    }
}

module.exports = PoderService;
