const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "funcao.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.7;

const REGRAS_SENSIBILIDADE = [
    { palavra: "funcao", percentual: 0.5 }
];

/**
 * Normaliza texto para comparação:
 * - lowercase
 * - remove acentos
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

class FuncaoService {

    constructor() {
        // Carrega CSV uma única vez
        this.funcoes = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.funcoes.map(f => [f.codigo, f])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [funcao, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por função — usados para calcular o threshold
        this.tokensPorFuncao = new Map();

        for (const funcao of this.funcoes) {
            const tokens = normalize(funcao.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorFuncao.set(funcao.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(funcao);
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
     * Extrai funções de uma frase.
     * 🔒 Só executa se a palavra "funcao" estiver presente.
     *
     * 1. Por código    — O(matches)
     * 2. Por descrição — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // 🔐 REGRA GLOBAL: só permite qualquer busca se tiver "funcao"
        if (!textoNormalizado.includes("funcao")) return [];

        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{1,2}\b/g) || [];

        for (const codigo of codigos) {
            const funcao = this.mapaPorCodigo.get(codigo);

            if (funcao && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: funcao.codigo,
                    descricao: funcao.descricao,
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

        // Conta quantos tokens de cada função aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const funcao of candidatos) {
                if (encontrados.has(funcao.codigo)) continue;
                contagem.set(funcao.codigo, (contagem.get(funcao.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorFuncao.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const funcao = this.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: funcao.codigo,
                    descricao: funcao.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        return resultados;
    }
}

module.exports = FuncaoService;
