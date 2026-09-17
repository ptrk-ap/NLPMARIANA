/**
 * iniciarBanco.js
 *
 * Script de inicialização do ambiente de dados.
 *
 * ─── Configuração ───────────────────────────────────────────────────────────
 * Edite a variável ANOS_CARREGAR abaixo para escolher quais exercícios carregar.
 * Exemplos:
 *   const ANOS_CARREGAR = [2024, 2025, 2026];  → carrega os 3 anos
 *   const ANOS_CARREGAR = [2026];               → carrega apenas 2026
 *   const ANOS_CARREGAR = [2025, 2026];         → carrega 2025 e 2026
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Etapa 1 — Tabelas principais (executadas em paralelo, conforme ANOS_CARREGAR).
 * Etapa 2 — Tabelas derivadas (somente se ao menos 1 tabela principal for criada):
 *   - populate_contratos
 *   - populate_emendas
 *   - populate_credores
 *
 * Uso:
 *   node src/utils/iniciarBanco/iniciarBanco.js
 */

const path = require("path");
require("dotenv").config({
  path: path.resolve(__dirname, "../../../.env.production") !== undefined &&
        require("fs").existsSync(path.resolve(__dirname, "../../../.env.production"))
    ? path.resolve(__dirname, "../../../.env.production")
    : path.resolve(__dirname, "../../../.env"),
});

const knex = require("../../database/connection");
const { populateExecucao2024 } = require("../populate_execucao2024");
const { populateExecucao2025 } = require("../populate_execucao2025");
const { populateExecucao2026 } = require("../populate_execucao2026");
const { populateContratos }    = require("../populate_contratos");
const { populateEmendas }      = require("../populate_emendas");
const { populateCredores }     = require("../populate_credores");

// ─── Configuração: Anos a Carregar ────────────────────────────────────────────
// Altere essa variável para escolher quais exercícios serão importados.
// Valores válidos: 2024, 2025, 2026
const ANOS_CARREGAR = [2024, 2025, 2026];

