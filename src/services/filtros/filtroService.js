// Importação dos serviços de entidades
const NaturezaService = require("./naturezaService");
const FonteService = require("./fonteService");
const UgService = require("./ugService");
const UoService = require("./uoService");
const ProgramaService = require("./programaService");
const AcaoService = require("./acaoService");
const ElementoService = require("./elementoService");
const GrupoDespesaService = require("./grupodespesaService");
const CategoriaDespesaService = require("./categoriadespesaService");
const FuncaoService = require("./funcaoService");
const OdsService = require("./odsService");
const EixoService = require("./eixoService");
const PoderService = require("./poderService");
const EmendaService = require("./emendaService");
const ContratoService = require("./contratoService");
const ConvenioDespesaService = require("./conveniodespesaService");
const ConvenioReceitaService = require("./convenioreceitaService");
const CredorService = require("./credorService");
const PeriodoService = require("./dateService");
const AnoService = require("./anoService");
const exclusaoFiltroService = require("./exclusaoFiltroService");

class FiltroService {
    constructor() {
        // Instanciamos os serviços uma única vez no construtor
        this.services = {
            ano: new AnoService(),
            periodo: new PeriodoService(),
            unidade_gestora: new UgService(),
            natureza_despesa: new NaturezaService(),
            fonte: new FonteService(),
            unidade_orcamentaria: new UoService(),
            programa: new ProgramaService(),
            acao: new AcaoService(),
            elemento_despesa: new ElementoService(),
            grupo_despesa: new GrupoDespesaService(),
            categoria_despesa: new CategoriaDespesaService(),
            funcao: new FuncaoService(),
            ods: new OdsService(),
            eixo: new EixoService(),
            poder: new PoderService(),
            emenda: new EmendaService(),
            contrato: new ContratoService(),
            convenio_despesa: new ConvenioDespesaService(),
            convenio_receita: new ConvenioReceitaService(),
            credor: new CredorService()
        };
    }

    /**
     * Grupos de entidades que devem ser processados em paralelo sobre o mesmo trecho.
     * Todas as entidades dentro de um grupo recebem o trecho original simultaneamente,
     * sem que uma remova do trecho o que a outra ainda precisa ler.
     *
     * Entidades fora destes grupos seguem o fluxo padrão em cascata.
     */
    static GRUPOS_PARALELOS = [
        ["unidade_gestora", "unidade_orcamentaria"],
        ["convenio_despesa", "convenio_receita"],

    ];

