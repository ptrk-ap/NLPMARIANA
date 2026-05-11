/**
 * testeConsulta010468.js
 *
 * Teste automatizado: busca o relatório 010468 ("Despesa por Orgão") da API
 * FlexSiafe com parâmetro ?params=2025 e compara com os resultados gerados
 * pelo sistema de consulta de linguagem natural.
 */

require("dotenv").config();
const knex = require("../database/connection");
const { parse } = require("csv-parse/sync");
const iconv = require("iconv-lite");
const { request, jsonRequest } = require("./httpHelper");

// NLP Services
const OrcamentoService = require("../services/entidades/OrcamentoService");
const ExtratorTermosService = require("../services/entidades/ExtratorTermosService");
const Splitservice = require("../services/entidades/splitService");
const filtroService = require("../services/filtros/filtroService");
const QueryService = require("../services/query/queryService");

const queryService = new QueryService();

// ─── Configurações ────────────────────────────────────────────────────────────

const API_BASE = "https://siplag.ap.gov.br/FlexSiafeAP/api";
const CONSULTA_ID = "010468";
const PARAMS_ANO = "2025";
const FRASE_TESTE = "despesa empenhada liquidada e paga por unidade gestora em 2025";

// Tolerância para comparação de valores financeiros (diferença absoluta)
const TOLERANCIA_DECIMAL = 0.05;

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
      "User-Agent": "Mozilla/5.0 (compatible; testeConsulta010468/1.0)",
    },
  };

  const { statusCode, data } = await jsonRequest(options, payload);

  if (statusCode !== 200) {
    const msg = typeof data === "object" ? JSON.stringify(data) : data;
    throw new Error(`Erro na autenticação. HTTP ${statusCode}: ${msg}`);
  }

  if (!data || !data.token) throw new Error("Token não encontrado na resposta da API.");
  return data.token;
}

async function buscarCSVRelatorio(token) {
  const path = `/FlexSiafeAP/api/consultas/${CONSULTA_ID}/CSV?params=${PARAMS_ANO}`;

  const options = {
    hostname: "siplag.ap.gov.br",
    path,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Content-Length": 2,
      "User-Agent": "Mozilla/5.0 (compatible; testeConsulta010468/1.0)",
    },
  };

  const { statusCode, body } = await request(options, "{}");

  if (statusCode === 204) throw new Error("API retornou 204 — relatório 010468 sem dados para o ano 2025.");
  if (statusCode !== 200) throw new Error(`Erro ao buscar relatório. HTTP ${statusCode}: ${body.toString()}`);

  return iconv.decode(body, "utf-8");
}

// ─── Parse do CSV ─────────────────────────────────────────────────────────────

function converterDecimal(valor) {
  if (!valor || valor.trim() === "" || valor.trim() === "-") return 0;
  const formatado = valor.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(formatado);
  return isNaN(num) ? 0 : num;
}

