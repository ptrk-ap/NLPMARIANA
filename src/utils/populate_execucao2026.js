/**
 * populate_execucao2026.js
 */

require("dotenv").config();
const knex = require("../database/connection");
const { parse } = require("csv-parse/sync");
const iconv = require("iconv-lite");
const { request, jsonRequest } = require("./httpHelper");

// ─── Configurações ────────────────────────────────────────────────────────────

const API_BASE = "https://siplag.ap.gov.br/FlexSiafeAP/api";

const CONSULTAS = {
  "012431": "2026DI",
  "012432": "2026NE",
  "012433": "2026NL",
  "012434": "2026OB",
};

// ─── Debug ────────────────────────────────────────────────────────────────────

function debug(passo, mensagem) {
  const timestamp = new Date().toLocaleTimeString("pt-BR");
  console.log(`[${timestamp}] [${passo}] ${mensagem}`);
}

// ─── API ──────────────────────────────────────────────────────────────────────

async function autenticar(usuario, senha) {
  debug("AUTH", "Enviando credenciais para a API...");

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

  const { statusCode, data } = await jsonRequest(options, payload);

  if (statusCode !== 200) {
    const msg = typeof data === "object" ? JSON.stringify(data) : data;
    throw new Error(`Erro na autenticação. HTTP ${statusCode}: ${msg}`);
  }

  if (!data.token) throw new Error("Token não encontrado na resposta da API.");

  debug("AUTH", "Token obtido com sucesso.");
  return data.token;
}

async function buscarCSV(token, consultaId) {
  debug("FETCH", `Requisitando CSV da consulta ${consultaId}...`);

  const url = new URL(`${API_BASE}/consultas/${consultaId}/CSV`);

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

  if (statusCode === 204)
    throw new Error(`Consulta ${consultaId}: API retornou 204 — nenhum conteúdo disponível.`);
  if (statusCode !== 200)
    throw new Error(`Consulta ${consultaId}: Erro HTTP ${statusCode}: ${body.toString()}`);

  debug("FETCH", `CSV da consulta ${consultaId} recebido com sucesso.`);
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

// Campos comuns a todas as tabelas
function mapearCamposComuns(cols) {
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
  };
}

// Mapeadores específicos por tabela
const MAPEADORES = {
  "2026DI": (cols) => ({
    ...mapearCamposComuns(cols),
    dotacao_inicial: converterDecimal(cols[18]),
  }),
  "2026NE": (cols) => ({
    ...mapearCamposComuns(cols),
    nota_empenho: converterData(cols[18]),
    despesas_empenhadas: converterDecimal(cols[19]),
  }),
  "2026NL": (cols) => ({
    ...mapearCamposComuns(cols),
    nota_liquidacao: converterData(cols[18]),
    despesas_liquidadas: converterDecimal(cols[19]),
  }),
  "2026OB": (cols) => ({
    ...mapearCamposComuns(cols),
    ordem_bancaria: converterData(cols[18]),
    despesas_pagas: converterDecimal(cols[19]),
    despesas_exercicio_pagas: converterDecimal(cols[20]),
  }),
};

// ─── Processamento do CSV ─────────────────────────────────────────────────────