    /**
     * Analisa as partes da frase e retorna um objeto com os filtros encontrados.
     * Entidades em GRUPOS_PARALELOS são processadas simultaneamente sobre o mesmo
     * trecho; as demais seguem o fluxo cascata (cada serviço recebe o trecho já
     * reduzido pelos anteriores).
     *
     * @param {string[]} partesFraseOriginal - Array gerado pelo SplitService.
     * @returns {Promise<Object>} - Objeto contendo os resultados filtrados.
     */
    async processarFiltros(partesFraseOriginal) {
        // Cópia mutável para não alterar o array original recebido como parâmetro
        let partesFrase = [...partesFraseOriginal];

        // Inicializa o objeto de resultados baseado nas chaves dos serviços
        const filtrosEncontrados = {};
        Object.keys(this.services).forEach(chave => {
            filtrosEncontrados[chave] = [];
        });

        // 1. Extrai o "ano" de toda a frase primeiro (evita dessincronização cronológica)
        const fraseCompleta = partesFrase.join(" ");
        try {
            const anosEncontrados = await this.services.ano.extrair(fraseCompleta);
            if (anosEncontrados && anosEncontrados.length > 0) {
                anosEncontrados.forEach(res => {
                    res.excluir = exclusaoFiltroService.verificarExclusao(fraseCompleta, res.trecho_encontrado);
                });
                filtrosEncontrados.ano.push(...anosEncontrados);

                // Remove o trecho do ano de cada parte do array — mesmo padrão dos outros serviços
                anosEncontrados.forEach(res => {
                    if (res.trecho_encontrado) {
                        let trechoEscapado = res.trecho_encontrado
                            .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                        trechoEscapado = trechoEscapado.replace(/\s+/g, "\\s+");
                        const regex = new RegExp(trechoEscapado, "gi");

                        partesFrase = partesFrase.map(parte =>
                            parte.replace(regex, " ").trim()
                        );
                    }
                });
            }
        } catch (error) {
            console.error("Erro ao extrair [ano] da frase completa:", error);
        }

        // Define o ano base para a extração de período (data)
        const anoFiltro = filtrosEncontrados.ano.length > 0
            ? filtrosEncontrados.ano[0].codigo
            : this.services.ano.getAnoPadrao();
            
        // Lista de anos solicitados para as demais entidades
        const anosSolicitados = filtrosEncontrados.ano.length > 0 
            ? filtrosEncontrados.ano.map(a => a.codigo) 
            : [this.services.ano.getAnoPadrao()];

        // Monta um Set com todas as entidades que fazem parte de algum grupo paralelo,
        // para excluí-las do loop cascata principal (e também remover o 'ano' que já rodou)
        const entidadesParalelasEAno = new Set([...FiltroService.GRUPOS_PARALELOS.flat(), "ano"]);

        for (let trecho of partesFrase) {

            // ── 2. Processamento em PARALELO Primeiro (Prioridade Máxima) ──
            // UG e UO recebem a frase intocada primeiro
            for (const grupo of FiltroService.GRUPOS_PARALELOS) {
                if (!trecho || trecho.trim().length === 0) break;

                const resultadosGrupo = await Promise.all(
                    grupo.map(async entidade => {
                        try {
                            const resultados = await this.services[entidade].extrair(trecho, anosSolicitados);
                            return { entidade, resultados: resultados ?? [] };
                        } catch (error) {
                            console.error(`Erro ao extrair [${entidade}] no trecho "${trecho}":`, error);
                            return { entidade, resultados: [] };
                        }
                    })
                );

                for (const { entidade, resultados } of resultadosGrupo) {
                    if (resultados.length > 0) {
                        const resultadosValidados = resultados.filter(res => {
                            const isExcl = exclusaoFiltroService.verificarExclusao(fraseCompleta, res.trecho_encontrado);

                            // Regra Especial: Registros "None" autogerados (ex: "por emenda") são descartados se não for exclusão
                            if (res.autoGerado && !isExcl) return false;

                            res.excluir = isExcl;

                            // Regra Especial: "sem emendas/contratos/convenios" deve ser um filtro inclusivo para o valor "None"
                            if (
                                (entidade === "emenda" && res.codigo === "E0000") || 
                                (entidade === "contrato" && res.codigo === "00000000") ||
                                (entidade === "convenio_despesa" && (res.codigo === "000000" || res.codigo === " - - - ")) ||
                                (entidade === "convenio_receita" && (res.codigo === "000000" || res.codigo === " - - - "))
                            ) {
                                res.excluir = false;
                            }
                            return true;
                        });

                        if (resultadosValidados.length > 0) {
                            filtrosEncontrados[entidade].push(...resultadosValidados);

                            resultadosValidados.forEach(res => {
                                if (res.trecho_encontrado) {
                                    let trechoEscapado = res.trecho_encontrado
                                        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                    trechoEscapado = trechoEscapado.replace(/\s+/g, "\\s+");

                                    const regex = new RegExp(trechoEscapado, "gi");
                                    trecho = trecho.replace(regex, " ").trim();
                                }
                            });
                        }
                    }
                }
            }

            // ── 3. Processamento em CASCATA (serviços com menor prioridade) ──
            for (const [entidade, service] of Object.entries(this.services)) {
                // Entidades paralelas e Ano já foram tratadas; pula aqui
                if (entidadesParalelasEAno.has(entidade)) continue;

                if (!trecho || trecho.trim().length === 0) break;

                try {
                    let resultados;
                    if (entidade === "periodo") {
                        resultados = await service.extrair(trecho, anoFiltro);
                    } else {
                        resultados = await service.extrair(trecho, anosSolicitados);
                    }

                    if (resultados && resultados.length > 0) {
                        const resultadosValidados = resultados.filter(res => {
                            const isExcl = exclusaoFiltroService.verificarExclusao(fraseCompleta, res.trecho_encontrado);

                            // Regra Especial: Registros "None" autogerados (ex: "por emenda") são descartados se não for exclusão
                            if (res.autoGerado && !isExcl) return false;

                            res.excluir = isExcl;

                            // Regra Especial: "sem emendas/contratos/convenios" deve ser um filtro inclusivo para o valor "None"
                            if (
                                (entidade === "emenda" && res.codigo === "E0000") || 
                                (entidade === "contrato" && res.codigo === "00000000") ||
                                (entidade === "convenio_despesa" && (res.codigo === "000000" || res.codigo === " - - - ")) ||
                                (entidade === "convenio_receita" && (res.codigo === "000000" || res.codigo === " - - - "))
                            ) {
                                res.excluir = false;
                            }
                            return true;
                        });
                        
                        if (resultadosValidados.length > 0) {
                            filtrosEncontrados[entidade].push(...resultadosValidados);

                            resultadosValidados.forEach(res => {
                                if (res.trecho_encontrado) {
                                    let trechoEscapado = res.trecho_encontrado
                                        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
                                    trechoEscapado = trechoEscapado.replace(/\s+/g, "\\s+");

                                    const regex = new RegExp(trechoEscapado, "gi");
                                    trecho = trecho.replace(regex, " ").trim();
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.error(`Erro ao extrair [${entidade}] no trecho "${trecho}":`, error);
                }
            }
        }

        // --- FALLBACK: Se for BUSCA DIÁRIA e nenhum mês/período e nenhum ano foi especificado, assume o Mês Atual ---
        const fraseCompletaParaFallback = (partesFraseOriginal || []).join(" ").toLowerCase();
        const temIntencaoDiaria = /\b(diariamente|por dia|pagamento diario|cada dia|dia a dia)\b/i.test(fraseCompletaParaFallback);

        if (temIntencaoDiaria && filtrosEncontrados.periodo.length === 0 && filtrosEncontrados.ano.length === 0) {
            const periodoPadrao = this.services.periodo.getPeriodoCorrente();
            filtrosEncontrados.periodo.push(periodoPadrao);
        }

        // Remove duplicatas e chaves com arrays vazios
        const resultadoFinal = {};

        for (const [entidade, lista] of Object.entries(filtrosEncontrados)) {
            if (lista.length > 0) {
                const idsUnicos = new Set();
                resultadoFinal[entidade] = lista.filter(item => {
                    if (entidade === "periodo") {
                        const chave = `${item.data_inicio}_${item.data_fim}`;
                        if (idsUnicos.has(chave)) return false;
                        idsUnicos.add(chave);
                        return true;
                    }

                    if (["emenda", "contrato", "convenio_despesa", "convenio_receita"].includes(entidade)) {
                        const chaveGenerica = `${item.codigo}_${item.descricao}`;
                        if (idsUnicos.has(chaveGenerica)) return false;
                        idsUnicos.add(chaveGenerica);
                        return true;
                    }

                    if (idsUnicos.has(item.codigo)) return false;
                    idsUnicos.add(item.codigo);
                    return true;
                });
            }
        }

        return resultadoFinal;
    }

    /**
     * Resolve a lista de anos a ser usada na query.
     * Se houver anos nos filtros, deduplica e retorna seus códigos.
     * Caso contrário, retorna o ano padrão do sistema.
     *
     * @param {Object} filtros - Objeto retornado por processarFiltros().
     * @returns {number[]}
     */
    resolverAnos(filtros, camposSolicitados = []) {
        const anosSet = new Set();

        if (filtros.ano && filtros.ano.length > 0) {
            filtros.ano.forEach(a => anosSet.add(a.codigo));
        }

        // Também inclui tabelas dos anos citados no período
        if (filtros.periodo && filtros.periodo.length > 0) {
            filtros.periodo.forEach(p => {
                if (p.data_inicio) anosSet.add(parseInt(p.data_inicio.substring(0, 4)));
                if (p.data_fim) anosSet.add(parseInt(p.data_fim.substring(0, 4)));
            });
        }

        // Se o agrupamento anual foi solicitado e nenhum ano específico foi informado,
        // expande para todos os anos disponíveis (para que o UNION cubra todas as tabelas)
        const temAgrupamentoAnual = camposSolicitados.includes("agrupamento_anual");
        if (temAgrupamentoAnual && anosSet.size === 0) {
            const anoAtual = new Date().getFullYear();
            for (let a = 2024; a <= anoAtual; a++) {
                anosSet.add(a);
            }
        }

        if (anosSet.size > 0) {
            return [...anosSet];
        }

        return [this.services.ano.getAnoPadrao()];
    }
}

module.exports = new FiltroService();