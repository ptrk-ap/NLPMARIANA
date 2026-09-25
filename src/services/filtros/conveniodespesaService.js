const fs = require("fs");
const path = require("path");
const caminhoCsv = path.join(__dirname, "..", "..", "data", "entidades", "convenio_despesa.csv");

/**
 * Service responsável por:
 * - carregar o CSV de convênios de despesa em memória
 * - extrair convênios a partir de uma frase
 *
 * ESTRATÉGIA: puramente por código (6 dígitos exatos).
 * Já otimizado: Map O(1) + trigger "convenio_despesa".
 */
class ConvenioDespesaService {

    
    constructor() {
        const anos = ["2024", "2025", "2026"];
        this.dadosPorAno = {};
        const pastaBase = path.join(__dirname, "..", "..", "data", "entidades");

        for (const ano of anos) {
            const caminho = path.join(pastaBase, ano, "convenio_despesa.csv");
            if (!fs.existsSync(caminho)) {
                const caminhoPadrao = path.join(pastaBase, "convenio_despesa.csv");
                if (fs.existsSync(caminhoPadrao)) {
                    this._carregarParaAno(ano, caminhoPadrao);
                }
                continue;
            }
            this._carregarParaAno(ano, caminho);
        }
    }

    _carregarParaAno(ano, caminho) {
        const convenios = this.carregarCsv(caminho);
        const mapaPorCodigo = new Map(convenios.map(x => [x.codigo, x]));
        const indiceDescricao = new Map();
        const tokensPorItem = new Map();

        for (const item of convenios) {
            const tokens = normalize(item.descricao)
                .split(/\s+/)
                .filter(p => p.length > 3);

            tokensPorItem.set(item.codigo, tokens);

            for (const token of tokens) {
                if (!indiceDescricao.has(token)) {
                    indiceDescricao.set(token, []);
                }
                indiceDescricao.get(token).push(item);
            }
        }

        this.dadosPorAno[ano] = { convenios, mapaPorCodigo, indiceDescricao, tokensPorItem };
    }

    /**
     * Lê o CSV e transforma em objetos.
     * Suporta descrições com vírgulas internas.
     */
    carregarCsv(caminho) {
        const conteudo = fs.readFileSync(caminho, "utf8");

        return conteudo
            .split(/\r?\n/)
            .filter(Boolean)
            .slice(1) // remove cabeçalho
            .map(linha => {
                const match = linha.match(/^([^,]+),(.*)$/);
                if (!match) return null;

                let codigo = match[1].trim();
                let descricao = match[2].trim();

                descricao = descricao.replace(/^"|"$/g, "");

                return { codigo, descricao };
            })
            .filter(Boolean);
    }

    /**
     * Extrai convênios de despesa de uma frase.
     *
     * 🔎 Só executa se contiver exatamente "convenio_despesa".
     * 🔐 Captura exatamente 6 dígitos.
     *
     * Complexidade: O(matches) — busca direta no Map.
     */
    extrair(frase, anosSolicitados = []) {
        if (!frase) return [];

        // Trigger obrigatório
        if (!frase.includes("convenio_despesa")) return [];

        
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


        // 🔐 Captura exatamente 6 dígitos (mesmo colado)
        const codigos = frase.match(/(?<!\d)\d{6}(?!\d)/g) || [];

        for (const codigo of codigos) {
            const convenio = dadosAno.mapaPorCodigo.get(codigo);

            if (convenio && !encontrados.has(codigo)) {
                resultados.push({
                    codigo: convenio.codigo,
                    descricao: convenio.descricao,
                    trecho_encontrado: codigo
                });
                encontrados.add(codigo);
            }
        }

        // Se a palavra CONVENIO está na frase mas não há códigos de busca (ex: "sem convenio" ou "por convenio"),
        // retornamos o valor padrão acompanhado de uma flag.
        if (resultados.length === 0) {
            return [
                {
                    codigo: "000000",
                    descricao: "- -",
                    trecho_encontrado: "convenio",
                    autoGerado: true
                },
                {
                    codigo: " - - - ",
                    descricao: "",
                    trecho_encontrado: "convenio",
                    autoGerado: true
                }
            ];
        }

        }
        return resultadosFinais;
    }
}

module.exports = ConvenioDespesaService;
