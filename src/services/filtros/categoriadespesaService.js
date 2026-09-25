const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "categoria_despesa.csv");

const PERCENTUAL_PADRAO = 0.7;

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

/**
 * Service responsável por:
 * - carregar o CSV de categorias de despesa
 * - manter os dados em memória com índice invertido
 * - extrair categorias de despesa a partir de uma frase
 *
 * REGRA ESPECIAL:
 * - só permite busca por CÓDIGO se a frase contiver "categoria_despesa"
 */
class CategoriaDespesaService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "categoria_despesa.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "categoria_despesa.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const categorias = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(categorias.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorCategoria = new Map();

        for (const categoria of categorias) {
            const tokens = normalize(categoria.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            tokensPorCategoria.set(categoria.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(categoria);
            }
        }

        this.dadosPorAno[ano] = { categorias, mapaPorCodigo, indiceDescricao, tokensPorCategoria };
    }

    /**
     * Lê o CSV e transforma em objetos
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
     * Extrai categorias de despesa de uma frase:
     * 1. Por código (CONDICIONAL) — O(matches)
     * 2. Por descrição             — O(tokens × hits) via índice invertido
     */
    extrair(frase, anosSolicitados = []) {
        
        if (!anosSolicitados || anosSolicitados.length === 0) {
            anosSolicitados = [new Date().getFullYear().toString()];
        } else {
            anosSolicitados = anosSolicitados.map(a => a.toString());
        }

        const resultadosFinais = [];
        const encontradosGlobais = new Set();
        
        for (const ano of anosSolicitados) {
            const dadosAno = this.dadosPorAno[ano];
            if (!dadosAno) continue;
            
            // Variáveis locais para o algoritmo original
            const encontrados = encontradosGlobais;
            const resultados = resultadosFinais;


        const textoNormalizado = normalize(frase);

        // ─────────────────────────────────────────
        // 🔐 REGRA: permite busca por código?
        // ─────────────────────────────────────────
        const permiteBuscaPorCodigo =
            textoNormalizado.includes("categoria_despesa");

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO (CONDICIONAL)
        // ─────────────────────────────────────────
        if (permiteBuscaPorCodigo) {
            // Aceita SOMENTE um dígito isolado
            const codigos = frase.match(/\b\d\b/g) || [];

            for (const codigo of codigos) {
                const categoria = dadosAno.mapaPorCodigo.get(codigo);

                if (categoria && !encontrados.has(codigo)) {
                    resultados.push({
                        codigo: categoria.codigo,
                        descricao: categoria.descricao,
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

        // Conta quantos tokens de cada categoria aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const categoria of candidatos) {
                if (encontrados.has(categoria.codigo)) continue;
                contagem.set(categoria.codigo, (contagem.get(categoria.codigo) || 0) + 1);
            }
        }

        // Aplica threshold de 70%
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorCategoria.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= PERCENTUAL_PADRAO) {
                const categoria = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: categoria.codigo,
                    descricao: categoria.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = CategoriaDespesaService;
