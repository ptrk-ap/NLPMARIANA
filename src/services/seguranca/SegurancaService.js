/**
 * SegurancaService - Responsável por limpar inputs contra SQL Injection.
 */
class SegurancaService {
    constructor() {
        // Lista de comandos SQL que devem ser removidos por segurança
        this.sqlBlacklist = [
            "select", "insert", "update", "delete", "drop", "truncate",
            "alter", "create", "exec", "execute", "union", "all", "any",
            "xp_", "sp_", "grant", "revoke"
        ];

        // Caracteres e sequências perigosas
        this.caracteresPerigosos = [
            /--/g,      // Comentários SQL
            /\/\*/g,    // Início de comentário de bloco
            /\*\//g,    // Fim de comentário de bloco
            /;/g,       // Fim de instrução
            /'/g,       // Aspas simples
            /"/g,       // Aspas duplas
            /\\/g,      // Backslashes
            /\bOR\s+1\s*=\s*1\b/gi, // Clássico ataque 'OR 1=1'
        ];
    }

    /**
     * Remove comandos SQL e caracteres de escape de uma string.
     * @param {string} texto - O texto bruto do usuário.
     * @returns {string} - O texto limpo.
     */
    sanitizar(texto) {
        if (!texto) return "";

        let textoLimpo = texto;

        // 1. Remove os caracteres perigosos/de escape
        this.caracteresPerigosos.forEach(regex => {
            textoLimpo = textoLimpo.replace(regex, "");
        });

        // 2. Remove palavras reservadas do SQL (apenas palavras inteiras)
        this.sqlBlacklist.forEach(comando => {
            // \b garante que não vamos remover a palavra "selecionar" só porque contém "select"
            const regex = new RegExp(`\\b${comando}\\b`, 'gi');
            textoLimpo = textoLimpo.replace(regex, "");
        });

        // 3. Remove espaços extras que sobraram após as remoções
        return textoLimpo.replace(/\s+/g, ' ').trim();
    }
}

module.exports = new SegurancaService();