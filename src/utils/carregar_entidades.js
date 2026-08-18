require("dotenv").config();
const knex = require("../database/connection");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");

async function carregarEntidades() {
    console.log("== Atualizando arquivo CSV 'acao.csv' a partir de execucao2024, 2025 e 2026 ==\n");

    const tabelas = [
        "execucao2024",
        "2025DI", "2025NE", "2025NL", "2025OB",
        "2026DI", "2026NE", "2026NL", "2026OB"
    ];

    async function buscarAcaoTabela(nomeTabela) {
        const exists = await knex.schema.hasTable(nomeTabela);
        if (!exists) {
            console.log(`  ⚠️ Tabela ${nomeTabela} não existe, ignorando.`);
            return [];
        }
        const res = await knex.raw(`
            SELECT DISTINCT acao 
            FROM "${nomeTabela}" 
            WHERE acao IS NOT NULL AND acao != ''
        `);
        return res.rows;
    }

    console.log("Buscando valores distintos de acao no banco de dados...");
    const todosRows = [];
    for (const tabela of tabelas) {
        const rows = await buscarAcaoTabela(tabela);
        console.log(`  ${tabela}: ${rows.length} registros distintos encontrados`);
        todosRows.push(...rows);
    }

    const valoresBrutos = new Set();
    todosRows.forEach(r => {
        if (r.acao && r.acao.trim() && r.acao.trim() !== "- - -") {
            valoresBrutos.add(r.acao.trim());
        }
    });

    console.log(`\nTotal único (combinado no banco): ${valoresBrutos.size} acoes brutas\n`);

    function parsearAcao(valorBruto) {
        const idxTraco = valorBruto.indexOf(" - ");
        if (idxTraco === -1) return { codigo: valorBruto.trim(), descricao: "" };
        return {
            codigo: valorBruto.substring(0, idxTraco).trim(),
            descricao: valorBruto.substring(idxTraco + 3).trim(),
        };
    }

    // Processa os dados do banco
    const mapaBanco = new Map();
    for (const valorBruto of valoresBrutos) {
        const { codigo, descricao } = parsearAcao(valorBruto);
        if (!codigo) continue;
        const existente = mapaBanco.get(codigo);
        if (!existente || descricao.length > existente.length) {
            mapaBanco.set(codigo, descricao);
        }
    }

    // Lê o CSV existente
    const csvPath = path.join(__dirname, "../data/entidades/acao.csv");
    const mapaFinal = new Map();
    
    if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, "utf-8");
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true
        });
        
        records.forEach(row => {
            if (row.codigo) {
                mapaFinal.set(row.codigo, row.descricao || "");
            }
        });
        console.log(`Lidos ${mapaFinal.size} registros do arquivo acao.csv existente.`);
    }

    // Mescla com os dados do banco
    let novos = 0;
    let atualizados = 0;
    
    for (const [codigo, descricao] of mapaBanco.entries()) {
        const existente = mapaFinal.get(codigo);
        if (existente === undefined) {
            mapaFinal.set(codigo, descricao);
            novos++;
        } else if (descricao.length > existente.length) {
            // Atualiza se a descrição nova for mais completa
            mapaFinal.set(codigo, descricao);
            atualizados++;
        }
    }

    console.log(`Novos registros adicionados: ${novos}`);
    console.log(`Registros com descrição atualizada: ${atualizados}`);
    console.log(`Total de registros finais: ${mapaFinal.size}\n`);

    // Função manual para escapar CSV
    function escapeCSV(str) {
        if (!str) return "";
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    // Salvar arquivo CSV
    const sortedEntries = Array.from(mapaFinal.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    
    let csvData = "codigo,descricao\n";
    for (const [codigo, descricao] of sortedEntries) {
        csvData += `${escapeCSV(codigo)},${escapeCSV(descricao)}\n`;
    }

    fs.writeFileSync(csvPath, csvData, "utf-8");
    console.log(`✅ Arquivo ${csvPath} atualizado com sucesso!`);
    
    process.exit(0);
}

carregarEntidades().catch(err => {
    console.error("Erro ao carregar entidades:", err);
    process.exit(1);
});
