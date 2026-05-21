const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "grupo_despesa.csv");

const PERCENTUAL_PADRAO = 0.6;

/**
 * Normaliza texto para comparação:
 * - lowercase
 * - remove acentos
 * - facilita match com input do usuário
 */
function normalize(text) {
    return text
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

/**
 * Service responsável por:
 * - carregar o CSV de grupos de despesa
 * - manter os dados em memória com índice invertido
 * - extrair grupos de despesa a partir de uma frase
 *
 * REGRA ESPECIAL:
 * - só permite busca por CÓDIGO se a frase contiver "grupo_despesa"
 */
class GrupoDespesaService {

    constructor() {
        // Carrega o CSV uma única vez ao iniciar o serviço
        this.grupos = this.carregarCsv(caminhoCsv);

        // Índice por código — O(1)
        this.mapaPorCodigo = new Map(
            this.grupos.map(g => [g.codigo, g])
        );

        // Índice invertido por token de descrição — evita loop O(N) na busca
        // token → [grupo, ...]
        this.indiceDescricao = new Map();

        // Tokens pré-computados por grupo — usados para calcular o threshold
        this.tokensPorGrupo = new Map();

        for (const grupo of this.grupos) {
            const tokens = normalize(grupo.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            this.tokensPorGrupo.set(grupo.codigo, tokens);

            for (const token of tokens) {
                if (!this.indiceDescricao.has(token)) {
                    this.indiceDescricao.set(token, []);
                }
                this.indiceDescricao.get(token).push(grupo);
            }
        }
    }

    /**
     * Lê o arquivo CSV e transforma em matriz de objetos
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
            // 🔥 FILTRO CRÍTICO
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
     * Extrai grupos de despesa de uma frase:
     * 1. Por código (CONDICIONAL) — O(matches)
     * 2. Por descrição             — O(tokens × hits) via índice invertido
     */
    extrair(frase) {
        const resultados = [];
        const encontrados = new Set();

        const textoNormalizado = normalize(frase);

        // ─────────────────────────────────────────
        // 🔐 REGRA: permite busca por código?
        // ─────────────────────────────────────────
        const permiteBuscaPorCodigo = textoNormalizado.includes("grupo_despesa");

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO (CONDICIONAL)
        // ─────────────────────────────────────────
        if (permiteBuscaPorCodigo) {
            // Aceita SOMENTE um dígito isolado (ex: "1", "3", "9")
            const codigos = frase.match(/\b\d\b/g) || [];

            for (const codigo of codigos) {
                const grupo = this.mapaPorCodigo.get(codigo);

                if (grupo && !encontrados.has(codigo)) {
                    resultados.push({
                        codigo: grupo.codigo,
                        descricao: grupo.descricao,
                        trecho_encontrado: codigo
                    });
                    encontrados.add(codigo);
                }
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────

        // Conjunto de tokens relevantes da frase (len > 3)
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3)
        );

        // Conta quantos tokens de cada grupo aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = this.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const grupo of candidatos) {
                if (encontrados.has(grupo.codigo)) continue;
                contagem.set(grupo.codigo, (contagem.get(grupo.codigo) || 0) + 1);
            }
        }

        // Aplica threshold de 60%
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = this.tokensPorGrupo.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= PERCENTUAL_PADRAO) {
                const grupo = this.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: grupo.codigo,
                    descricao: grupo.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        return resultados;
    }
}

module.exports = GrupoDespesaService;
