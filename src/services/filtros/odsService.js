const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "ods.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.7;

const REGRAS_SENSIBILIDADE = [
    { palavra: "ods", percentual: 0.5 }
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

/**
 * Service responsável por:
 * - carregar o CSV de ODS
 * - manter os dados em memória com índice invertido
 * - extrair ODS a partir de uma frase
 *
 * REGRA ESPECIAL:
 * - só permite busca por CÓDIGO se a frase contiver "ods"
 */
class OdsService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "ods.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "ods.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const odsList = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(odsList.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorOds = new Map();

        for (const ods of odsList) {
            const tokens = normalize(ods.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            tokensPorOds.set(ods.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(ods);
            }
        }

        this.dadosPorAno[ano] = { odsList, mapaPorCodigo, indiceDescricao, tokensPorOds };
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
            const separador = linha.indexOf(",");

            const codigo = linha.slice(0, separador);
            const descricao = linha.slice(separador + 1);

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
     * Extrai ODS de uma frase:
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

        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        // ─────────────────────────────────────────
        // 🔐 REGRA: permite código?
        // ─────────────────────────────────────────
        const permiteBuscaPorCodigo = textoNormalizado.includes("ods");

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO (CONDICIONAL)
        // ─────────────────────────────────────────
        if (permiteBuscaPorCodigo) {
            // aceita 1 ou 2 dígitos isolados (0 a 17)
            const codigos = frase.match(/\b\d{1,2}\b/g) || [];

            for (const codigo of codigos) {
                const ods = dadosAno.mapaPorCodigo.get(codigo);

                if (ods && !encontrados.has(codigo)) {
                    resultados.push({
                        codigo: ods.codigo,
                        descricao: ods.descricao,
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

        // Conta quantos tokens de cada ODS aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const ods of candidatos) {
                if (encontrados.has(ods.codigo)) continue;
                contagem.set(ods.codigo, (contagem.get(ods.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorOds.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const ods = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: ods.codigo,
                    descricao: ods.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = OdsService;