// Mapa de todos os anos disponíveis → função de importação correspondente
const POPULATORS = {
  2024: { nome: "populate_execucao2024", fn: populateExecucao2024 },
  2025: { nome: "populate_execucao2025", fn: populateExecucao2025 },
  2026: { nome: "populate_execucao2026", fn: populateExecucao2026 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function linha(char = "─", tamanho = 60) {
  return char.repeat(tamanho);
}

function log(msg) {
  const ts = new Date().toLocaleTimeString("pt-BR");
  console.log(`[${ts}] ${msg}`);
}

/**
 * Executa uma função populate e retorna { nome, sucesso, erro }.
 * Nunca lança exceção — permite que o restante do script continue.
 */
async function tentar(nome, fn) {
  log(`▶ Iniciando: ${nome}`);
  try {
    await fn();
    log(`✅ Concluído: ${nome}`);
    return { nome, sucesso: true };
  } catch (err) {
    log(`❌ Falhou: ${nome} → ${err.message}`);
    return { nome, sucesso: false, erro: err.message };
  }
}

// ─── Script Principal ─────────────────────────────────────────────────────────

async function iniciarBanco() {
  console.log("\n" + linha("═"));
  console.log("  INICIALIZAÇÃO DO AMBIENTE DE DADOS");
  console.log(linha("═") + "\n");

  // ── Validação da configuração ─────────────────────────────────────────────
  const anosValidos = Object.keys(POPULATORS).map(Number);
  const anosInvalidos = ANOS_CARREGAR.filter((a) => !anosValidos.includes(a));
  if (anosInvalidos.length > 0) {
    log(`❌ ANOS_CARREGAR contém anos inválidos: ${anosInvalidos.join(", ")}. Válidos: ${anosValidos.join(", ")}`);
    await knex.destroy();
    process.exit(1);
  }
  if (ANOS_CARREGAR.length === 0) {
    log("❌ ANOS_CARREGAR está vazio. Adicione ao menos um ano para carregar.");
    await knex.destroy();
    process.exit(1);
  }

  // ── Etapa 1: Tabelas Principais ──────────────────────────────────────────
  console.log(linha());
  log(`ETAPA 1 — Carregando tabelas principais: execução ${ANOS_CARREGAR.join(" / ")}`);
  console.log(linha() + "\n");

  // Monta apenas os jobs dos anos configurados em ANOS_CARREGAR
  const jobsPrincipais = ANOS_CARREGAR.map((ano) => {
    const { nome, fn } = POPULATORS[ano];
    return tentar(nome, fn);
  });

  // Rodam em paralelo; um erro não impede os outros
  const resultadosPrincipais = await Promise.all(jobsPrincipais);

  const principaisOk     = resultadosPrincipais.filter((r) => r.sucesso);
  const principaisFalhou = resultadosPrincipais.filter((r) => !r.sucesso);
  const totalPrincipais  = ANOS_CARREGAR.length;

  console.log("\n" + linha());
  log(`ETAPA 1 concluída — Sucesso: ${principaisOk.length}/${totalPrincipais}   Falhas: ${principaisFalhou.length}/${totalPrincipais}`);
  if (principaisFalhou.length > 0) {
    principaisFalhou.forEach((r) => log(`  ⚠️  ${r.nome}: ${r.erro}`));
  }
  console.log(linha() + "\n");

  // ── Verificação: ao menos uma tabela principal deve ter sido criada ───────
  if (principaisOk.length === 0) {
    console.log(linha("═"));
    log("⛔  Nenhuma tabela principal foi criada com sucesso.");
    log("    As tabelas derivadas (contratos, emendas, credores) não serão processadas.");
    log("    Verifique as credenciais (API_USERNAME / API_PASSWORD) e a conexão com o banco.");
    console.log(linha("═") + "\n");
    await knex.destroy();
    process.exit(1);
  }

  // ── Etapa 2: Tabelas Derivadas ────────────────────────────────────────────
  console.log(linha());
  log("ETAPA 2 — Carregando tabelas derivadas (contratos / emendas / credores)");
  console.log(linha() + "\n");

  const [rContratos, rEmendas, rCredores] = await Promise.all([
    tentar("populate_contratos", populateContratos),
    tentar("populate_emendas",   populateEmendas),
    tentar("populate_credores",  populateCredores),
  ]);

  const derivadasOk      = [rContratos, rEmendas, rCredores].filter((r) => r.sucesso);
  const derivadasFalhou  = [rContratos, rEmendas, rCredores].filter((r) => !r.sucesso);

  console.log("\n" + linha());
  log(`ETAPA 2 concluída — Sucesso: ${derivadasOk.length}/3   Falhas: ${derivadasFalhou.length}/3`);
  if (derivadasFalhou.length > 0) {
    derivadasFalhou.forEach((r) => log(`  ⚠️  ${r.nome}: ${r.erro}`));
  }
  console.log(linha() + "\n");

  // ── Resumo Final ──────────────────────────────────────────────────────────
  const totalEtapas  = totalPrincipais + 3; // anos + 3 derivadas
  const totalSucesso = principaisOk.length + derivadasOk.length;
  const totalFalha   = principaisFalhou.length + derivadasFalhou.length;

  console.log(linha("═"));
  log(`RESUMO FINAL — Anos configurados: ${ANOS_CARREGAR.join(", ")}`);
  log(`             — ${totalSucesso}/${totalEtapas} etapas concluídas com sucesso`);
  if (totalFalha > 0) {
    log(`             — ${totalFalha}/${totalEtapas} etapas falharam (veja os detalhes acima)`);
  }
  console.log(linha("═") + "\n");

  await knex.destroy();
  process.exit(totalFalha === 0 ? 0 : 2);
}

iniciarBanco().catch(async (err) => {
  console.error("\n❌ Erro inesperado no script de inicialização:", err.message);
  await knex.destroy();
  process.exit(1);
});
