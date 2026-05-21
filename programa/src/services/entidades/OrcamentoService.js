/**
 * OrcamentoService - Gerencia a tradução de termos com prioridade para termos compostos.
 */
class OrcamentoService {
    constructor() {
        // IMPORTANTE: A ordem aqui não importa tanto quanto a lógica de ordenação 
        // que adicionei no método traduzirParaTermosSql.
        this.dicionario = {

            "poder": [
                "poder",
                "poderes"
            ],

            "unidade_gestora": [
                "unidade gestora",
                "unidades gestoras",
                "ug",
                "ugs",
                "gestora",
                "gestoras"
            ],

            "fonte": [
                "fonte",
                "fontes",
                "fonte de recurso",
                "fontes de recurso",
                "origem do recurso",
                "origens do recurso",
                "origens de recurso"
            ],

            "natureza_despesa": [
                "natureza",
                "naturezas",
                "natureza da despesa",
                "naturezas da despesa",
                "nd",
                "nds"
            ],

            "programa": [
                "programa",
                "programas",
                "programa de governo",
                "programas de governo"
            ],

            "elemento_despesa": [
                "elemento de despesa",
                "elementos de despesa",
                "elemento",
                "elementos"
            ],

            "grupo_despesa": [
                "grupo de despesa",
                "grupos de despesa",
                "grupo",
                "grupos"
            ],

            "categoria_despesa": [
                "categoria de despesa",
                "categorias de despesa",
                "categoria",
                "categorias"
            ],

            "funcao": [
                "funcao",
                "funcoes",
                "função",
                "funções",
                "funcao de despesa",
                "funcoes de despesa",
                "função de despesa",
                "funções de despesa"
            ],

            "acao": [
                "ação",
                "acoes",
                "ações",
                "projeto atividade",
                "projetos atividades",
                "projeto atividades",
                "projetos atividade"
            ],

            "ods": [
                "ods",
                "odss",
                "objetivo de desenvolvimento sustentável",
                "objetivos de desenvolvimento sustentável"
            ],

            "eixo": [
                "eixo",
                "eixos",
                "eixo de governo",
                "eixos de governo",
                "eixo de programa",
                "eixos de programa"
            ],

            "unidade_orcamentaria": [
                "unidade orçamentária",
                "unidades orçamentárias",
                "unidade orcamentaria",
                "unidades orcamentarias",
                "uo",
                "uos"
            ],

            "emenda": [
                "emenda",
                "emendas"
            ],

            "contrato": [
                "contrato",
                "contratos"
            ],
            "convenio_despesa": [
                "convenio despesa",
                "convenios despesas",
                "convenio despesas",
                "convenios despesas",
                "convenio de despesa",
                "convenios de despesas"
            ],
            "convenio_receita": [
                "convenio receita",
                "convenios receitas",
                "convenio receitas",
                "convenios receitas",
                "convenio de receita",
                "convenios de receitas"
            ],
            // Termo compartilhado que ativa ambos os serviços em paralelo
            "convenio_despesa convenio_receita": [
                "convenio",
                "convenios"
            ],

            "credor": [
                "credor",
                "credores",
                "fornecedor",
                "fornecedores",
                "credora",
                "fornecedora",
                "empresa",
                "empresas",
                "servidor",
                "servidora",
                "servidores",
                "servidoras"
            ],


            "dotacao_inicial": [
                "dotação inicial",
                "dotações iniciais",
                "dotacao inicial",
                "orcamento inicial",
                "orcamento",
                "dotacoes iniciais",
                "orçado",
                "orçados",
                "orçada",
                "orçadas",
                "orçamentos"
            ],

            "despesas_empenhadas": [
                "despesa empenhada",
                "despesas empenhadas",
                "empenhado",
                "empenhados",
                "empenhada",
                "empenhadas",
                "nota de empenho",
                "notas de empenho",
                "empenho",
                "empenhos"
            ],

            // Termo longo (específico)
            "despesas_exercicio_pagas": [
                "despesas do exercício pagas",
                "despesa do exercício paga",
                "despesas do exercicio pagas",
                "despesa do exercicio paga",
                "pago no exercício",
                "pagos no exercício",
                "pago no exercicio",
                "pagos no exercicio"
            ],

            // Termo curto (genérico)
            "despesas_pagas": [
                "despesa paga",
                "despesas pagas",
                "pago",
                "gasto",
                "pagos",
                "paga",
                "pagas",
                "despesa",
                "despesas",
                "pagamento",
                "pagamentos"
            ],
            "despesas_liquidadas": [
                "despesa liquidada",
                "despesas liquidadas",
                "liquidado",
                "liquidados",
                "liquida",
                "liquidadas",
                "nota de liquidacao",
                "notas de liquidacao",
                "liquidacao",
                "liquidacoes"
            ],
            "agrupamento_mensal": [
                "mes a mes",
                "por mes",
                "por meses",
                "cada mes",
                "cada meses",
                "mensalmente",
                "mensal",
                "mensais"
            ],

            "agrupamento_bimestral": [
                "por bimestre",
                "por bimestres",
                "cada bimestre",
                "cada bimestres",
                "bimestralmente",
                "bimestral",
                "bimestrais",
                "bimestre a bimestre"
            ],

            "agrupamento_trimestral": [
                "por trimestre",
                "por trimestres",
                "cada trimestre",
                "cada trimestres",
                "trimestralmente",
                "trimestral",
                "trimestrais",
                "trimestre a trimestre"
            ],

            "agrupamento_semestral": [
                "por semestre",
                "por semestres",
                "cada semestre",
                "cada semestres",
                "semestralmente",
                "semestral",
                "semestrais",
                "semestre a semestre"
            ],
            "agrupamento_diario": [
                "diariamente",
                "por dia",
                "pagamento diario",
                "cada dia",
                "dia a dia"
            ]
        };


        this._prepararDicionario();
    }

    _normalizar(str) {
        return str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");
    }

    _prepararDicionario() {
        for (const chave in this.dicionario) {
            this.dicionario[chave] = this.dicionario[chave].map(s => this._normalizar(s));
        }
    }

    /**
     * Traduz a frase, priorizando a substituição de termos mais longos.
     */
    traduzirParaTermosSql(texto) {
        if (!texto) return "";

        let textoProcessado = this._normalizar(texto);

        // Criamos uma lista de todos os sinônimos vinculados às suas chaves
        let todasAsSubstituicoes = [];
        for (const [chave, sinonimos] of Object.entries(this.dicionario)) {
            sinonimos.forEach(s => {
                todasAsSubstituicoes.push({ sinonimo: s, chave: chave });
            });
        }

        // O PULO DO GATO: Ordenamos os sinônimos pelo tamanho (length) de forma decrescente.
        // Isso garante que "pago no exercicio" seja processado ANTES de "pago".
        todasAsSubstituicoes.sort((a, b) => b.sinonimo.length - a.sinonimo.length);

        // Aplicamos as substituições na ordem da mais específica para a mais genérica
        todasAsSubstituicoes.forEach(item => {
            const pattern = `\\b${this._escaparRegExp(item.sinonimo)}\\b`;
            const regex = new RegExp(pattern, 'g');
            textoProcessado = textoProcessado.replace(regex, item.chave);
        });

        return textoProcessado;
    }

    _escaparRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

module.exports = new OrcamentoService();