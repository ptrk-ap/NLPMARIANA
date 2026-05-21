const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "eixo.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.5;

const REGRAS_SENSIBILIDADE = [
    { palavra: "eixo", percentual: 0.5 }
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

class EixoService {

    constructor() {
        this.eixos = this.carregarCsv(caminhoCsv);

        // Índice por código normalizado — O(1)
        this.mapaPorCodigo = new Map(
            this.eixos.map(e => [
                normalizarCodigo(e.codigo),
                e
            ])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [eixo, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por eixo — usados para calcular o threshold
        this.tokensPorEixo = new Map();

        for (const eixo of this.eixos) {
            const tokens = normalize(eixo.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorEixo.set(eixo.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(eixo);
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
     * Extrai eixos de uma frase.
     *
     * 🔒 REGRA:
     * Só executa busca se a palavra "eixo"
     * estiver explicitamente presente na frase.
     *
     * 1. Por código    — O(matches)
     * 2. Por descrição — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // 🔐 Se não mencionar explicitamente "eixo", não busca nada
        if (!/\beixo\b/.test(textoNormalizado)) return [];

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
            const eixo = this.mapaPorCodigo.get(codigoNormalizado);

            if (eixo && !encontrados.has(codigoNormalizado)) {
                resultados.push({
                    codigo: eixo.codigo,
                    descricao: eixo.descricao,
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

        // Conta quantos tokens de cada eixo aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const eixo of candidatos) {
                const codigoNorm = normalizarCodigo(eixo.codigo);
                if (encontrados.has(codigoNorm)) continue;
                contagem.set(eixo.codigo, (contagem.get(eixo.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorEixo.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const eixo = this.mapaPorCodigo.get(normalizarCodigo(codigo));
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: eixo.codigo,
                    descricao: eixo.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(normalizarCodigo(codigo));
            }
        }

        return resultados;
    }
}

module.exports = EixoService;
