/**
 * SplitService - Divide uma frase com base em palavras-chave pré-configuradas.
 */
class SplitService {
    constructor() {
        // Lista manual de chaves (idêntica ao seu ExtratorTermosService)
        this.chavesConfiguradas = [
            "poder",
            "unidade_gestora",
            "fonte",
            "natureza_despesa",
            "elemento_despesa",
            "categoria_despesa",
            "grupo_despesa",
            "funcao",
            "programa",
            "acao",
            "eixo",
            "ods",
            "unidade_orcamentaria",
            "emenda",
            "contrato",
            "convenio_receita",
            "convenio_despesa",
            "credor",
            "dotacao_inicial",
            "despesas_empenhadas",
            "despesas_liquidadas",
            "despesas_pagas",
            "despesas_exercicio_pagas"
        ];
    }

    /**
     * Quebra a frase à esquerda de cada palavra-chave encontrada.
     * @param {string} frase 
     * @returns {string[]}
     */
    quebrarFrase(frase) {
        if (!frase) return [];

        // 1. Identifica quais chaves da lista estão presentes na frase
        const chavesPresentes = this.chavesConfiguradas.filter(chave => {
            const regex = new RegExp(`\\b${chave}\\b`, 'i');
            return regex.test(frase);
        });

        // 2. Ordena as chaves por tamanho (maiores primeiro)
        // Isso evita que "despesas_pagas" corte antes de "despesas_exercicio_pagas"
        chavesPresentes.sort((a, b) => b.length - a.length);

        // 3. Cria a Regex de corte
        // O Lookahead (?=...) identifica a palavra mas não a remove do texto
        const pattern = chavesPresentes.join('|');
        const regexSplit = new RegExp(`(?=\\b(?:${pattern})\\b)`, 'i');

        // 4. Executa a quebra e limpa os espaços
        return frase
            .split(regexSplit)
            .map(segmento => segmento.trim())
            .filter(segmento => segmento.length > 0);
    }
}

module.exports = new SplitService();