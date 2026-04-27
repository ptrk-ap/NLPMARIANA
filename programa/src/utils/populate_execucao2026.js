/**
 * populate_execucao2026.js
 */

require("dotenv").config();
const https = require("https");
const knex = require("../database/connection");
const { parse } = require("csv-parse/sync");
const iconv = require("iconv-lite");

// ─── Configurações ────────────────────────────────────────────────────────────

const API_BASE = "https://siplag.ap.gov.br/FlexSiafeAP/api";
const CONSULTA_ID = "012357";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({ statusCode: res.statusCode, body: buffer });
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function autenticar(usuario, senha) {
  const payload = JSON.stringify({ usuario, senha });
  const url = new URL(`${API_BASE}/auth`);

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(payload),
      "User-Agent": "Mozilla/5.0 (compatible; populate_execucao2026/1.0)",
    },
  };

  const { statusCode, body } = await request(options, payload);

  if (statusCode !== 200) {
    throw new Error(`Erro na autenticação. HTTP ${statusCode}: ${body.toString()}`);
  }

  const json = JSON.parse(body.toString());
  if (!json.token) throw new Error("Token não encontrado na resposta: " + body.toString());
  return json.token;
}

async function buscarCSV(token) {
  const url = new URL(`${API_BASE}/consultas/${CONSULTA_ID}/CSV`);

  const options = {
    hostname: url.hostname,
    path: url.pathname,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": 2,
      "User-Agent": "Mozilla/5.0 (compatible; populate_execucao2026/1.0)",
    },
  };

  const { statusCode, body } = await request(options, "{}");

  if (statusCode === 204) throw new Error("API retornou 204 — nenhum conteúdo.");
  if (statusCode !== 200) throw new Error(`Erro na consulta. HTTP ${statusCode}: ${body.toString()}`);

  return iconv.decode(body, "utf-8");
}

// ─── Transformações ───────────────────────────────────────────────────────────

function converterDecimal(valor) {
  if (!valor || valor.trim() === "" || valor.trim() === "-") return null;
  const formatado = valor.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(formatado);
  return isNaN(num) ? null : num;
}

