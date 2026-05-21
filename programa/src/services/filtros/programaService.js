const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "programa.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.9;

// 🔥 Regra apenas para a palavra "programa"
const REGRAS_SENSIBILIDADE = [
    { palavra: "programa", percentual: 0.5 }
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

class ProgramaService {

    constructor() {
        // Carrega CSV uma única vez
        this.programas = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.programas.map(p => [p.codigo, p])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [programa, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por programa — usados para calcular o threshold
        this.tokensPorPrograma = new Map();

        for (const programa of this.programas) {
            const tokens = normalize(programa.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorPrograma.set(programa.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(programa);
            }
        }
    }

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
     * Extrai programas de uma frase:
     * 1. Por código  — O(matches), com lógica de elegibilidade
     * 2. Por descrição — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // 🔐 REGRA GLOBAL: só executa se "programa" estiver presente
        if (!/\bprograma\b/.test(textoNormalizado)) return [];

        const temAcao = /\bacao\b/.test(textoNormalizado);

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{4}\b/g) || [];
        let existeCodigoInvalido = false;

        for (const codigo of codigos) {
            const numero = Number(codigo);

            const elegivel =
                codigo.startsWith("0") ||
                numero < 1000 ||
                numero === 9999;

            if (!elegivel) {
                existeCodigoInvalido = true;
                continue;
            }

            if (temAcao) continue;

            const programa = this.mapaPorCodigo.get(codigo);

            if (programa && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: programa.codigo,
                    descricao: programa.descricao,
                    trecho_encontrado: codigo
                });
                encontrados.add(codigo);
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────

        // Shortcircuit: não busca por descrição se houver ação ou código inválido
        if (temAcao || existeCodigoInvalido) return resultados;

        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        // Conjunto de tokens relevantes da frase (len > 3)
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3)
        );

        // Conta quantos tokens de cada programa aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const programa of candidatos) {
                if (encontrados.has(programa.codigo)) continue;
                contagem.set(programa.codigo, (contagem.get(programa.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorPrograma.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const programa = this.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: programa.codigo,
                    descricao: programa.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        return resultados;
    }
}

module.exports = ProgramaService;
