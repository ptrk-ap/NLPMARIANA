const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "unidade_gestora.csv");
const { resolverPercentualMinimo } = require("../../utils/sensibilidadeMatcher");

const PERCENTUAL_PADRAO = 0.9;

const REGRAS_SENSIBILIDADE = [
    { palavra: "unidade_gestora", percentual: 0.6 }
];

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
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "unidade_gestora.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "unidade_gestora.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const unidades = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(unidades.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorUnidade = new Map();

        for (const unidade of unidades) {
            const tokens = normalize(unidade.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            tokensPorUnidade.set(unidade.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(unidade);
            }
        }

        this.dadosPorAno[ano] = { unidades, mapaPorCodigo, indiceDescricao, tokensPorUnidade };
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
     * 3. Por descrição  — O(tokens × hits) via índice invertido com threshold dinâmico
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


        const textoNormalizado = removeStopwords(normalize(frase));

        // Define o percentual mínimo com base na presença das palavras de sensibilidade
        const percentualMinimo = resolverPercentualMinimo(
            textoNormalizado,
            PERCENTUAL_PADRAO,
            REGRAS_SENSIBILIDADE
        );

        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        const codigos = frase.match(REGEX_CODIGO_FRASE) || [];

        for (const codigo of codigos) {
            const unidade = dadosAno.mapaPorCodigo.get(codigo);
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
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const unidade of candidatos) {
                if (encontrados.has(unidade.codigo)) continue;
                contagem.set(unidade.codigo, (contagem.get(unidade.codigo) || 0) + 1);
            }
        }

        // Aplica threshold percentual dinâmico sobre os tokens da descrição
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorUnidade.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= percentualMinimo) {
                const unidade = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: unidade.codigo,
                    descricao: unidade.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = UnidadeGestoraService;