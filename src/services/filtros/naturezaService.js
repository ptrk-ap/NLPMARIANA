const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "natureza_despesa.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.6;
const REGRAS_SENSIBILIDADE = [
    { palavra: "natureza_despesa", percentual: 0.4 }
];

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
 * - carregar o CSV de naturezas
 * - manter os dados em memória com índice invertido
 * - extrair naturezas de despesa a partir de uma frase
 */
class NaturezaService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "natureza_despesa.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "natureza_despesa.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const naturezas = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(naturezas.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorNatureza = new Map();

        for (const natureza of naturezas) {
            const tokens = normalize(natureza.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3 || p === "nao");

            tokensPorNatureza.set(natureza.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(natureza);
            }
        }

        this.dadosPorAno[ano] = { naturezas, mapaPorCodigo, indiceDescricao, tokensPorNatureza };
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
     * Extrai naturezas de uma frase:
     * 1. Por código (regex especial \d{2}[1-9]\d{3}) — O(matches)
     * 2. Por descrição                                 — O(tokens × hits) via índice invertido
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
        // 1️⃣  BUSCA POR CÓDIGO
        // Regex: 6 dígitos, com 3º dígito diferente de zero
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{2}[1-9]\d{3}\b/g) || [];

        for (const codigo of codigos) {
            const natureza = dadosAno.mapaPorCodigo.get(codigo);

            if (natureza && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: natureza.codigo,
                    descricao: natureza.descricao,
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

        // Conjunto de tokens relevantes (len > 3 ou "nao")
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3 || p === "nao")
        );

        // Conta quantos tokens de cada natureza aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const natureza of candidatos) {
                if (encontrados.has(natureza.codigo)) continue;
                contagem.set(natureza.codigo, (contagem.get(natureza.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorNatureza.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const natureza = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: natureza.codigo,
                    descricao: natureza.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = NaturezaService;
