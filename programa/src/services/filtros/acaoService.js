const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "acao.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.7;
const REGRAS_SENSIBILIDADE = [
    { palavra: "acao", percentual: 0.5 }
];

/**
 * Normaliza texto para comparação
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

class AcaoService {

    constructor() {
        // Carrega CSV uma única vez
        this.acoes = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.acoes.map(a => [a.codigo, a])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [acao, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por ação — usados para calcular o threshold
        this.tokensPorAcao = new Map();

        for (const acao of this.acoes) {
            const tokens = normalize(acao.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorAcao.set(acao.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(acao);
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
                const partes = linha.split(",");
                const codigo = partes[0];
                const descricao = partes.slice(1).join(",");

                return {
                    codigo: (codigo || "").trim(),
                    descricao: (descricao || "").trim()
                };
            })
            .filter(item =>
                /^\d{4}$/.test(item.codigo) &&
                item.descricao
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
     * Extrai ações de uma frase:
     * 1. Por código    — O(matches)
     * 2. Por descrição — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // 🔐 REGRA GLOBAL: só executa se "acao" estiver presente
        if (!/\bacao\b/.test(textoNormalizado)) return [];

        const temPrograma = /\bprograma\b/.test(textoNormalizado);

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{4}\b/g) || [];

        for (const codigo of codigos) {
            if (temPrograma) continue;

            const acao = this.mapaPorCodigo.get(codigo);

            if (acao && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: acao.codigo,
                    descricao: acao.descricao,
                    trecho_encontrado: codigo
                });
                encontrados.add(codigo);
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────
        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        if (temPrograma) return resultados;

        // Conjunto de tokens relevantes da frase (len > 3)
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3)
        );

        // Conta quantos tokens de cada ação aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const acao of candidatos) {
                if (encontrados.has(acao.codigo)) continue;
                contagem.set(acao.codigo, (contagem.get(acao.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorAcao.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const acao = this.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: acao.codigo,
                    descricao: acao.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        return resultados;
    }
}

module.exports = AcaoService;