function processarCSV(csvText, consultaId, tabela) {
  debug("PARSE", `Processando CSV da consulta ${consultaId} → tabela '${tabela}'...`);

  const records = parse(csvText, {
    delimiter: ";",
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length < 2)
    throw new Error(`Consulta ${consultaId}: CSV não contém dados válidos.`);

  const cabecalho = records[0];
  debug("PARSE", `Colunas encontradas: ${cabecalho.length} | Linhas brutas: ${records.length - 1}`);

  const mapeador = MAPEADORES[tabela];

  const linhasMapeadas = records
    .slice(1)
    .map((cols, idx) => {
      try {
        return mapeador(cols);
      } catch (e) {
        console.warn(`  Aviso [${consultaId}]: erro na linha ${idx + 2}: ${e.message}`);
        return null;
      }
    })
    .filter(Boolean);

  debug("PARSE", `Linhas válidas mapeadas: ${linhasMapeadas.length}`);
  return linhasMapeadas;
}

// ─── Banco de Dados ───────────────────────────────────────────────────────────

function definirColunasComunsNaTabela(table) {
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
}

async function setupTabela(nomeTabela) {
  debug("DB", `Verificando existência da tabela '${nomeTabela}'...`);

  const existe = await knex.schema.hasTable(nomeTabela);

  if (existe) {
    debug("DB", `Tabela '${nomeTabela}' existe. Dropando...`);
    await knex.schema.dropTable(nomeTabela);
    debug("DB", `Tabela '${nomeTabela}' removida.`);
  }

  debug("DB", `Criando tabela '${nomeTabela}'...`);

  if (nomeTabela === "2026DI") {
    await knex.schema.createTable(nomeTabela, (table) => {
      definirColunasComunsNaTabela(table);
      table.decimal("dotacao_inicial", 20, 4);
    });
  } else if (nomeTabela === "2026NE") {
    await knex.schema.createTable(nomeTabela, (table) => {
      definirColunasComunsNaTabela(table);
      table.date("nota_empenho");
      table.decimal("despesas_empenhadas", 20, 4);
    });
  } else if (nomeTabela === "2026NL") {
    await knex.schema.createTable(nomeTabela, (table) => {
      definirColunasComunsNaTabela(table);
      table.date("nota_liquidacao");
      table.decimal("despesas_liquidadas", 20, 4);
    });
  } else if (nomeTabela === "2026OB") {
    await knex.schema.createTable(nomeTabela, (table) => {
      definirColunasComunsNaTabela(table);
      table.date("ordem_bancaria");
      table.decimal("despesas_pagas", 20, 4);
      table.decimal("despesas_exercicio_pagas", 20, 4);
    });
  }

  debug("DB", `Tabela '${nomeTabela}' criada com sucesso.`);
}

async function salvarNoBanco(nomeTabela, linhas) {
  debug("INSERT", `Iniciando inserção de ${linhas.length} linhas na tabela '${nomeTabela}'...`);

  const BATCH_SIZE = 500;
  let inseridos = 0;

  for (let i = 0; i < linhas.length; i += BATCH_SIZE) {
    const lote = linhas.slice(i, i + BATCH_SIZE);
    await knex(nomeTabela).insert(lote);
    inseridos += lote.length;
    process.stdout.write(`\r  [INSERT] '${nomeTabela}': ${inseridos}/${linhas.length} linhas inseridas`);
  }

  console.log();
  debug("INSERT", `Inserção na tabela '${nomeTabela}' concluída.`);
}

// ─── Função Principal Exportada ───────────────────────────────────────────────

async function populateExecucao2026() {
  console.log("=== Importador FlexSiafe AP → 2026DI / 2026NE / 2026NL / 2026OB ===\n");

  const apiUsuario = process.env.API_USERNAME;
  const apiSenha = process.env.API_PASSWORD;

  if (!apiUsuario || !apiSenha) {
    throw new Error("Credenciais da API ausentes no arquivo .env");
  }

  try {
    // 1. Autenticação
    const token = await autenticar(apiUsuario, apiSenha);
    console.log();

    // 2. Para cada consulta: buscar, processar, configurar banco e salvar
    for (const [consultaId, nomeTabela] of Object.entries(CONSULTAS)) {
      console.log(`─── Processando consulta ${consultaId} → '${nomeTabela}' ───`);

      // 2a. Buscar CSV
      const csvText = await buscarCSV(token, consultaId);

      // 2b. Processar CSV
      const linhas = processarCSV(csvText, consultaId, nomeTabela);

      // 2c. Preparar tabela (drop + create)
      await setupTabela(nomeTabela);

      // 2d. Inserir dados
      await salvarNoBanco(nomeTabela, linhas);

      console.log();
    }

    const resumo = `Tabelas atualizadas: ${Object.values(CONSULTAS).join(", ")}`;
    debug("CONCLUÍDO", resumo);
    console.log("\n✅ Importação finalizada com sucesso em", new Date().toLocaleString("pt-BR"));

    return { success: true };
  } catch (error) {
    console.error("\n❌ FALHA NO PROCESSO DE IMPORTAÇÃO:");
    console.error(error.message);
    throw error;
  }
}

module.exports = { populateExecucao2026 };