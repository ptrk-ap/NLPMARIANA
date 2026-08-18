require("dotenv").config();
const knex = require("../database/connection");

async function populateCredores() {
    console.log("== Criando tabela e populando 'credores' a partir de execucao2024, execucao2025 e execucao2026 ==\n");

    // 1. Criar tabela se não existir (PostgreSQL)
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS credor (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(50) NOT NULL,
            descricao TEXT,
            UNIQUE (codigo)
        );
    `);
    console.log("Tabela 'credor' verificada/criada.");

    // Função para buscar dados apenas se a tabela existir
    async function buscarCredoresTabela(nomeTabela) {
        const exists = await knex.schema.hasTable(nomeTabela);
        if (!exists) {
            console.log(`  ⚠️ Tabela ${nomeTabela} não existe, ignorando.`);
            return [];
        }
        const res = await knex.raw(`
            SELECT DISTINCT credor 
            FROM "${nomeTabela}" 
            WHERE credor IS NOT NULL AND credor != ''
        `);
        return res.rows;
    }

    // 2. Busca valores DISTINCT de credor
    console.log("Buscando valores distintos de credor...");
    const tabelas = [
        "2025DI", "2025NE", "2025NL", "2025OB",
        "2026DI", "2026NE", "2026NL", "2026OB"
    ];

    const todosRows = [];
    for (const tabela of tabelas) {
        const rows = await buscarCredoresTabela(tabela);
        console.log(`  ${tabela}: ${rows.length} registros distintos`);
        todosRows.push(...rows);
    }

    // 3. Combinar e deduplicar
    const valoresBrutos = new Set();
    todosRows.forEach(r => {
        if (r.credor && r.credor.trim() && r.credor.trim() !== "- - -") {
            valoresBrutos.add(r.credor.trim());
        }
    });

    console.log(`\nTotal único (combinado): ${valoresBrutos.size} credores brutos\n`);

    // 4. Parse
    function parsearCreador(valorBruto) {
        const idxTraco = valorBruto.indexOf(" - ");
        if (idxTraco === -1) return { codigo: valorBruto.trim(), descricao: "" };
        return {
            codigo: valorBruto.substring(0, idxTraco).trim(),
            descricao: valorBruto.substring(idxTraco + 3).trim(),
        };
    }

    // 5. Deduplicar por código
    const mapaCredores = new Map();
    for (const valorBruto of valoresBrutos) {
        const { codigo, descricao } = parsearCreador(valorBruto);
        if (!codigo) continue;
        const existente = mapaCredores.get(codigo);
        if (!existente || descricao.length > existente.length) {
            mapaCredores.set(codigo, descricao);
        }
    }

    console.log(`Registros após deduplicação por código: ${mapaCredores.size}`);

    // 6. Verificar existentes no banco
    const existentesNoBanco = await knex("credor").select("codigo");
    const codigosNoBanco = new Set(existentesNoBanco.map(c => c.codigo));

    const novos = [];
    for (const [codigo, descricao] of mapaCredores.entries()) {
        if (!codigosNoBanco.has(codigo)) novos.push({ codigo, descricao });
    }

    console.log(`Novos registros a inserir: ${novos.length}\n`);

    if (novos.length === 0) {
        console.log("Nenhum registro novo. Tabela já está atualizada.");
        return { inseridos: 0, total: mapaCredores.size };
    }

    // 7. Inserção em lote
    const BATCH_SIZE = 100;
    let inseridos = 0;
    for (let i = 0; i < novos.length; i += BATCH_SIZE) {
        const lote = novos.slice(i, i + BATCH_SIZE);
        await knex("credor").insert(lote);
        inseridos += lote.length;
        process.stdout.write(`\r  Inserindo... ${inseridos}/${novos.length}`);
    }

    console.log(`\n\n✅ Concluído! ${inseridos} novos registros inseridos na tabela 'credor'.`);
    return { inseridos, total: mapaCredores.size };
}

module.exports = { populateCredores };