function converterData(valor) {
  if (!valor || valor.trim() === "" || valor.trim() === "-") return null;
  const partes = valor.trim().split("/");
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function mapearLinha(cols) {
  return {
    poder: cols[0] || null,
    unidade_gestora: cols[1] || null,
    unidade_orcamentaria: cols[2] || null,
    eixo: cols[3] || null,
    programa: cols[4] || null,
    ods: cols[5] || null,
    acao: cols[6] || null,
    funcao: cols[7] || null,
    fonte: cols[8] || null,
    grupo_despesa: cols[9] || null,
    categoria_despesa: cols[10] || null,
    elemento_despesa: cols[11] || null,
    emenda: cols[12] || null,
    natureza_despesa: cols[13] || null,
    convenio_despesa: cols[14] || null,
    convenio_receita: cols[15] || null,
    contrato: cols[16] || null,
    credor: cols[17] || null,

    // NOVOS CAMPOS (adicionados)
    nota_empenho: converterData(cols[18]),
    nota_liquidacao: converterData(cols[19]),

    ordem_bancaria: converterData(cols[20]),
    dotacao_inicial: converterDecimal(cols[21]),
    despesas_empenhadas: converterDecimal(cols[22]),
    despesas_liquidadas: converterDecimal(cols[23]),
    despesas_pagas: converterDecimal(cols[24]),
    despesas_exercicio_pagas: converterDecimal(cols[25]),
  };
}

// ─── Banco de Dados ───────────────────────────────────────────────────────────

async function setupDatabase() {
  console.log("Verificando estrutura do banco de dados...");

  const hasTable = await knex.schema.hasTable("execucao2026");

  if (!hasTable) {
    await knex.schema.createTable("execucao2026", (table) => {
      table.increments("id").primary();
      table.string("poder", 200);
      table.string("unidade_gestora", 200);
      table.string("unidade_orcamentaria", 200);
      table.string("eixo", 200);
      table.string("programa", 200);
      table.string("ods", 200);
      table.string("acao", 1000);
      table.string("funcao", 200);
      table.string("fonte", 200);
      table.string("grupo_despesa", 200);
      table.string("categoria_despesa", 200);
      table.string("elemento_despesa", 200);
      table.string("emenda", 2000);
      table.string("natureza_despesa", 200);
      table.string("convenio_despesa", 1000);
      table.string("convenio_receita", 1000);
      table.string("contrato", 2000);
      table.string("credor", 200);

      // NOVOS CAMPOS (adicionados)
      table.date("nota_empenho");
      table.date("nota_liquidacao");

      table.date("ordem_bancaria");
      table.decimal("dotacao_inicial", 20, 4);
      table.decimal("despesas_empenhadas", 20, 4);
      table.decimal("despesas_liquidadas", 20, 4);
      table.decimal("despesas_pagas", 20, 4);
      table.decimal("despesas_exercicio_pagas", 20, 4);
    });

    console.log("✔ Tabela 'execucao2026' criada.");
  } else {
    console.log("✔ Tabela 'execucao2026' já existe.");
  }

  await knex("execucao2026").truncate();
  console.log("✔ Tabela truncada.");
}

async function salvarNoBanco(linhas) {
  const BATCH_SIZE = 500;
  let inseridos = 0;

  for (let i = 0; i < linhas.length; i += BATCH_SIZE) {
    const lote = linhas.slice(i, i + BATCH_SIZE);
    await knex("execucao2026").insert(lote);
    inseridos += lote.length;
    process.stdout.write(`\r  Inserindo... ${inseridos}/${linhas.length} linhas`);
  }

  console.log(`\n✔ Inserção concluída: ${inseridos} linhas.`);
}

async function excluirTabelaExecucao2026() {
  console.log("Excluindo tabela 'execucao2026'...");
  const hasTable = await knex.schema.hasTable("execucao2026");
  if (hasTable) {
    await knex.schema.dropTable("execucao2026");
    console.log("✔ Tabela 'execucao2026' excluída.");
    return { success: true, message: "Tabela excluída com sucesso." };
  } else {
    console.log("✔ Tabela 'execucao2026' não existe.");
    return { success: true, message: "A tabela não existia." };
  }
}

// ─── Função Principal Exportada ───────────────────────────────────────────────

async function populateExecucao2026() {
  console.log("=== Importador FlexSiafe AP → execucao2026 ===\n");

  const apiUsuario = process.env.API_USERNAME;
  const apiSenha = process.env.API_PASSWORD;

  if (!apiUsuario || !apiSenha) {
    throw new Error("Credenciais ausentes. Defina API_USERNAME e API_PASSWORD no .env");
  }

  console.log("Autenticando na API...");
  const token = await autenticar(apiUsuario, apiSenha);
  console.log("✔ Token obtido.");

  console.log("Buscando dados da consulta 012357...");
  const csvText = await buscarCSV(token);
  console.log("✔ CSV recebido.");

  console.log("Parseando CSV...");
  const records = parse(csvText, {
    delimiter: ";",
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length < 2) throw new Error("CSV vazio ou sem dados.");

  const cabecalho = records[0];
  console.log(`✔ Colunas detectadas: ${cabecalho.length} | Linhas totais: ${records.length}`);

  const linhasMapeadas = records.slice(1).map((cols, idx) => {
    try {
      return mapearLinha(cols);
    } catch (e) {
      console.warn(`  Aviso: erro ao mapear linha ${idx + 2}: ${e.message}`);
      return null;
    }
  }).filter(Boolean);

  console.log(`✔ Linhas válidas para inserção: ${linhasMapeadas.length}`);

  await setupDatabase();
  await salvarNoBanco(linhasMapeadas);

  console.log("\n✅ Importação finalizada com sucesso em", new Date().toLocaleString("pt-BR"));
}

module.exports = { populateExecucao2026, excluirTabelaExecucao2026 };