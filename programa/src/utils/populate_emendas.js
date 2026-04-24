require("dotenv").config();
const knex = require("../database/connection");

async function populateEmendas() {
    console.log("== Criando tabela e populando 'emendas' a partir de execucao2024, execucao2025 e execucao2026 ==\n");

    // 0. Criar tabela se não existir (PostgreSQL)
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS emendas (
            id SERIAL PRIMARY KEY,
            codigo VARCHAR(20) NOT NULL,
            descricao TEXT,
            UNIQUE (codigo)
        );
    `);
    console.log("Tabela 'emendas' verificada/criada.");

    // 🔹 Função para buscar dados só se a tabela existir
    async function buscarEmendasTabela(nomeTabela) {
        const exists = await knex.schema.hasTable(nomeTabela);

        if (!exists) {
            console.log(`  ⚠️ Tabela ${nomeTabela} não existe, ignorando.`);
            return [];
        }

        const res = await knex.raw(`
            SELECT DISTINCT emenda 
            FROM "${nomeTabela}" 
            WHERE emenda IS NOT NULL AND emenda != ''
        `);

        return res.rows;
    }

    // 1. Buscar dados com segurança
    console.log("Buscando valores distintos de emenda...");

    const rows2024 = await buscarEmendasTabela("execucao2024");
    const rows2025 = await buscarEmendasTabela("execucao2025");
    const rows2026 = await buscarEmendasTabela("execucao2026");

    console.log(`  execucao2024: ${rows2024.length} registros distintos`);
    console.log(`  execucao2025: ${rows2025.length} registros distintos`);
    console.log(`  execucao2026: ${rows2026.length} registros distintos`);

    // 2. Combinar e deduplicar
    const valoresBrutos = new Set();
    [...rows2024, ...rows2025, ...rows2026].forEach(r => {
        if (r.emenda) valoresBrutos.add(r.emenda.trim());
    });

    console.log(`\nTotal único (combinado): ${valoresBrutos.size} emendas\n`);

    // 3. Parse
    function parsearEmenda(valorBruto) {
        const idxTraco = valorBruto.indexOf(" - ");
        if (idxTraco === -1) {
            return { codigo: valorBruto.trim(), descricao: "" };
        }
        const codigo = valorBruto.substring(0, idxTraco).trim();
        const descricao = valorBruto.substring(idxTraco + 3).trim();
        return { codigo, descricao };
    }

    // 4. Deduplicar por código
    const mapaEmendas = new Map();
    for (const valorBruto of valoresBrutos) {
        const { codigo, descricao } = parsearEmenda(valorBruto);
        if (!codigo) continue;

        const existente = mapaEmendas.get(codigo);
        if (!existente || (descricao.length > existente.length)) {
            mapaEmendas.set(codigo, descricao);
        }
    }

    console.log(`Registros após deduplicação por código: ${mapaEmendas.size}`);

    // 5. Verificar existentes no banco
    const existentesNoBanco = await knex("emendas").select("codigo");
    const codigosNoBanco = new Set(existentesNoBanco.map(e => e.codigo));

    const novos = [];
    for (const [codigo, descricao] of mapaEmendas.entries()) {
        if (!codigosNoBanco.has(codigo)) {
            novos.push({ codigo, descricao });
        }
    }

    console.log(`Novos registros a inserir: ${novos.length}\n`);

    if (novos.length === 0) {
        console.log("Nenhum registro novo. Tabela já está atualizada.");
        return { inseridos: 0, total: mapaEmendas.size };
    }

    // 6. Inserção em lote
    const BATCH_SIZE = 100;
    let inseridos = 0;

    for (let i = 0; i < novos.length; i += BATCH_SIZE) {
        const lote = novos.slice(i, i + BATCH_SIZE);
        await knex("emendas").insert(lote);
        inseridos += lote.length;
        process.stdout.write(`\r  Inserindo... ${inseridos}/${novos.length}`);
    }

    console.log(`\n\n✅ Concluído! ${inseridos} novos registros inseridos na tabela 'emendas'.`);
    return { inseridos, total: mapaEmendas.size };
}

module.exports = { populateEmendas };