function encontrarColuna(cabecalho, termos) {
  for (const termo of termos) {
    const idx = cabecalho.findIndex(
      (h) => h && h.toLowerCase().includes(termo.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
}

function parsearCSVRelatorio(csvText) {
  const records = parse(csvText, {
    delimiter: ";",
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
  });

  if (records.length < 2) throw new Error("CSV do relatório está vazio ou sem dados.");

  const cabecalho = records[0].map((h) => h.trim());

  const idxUnidadeGestora = encontrarColuna(cabecalho, [
    "unidade gestora", "unidade_gestora", "orgão", "orgao", "órgão",
  ]);
  const idxDotacao = encontrarColuna(cabecalho, [
    "dotacao inicial", "dotação inicial", "dotacao_inicial",
  ]);
  const idxEmpenhado = encontrarColuna(cabecalho, [
    "despesas empenhadas", "empenhadas", "despesas_empenhadas", "empenho",
  ]);
  const idxLiquidado = encontrarColuna(cabecalho, [
    "despesas liquidadas", "liquidadas", "despesas_liquidadas", "liquidacao",
  ]);
  const idxPago = encontrarColuna(cabecalho, [
    "despesas pagas", "pagas", "despesas_pagas", "pagamento",
  ]);

  if (idxUnidadeGestora === -1) {
    throw new Error(`Coluna 'unidade_gestora' não encontrada no CSV.`);
  }

  const dados = new Map();

  for (let i = 1; i < records.length; i++) {
    const cols = records[i];
    const ug = cols[idxUnidadeGestora] ? cols[idxUnidadeGestora].trim() : null;
    if (!ug || ug === "" || ug === "-") continue;

    const entrada = dados.get(ug) || {
      unidade_gestora: ug,
      dotacao_inicial: idxDotacao !== -1 ? 0 : null,
      despesas_empenhadas: idxEmpenhado !== -1 ? 0 : null,
      despesas_liquidadas: idxLiquidado !== -1 ? 0 : null,
      despesas_pagas: idxPago !== -1 ? 0 : null,
    };

    if (idxDotacao !== -1) entrada.dotacao_inicial += converterDecimal(cols[idxDotacao]);
    if (idxEmpenhado !== -1) entrada.despesas_empenhadas += converterDecimal(cols[idxEmpenhado]);
    if (idxLiquidado !== -1) entrada.despesas_liquidadas += converterDecimal(cols[idxLiquidado]);
    if (idxPago !== -1) entrada.despesas_pagas += converterDecimal(cols[idxPago]);

    dados.set(ug, entrada);
  }

  return dados;
}

// ─── Sistema de Consulta Natural ───────────────────────────────────────────────

async function consultarViaLinguagemNatural(frase) {
  console.log(`  Processando frase: "${frase}"`);

  // Mimetiza a lógica do ConsultaController
  const fraseProcessada = OrcamentoService.traduzirParaTermosSql(frase);
  const parametrosEncontrados = ExtratorTermosService.identificarParametros(fraseProcessada);
  const divisor = Splitservice.quebrarFrase(fraseProcessada);
  const filtros = await filtroService.processarFiltros(divisor);
  const anosQuery = filtroService.resolverAnos(filtros);

  console.log(`  Filtros extraídos:`, JSON.stringify(filtros));
  console.log(`  Anos detectados:`, anosQuery);

  const queries = queryService.buildQuery(parametrosEncontrados, filtros, anosQuery);
  const firstQuery = Object.values(queries)[0];
  if (firstQuery) {
    console.log(`  SQL Gerado (exemplo): ${firstQuery.sql.substring(0, 100)}...`);
  }

  const rows = await queryService.executar(queries);

  const dados = new Map();
  for (const row of rows) {
    const ug = row.unidade_gestora ? row.unidade_gestora.trim() : "N/D";
    dados.set(ug, {
      unidade_gestora: ug,
      dotacao_inicial: parseFloat(row.soma_dotacao_inicial) || 0,
      despesas_empenhadas: parseFloat(row.soma_despesas_empenhadas) || 0,
      despesas_liquidadas: parseFloat(row.soma_despesas_liquidadas) || 0,
      despesas_pagas: parseFloat(row.soma_despesas_pagas) || 0,
    });
  }

  return dados;
}

// ─── Comparação ───────────────────────────────────────────────────────────────

function compararDados(dadosApi, dadosNlp) {
  const keysApi = new Set(dadosApi.keys());
  const keysNlp = new Set(dadosNlp.keys());

  const apenasNaApi = [...keysApi].filter((k) => !keysNlp.has(k));
  const apenasNoNlp = [...keysNlp].filter((k) => !keysApi.has(k));
  const emAmbos = [...keysApi].filter((k) => keysNlp.has(k));

  const comparativo = [];
  const divergenciasDeValor = [];
  const coincidentes = [];

  for (const ug of emAmbos) {
    const api = dadosApi.get(ug);
    const nlp = dadosNlp.get(ug);

    const campos = ["dotacao_inicial", "despesas_empenhadas", "despesas_liquidadas", "despesas_pagas"];
    const detalhesCampos = {};
    let temDivergencia = false;

    for (const campo of campos) {
      if (api[campo] === null) {
        detalhesCampos[campo] = { status: "N/A" };
        continue;
      }

      const valApi = api[campo] || 0;
      const valNlp = nlp[campo] || 0;
      const diff = Math.abs(valApi - valNlp);
      const houveDiferenca = diff > TOLERANCIA_DECIMAL;

      detalhesCampos[campo] = {
        api: valApi,
        nlp: valNlp,
        diferenca: parseFloat(diff.toFixed(4)),
        status: houveDiferenca ? "DIVERGENTE" : "OK"
      };

      if (houveDiferenca) temDivergencia = true;
    }

    const itemComparativo = {
      unidade_gestora: ug,
      campos: detalhesCampos,
      statusGeral: temDivergencia ? "DIVERGENTE" : "OK"
    };

    comparativo.push(itemComparativo);

    if (temDivergencia) {
      divergenciasDeValor.push(itemComparativo);
    } else {
      coincidentes.push(ug);
    }
  }

  return {
    totalApi: keysApi.size,
    totalNlp: keysNlp.size,
    totalCoincidentes: coincidentes.length,
    totalDivergencias: divergenciasDeValor.length,
    apenasNaApi,
    apenasNoNlp,
    comparativo,
    divergenciasDeValor,
    coincidentes,
  };
}

// ─── Função Principal Exportada ───────────────────────────────────────────────

async function testeConsulta010468() {
  console.log("=== Teste Funcional: Linguagem Natural ↔ API 010468 ===\n");

  const apiUsuario = process.env.API_USERNAME;
  const apiSenha = process.env.API_PASSWORD;

  if (!apiUsuario || !apiSenha) {
    throw new Error("Credenciais da API ausentes no .env.");
  }

  try {
    console.log("1. Autenticando na API...");
    const token = await autenticar(apiUsuario, apiSenha);
    console.log("   ✔ Token obtido.\n");

    console.log(`2. Buscando relatório GROUND TRUTH (API ${CONSULTA_ID})...`);
    const csvText = await buscarCSVRelatorio(token);
    const dadosApi = parsearCSVRelatorio(csvText);
    console.log(`   ✔ ${dadosApi.size} unidades gestoras encontradas na API.\n`);

    console.log("3. Consultando via SISTEMA DE LINGUAGEM NATURAL...");
    const dadosNlp = await consultarViaLinguagemNatural(FRASE_TESTE);
    console.log(`   ✔ ${dadosNlp.size} unidades gestoras retornadas pelo sistema.\n`);

    console.log("4. Comparando resultados...");
    const resultado = compararDados(dadosApi, dadosNlp);

    console.log("\n─── SUMÁRIO DA COMPARAÇÃO ────────────────────────────");
    console.log(`  Frase testada  : "${FRASE_TESTE}"`);
    console.log(`  Total API      : ${resultado.totalApi}`);
    console.log(`  Total Sistema  : ${resultado.totalNlp}`);
    console.log(`  ✅ Coincidentes : ${resultado.totalCoincidentes}`);
    console.log(`  🔢 Divergências : ${resultado.totalDivergencias}`);

    if (resultado.comparativo.length > 0) {
      console.log("\n  Comparativo Detalhado (Unidades em Comum):");
      console.log("  " + "UNIDADE GESTORA".padEnd(50) + " | STATUS | CAMPOS");
      console.log("  " + "-".repeat(50) + "-|--------|-------");

      for (const item of resultado.comparativo) {
        const statusStr = item.statusGeral === "OK" ? "✅ OK" : "❌ DIV";
        const divergentes = Object.entries(item.campos)
          .filter(([_, v]) => v.status === "DIVERGENTE")
          .map(([k, _]) => k);

        console.log(`  ${item.unidade_gestora.padEnd(50)} | ${statusStr.padEnd(6)} | ${divergentes.join(", ") || "-"}`);

        if (divergentes.length > 0) {
          for (const campo of divergentes) {
            const v = item.campos[campo];
            console.log(`     └─ ${campo.padEnd(20)}: API=${v.api.toFixed(2).padStart(12)} | NLP=${v.nlp.toFixed(2).padStart(12)} | Δ=${v.diferenca.toFixed(2)}`);
          }
        }
      }
    }

    if (resultado.apenasNaApi.length > 0) {
      console.log("\n  ❌ Unidades na API mas ausentes no Sistema:");
      resultado.apenasNaApi.forEach(ug => console.log(`     - ${ug}`));
    }

    if (resultado.apenasNoNlp.length > 0) {
      console.log("\n  ⚠️ Unidades no Sistema mas ausentes na API:");
      resultado.apenasNoNlp.forEach(ug => console.log(`     - ${ug}`));
    }

    console.log("\n✅ Teste funcional finalizado.");

    return {
      status: "concluido",
      frase: FRASE_TESTE,
      ...resultado,
    };
  } catch (error) {
    console.error("\n❌ FALHA NO TESTE:", error.message);
    throw error;
  }
}

module.exports = { testeConsulta010468 };

if (require.main === module) {
  testeConsulta010468().then(() => knex.destroy()).catch(() => process.exit(1));
}
