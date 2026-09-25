const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "fonte.csv");

const PERCENTUAL_PADRAO = 0.7;

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

class FonteService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "fonte.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "fonte.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const fontes = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(fontes.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorFonte = new Map();

        for (const fonte of fontes) {
            const tokens = normalize(fonte.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3 || p === "nao");

            tokensPorFonte.set(fonte.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(fonte);
            }
        }

        this.dadosPorAno[ano] = { fontes, mapaPorCodigo, indiceDescricao, tokensPorFonte };
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
                const [codigo, descricao] = linha.split(",");

                return {
                    codigo: (codigo || "").trim(),
                    descricao: (descricao || "").trim()
                };
            })
            // 🔥 FILTRO CRÍTICO
            .filter(item =>
                /^\d{3}$/.test(item.codigo) &&
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
     * Extrai fontes de uma frase:
     * 1. Por código    — O(matches)
     * 2. Por descrição — O(tokens × hits) via índice invertido
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
        // ─────────────────────────────────────────
        const codigos = frase.match(/\b\d{3}\b/g) || [];

        for (const codigo of codigos) {
            const fonte = dadosAno.mapaPorCodigo.get(codigo);

            if (fonte && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: fonte.codigo,
                    descricao: fonte.descricao,
                    trecho_encontrado: codigo
                });
                encontrados.add(codigo);
            }
        }

        // ─────────────────────────────────────────
        // 2️⃣  BUSCA POR DESCRIÇÃO via índice invertido
        // ─────────────────────────────────────────

        // Conjunto de tokens relevantes (len > 3 ou "nao")
        const tokensFrase = new Set(
            textoNormalizado.split(/\s+/).filter(p => p.length > 3 || p === "nao")
        );

        // Conta quantos tokens de cada fonte aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const fonte of candidatos) {
                if (encontrados.has(fonte.codigo)) continue;
                contagem.set(fonte.codigo, (contagem.get(fonte.codigo) || 0) + 1);
            }
        }

        // Aplica threshold de 70%
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorFonte.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= PERCENTUAL_PADRAO) {
                const fonte = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: fonte.codigo,
                    descricao: fonte.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = FonteService;
