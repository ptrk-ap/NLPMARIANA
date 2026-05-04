class FormatterService {

    // 🔒 Campos de valor conhecidos do relatório
    static CAMPOS_DE_VALOR = [
        "soma_dotacao_inicial",
        "soma_despesas_empenhadas",
        "soma_despesas_liquidadas",
        "soma_despesas_pagas",
        "soma_despesas_exercicio_pagas"
    ];

    // 🏷️ Mapeamento de chaves para labels legíveis
    static LABELS = {
        unidade_gestora: "Unidade Gestora",
        fonte: "Fonte",
        natureza_despesa: "Natureza Despesa",
        programa: "Programa",
        acao: "Ação",
        unidade_orcamentaria: "Unidade Orçamentária",
        elemento_despesa: "Elemento Despesa",
        grupo_despesa: "Grupo Despesa",
        categoria_despesa: "Categoria Despesa",
        funcao: "Função",
        dotacao_inicial: "Dotação Inicial",
        despesas_empenhadas: "Despesas Empenhadas",
        despesas_liquidadas: "Despesas Liquidadas",
        despesas_pagas: "Despesas Pagas",
        despesas_exercicio_pagas: "Despesas Exercício Pagas",
        ods: "ODS",
        eixo: "Eixo",
        poder: "Poder",
        emenda: "Emenda",
        contrato: "Contrato",
        convenio_despesa: "Convênio Despesa",
        convenio_receita: "Convênio Receita",
        credor: "Credor",
        agrupamento_mensal: "Agrupamento Mensal",
        agrupamento_bimestral: "Agrupamento Bimestral",
        agrupamento_trimestral: "Agrupamento Trimestral",
        agrupamento_semestral: "Agrupamento Semestral",
        agrupamento_diario: "Agrupamento Diário",
        soma_dotacao_inicial: "Soma Dotação Inicial",
        soma_despesas_empenhadas: "Soma Despesas Empenhadas",
        soma_despesas_liquidadas: "Soma Despesas Liquidadas",
        soma_despesas_pagas: "Soma Despesas Pagas",
        soma_despesas_exercicio_pagas: "Soma Despesas Exercício Pagas",
    };

    /**
     * Formata número para Real (R$)
     */
    static toReal(valor) {
        if (valor === null || valor === undefined || valor === "") {
            return "R$ 0,00";
        }

        const numero = Number(valor);

        if (isNaN(numero)) {
            return "R$ 0,00";
        }

        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL"
        }).format(numero);
    }

    /**
     * Formata o campo credor:
     * - CNPJ (14 dígitos): mantém o número + descrição
     * - CPF  (11 dígitos): omite o número, exibe só a descrição
     */
    static formatarCredor(credor) {
        if (!credor || typeof credor !== "string") return credor;

        const match = credor.match(/^(\d+)\s*-\s*(.+)$/);
        if (!match) return credor;

        const [, documento, descricao] = match;
        const digits = documento.replace(/\D/g, "");

        if (digits.length === 11) {
            return descricao.trim();
        }

        return credor;
    }

    /**
     * Formata automaticamente todos os campos de valor presentes
     * no resultado SQL
     */
    static formatarResultado(rows = []) {
        return rows.map(row => {
            const novo = { ...row };

            for (const campo of FormatterService.CAMPOS_DE_VALOR) {
                if (campo in novo) {
                    novo[campo] = FormatterService.toReal(novo[campo]);
                }
            }

            if ("credor" in novo) {
                novo["credor"] = FormatterService.formatarCredor(novo["credor"]);
            }

            return novo;
        });
    }

    /**
     * Formata a mensagem de período para exibição na resposta da API.
     */
    static formatarMensagemPeriodo(filtros, anos) {
        let periodosTexto;

        if (filtros.ordem_bancaria && filtros.ordem_bancaria.length > 0) {
            periodosTexto = filtros.ordem_bancaria.map(ob => `${ob.data_inicio} a ${ob.data_fim}`);
        } else {
            periodosTexto = anos.map(a => `Exercício de ${a}`);
        }

        return `Valores correspondentes ao período: ${periodosTexto.join(', ')}`;
    }

    /**
     * Formata a resposta completa para envio via WhatsApp.
     * Converte o JSON em texto legível com labels humanizados,
     * separando cada registro por uma linha em branco.
     *
     * @param {string}         mensagem  - Texto do período (ex: "Valores correspondentes ao período: Exercício de 2026")
     * @param {Array<Object>}  resultado - Array de rows já formatados por formatarResultado()
     * @returns {string}
     */
    static formatarParaWhatsapp(mensagem, resultado = []) {
        const linhas = [`${mensagem}.\n`];

        for (const row of resultado) {
            const bloco = [];

            for (const [chave, valor] of Object.entries(row)) {
                const label = FormatterService.LABELS[chave] ?? chave;
                bloco.push(`${label}: ${valor}`);
            }

            linhas.push(bloco.join("\n"));
        }

        return linhas.join("\n\n");
    }
}

module.exports = FormatterService;