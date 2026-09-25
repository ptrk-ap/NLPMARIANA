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
 * - só permite qualquer busca (CÓDIGO ou DESCRIÇÃO) se a frase contiver "grupo_despesa"
 */
class GrupoDespesaService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "grupo_despesa.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "grupo_despesa.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const grupos = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(grupos.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorGrupo = new Map();

        for (const grupo of grupos) {
            const tokens = normalize(grupo.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            tokensPorGrupo.set(grupo.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(grupo);
            }
        }

        this.dadosPorAno[ano] = { grupos, mapaPorCodigo, indiceDescricao, tokensPorGrupo };
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
     * 1. Verifica se "grupo_despesa" está presente na frase. Se não estiver, cancela a busca.
     * 2. Por código      — O(matches)
     * 3. Por descrição  — O(tokens × hits) via índice invertido
     */
    extrair(frase, anosSolicitados = []) {
        const textoNormalizado = normalize(frase);

        // ─────────────────────────────────────────
        // 🔐 REGRA: "grupo_despesa" deve estar presente na frase
        // ─────────────────────────────────────────
        if (!textoNormalizado.includes("grupo_despesa")) {
            return [];
        }

        
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


        // ─────────────────────────────────────────
        // 1️⃣  BUSCA POR CÓDIGO
        // ─────────────────────────────────────────
        // Aceita SOMENTE um dígito isolado (ex: "1", "3", "9")
        const codigos = frase.match(/\b\d\b/g) || [];

        for (const codigo of codigos) {
            const grupo = dadosAno.mapaPorCodigo.get(codigo);

            if (grupo && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: grupo.codigo,
                    descricao: grupo.descricao,
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

        // Conta quantos tokens de cada grupo aparecem na frase
        const contagem = new Map(); // codigo → número de hits

        for (const token of tokensFrase) {
            const candidatos = dadosAno.indiceDescricao.get(token);
            if (!candidatos) continue;

            for (const grupo of candidatos) {
                if (encontrados.has(grupo.codigo)) continue;
                contagem.set(grupo.codigo, (contagem.get(grupo.codigo) || 0) + 1);
            }
        }

        // Aplica threshold de 60%
        for (const [codigo, hits] of contagem) {
            const palavrasTotais = dadosAno.tokensPorGrupo.get(codigo);
            const percentual = hits / palavrasTotais.length;

            if (percentual >= PERCENTUAL_PADRAO) {
                const grupo = dadosAno.mapaPorCodigo.get(codigo);
                const matchedTokens = palavrasTotais.filter(p => tokensFrase.has(p));

                resultados.push({
                    codigo: grupo.codigo,
                    descricao: grupo.descricao,
                    trecho_encontrado: this._extrairTrechoDescricao(frase, matchedTokens)
                });
                encontrados.add(codigo);
            }
        }

        }
        return resultadosFinais;
    }
}

module.exports = GrupoDespesaService;