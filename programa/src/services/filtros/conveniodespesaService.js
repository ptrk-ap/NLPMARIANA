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
        // Carrega CSV uma única vez
        this.convenios = this.carregarCsv(caminhoCsv);

        // Índice rápido por código — O(1)
        this.mapaPorCodigo = new Map(
            this.convenios.map(c => [c.codigo, c])
        );
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
    extrair(frase) {
        if (!frase) return [];

        // Trigger obrigatório
        if (!frase.includes("convenio_despesa")) return [];

        const resultados = [];
        const encontrados = new Set();

        // 🔐 Captura exatamente 6 dígitos (mesmo colado)
        const codigos = frase.match(/(?<!\d)\d{6}(?!\d)/g) || [];

        for (const codigo of codigos) {
            const convenio = this.mapaPorCodigo.get(codigo);

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

        return resultados;
    }
}

module.exports = ConvenioDespesaService;
