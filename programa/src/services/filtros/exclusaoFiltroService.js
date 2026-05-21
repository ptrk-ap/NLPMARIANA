class ExclusaoFiltroService {
    constructor() {
        this.palavrasExclusao = ["sem", "exceto", "menos", "removendo", "excluindo"];
        this.stopwordsConectoras = ["o", "a", "os", "as", "de", "do", "da", "dos", "das", "valores", "e", "ou", ","];
        
        // Categorias curtas que podem aparecer entre o 'sem' e o valor.
        // Se batermos nelas escaneando para trás, nós apenas pulamos (ex: 'fonte', 'credor').
        this.categoriasPulo = ["fonte", "eixo", "ug", "seplan", "credor", "ano", "mes"];
    }

    /**
     * Verifica se um trecho encontrado (entidade) deve ser excluído da query baseando-se no contexto
     * da frase original (fraseCompleta). Escaneia as palavras anteriores ao trecho.
     */
    verificarExclusao(fraseCompleta, trechoEncontrado) {
        if (!fraseCompleta || !trechoEncontrado) return false;

        // Escapar regex
        const trechoRegex = trechoEncontrado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(`(.*?)(${trechoRegex})`, "i");
        const match = fraseCompleta.match(regex);
        
        if (match) {
            // Pega o prefixo (tudo antes da match)
            const prefixo = match[1];
            // Separa por espaços
            const antes = prefixo.trim().split(/\s+/).filter(p => p.length > 0);
            
            // Olha de trás pra frente
            for (let i = antes.length - 1; i >= 0; i--) {
                let p = antes[i].toLowerCase().replace(',', '');
                if (p === "") continue;

                if (this.palavrasExclusao.includes(p)) {
                    return true;
                }
                
                // Se for número isolado (ex: "500 e 501"), continua pulando pra trás
                if (!isNaN(p)) {
                    continue;
                }

                if (!this.stopwordsConectoras.includes(p) && !this.categoriasPulo.includes(p)) {
                    // Encontrou uma palavra que corta o contexto (ex: "com", "na", um novo verbo, etc)
                    break;
                }
            }
        }
        return false;
    }
}

module.exports = new ExclusaoFiltroService();
