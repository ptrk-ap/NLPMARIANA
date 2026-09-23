const app = require("./app");
const db = require("./database/connection");

// Validação básica de variáveis de ambiente
const requiredEnv = [
  "PORT",
  "API_USERNAME",
  "API_PASSWORD",
  "DATABASE_URL",
  "TRIGGER_USERNAME",
  "TRIGGER_PASSWORD"
];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(`❌ Erro: Variáveis de ambiente ausentes: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

// Tratamento de erros não capturados no processo
async function testarConexaoBanco() {
  try {
    await db.raw("SELECT 1");
    console.log("✅ Banco de dados conectado e no ar!");
    return true;
  } catch (error) {
    console.error("❌ Falha ao conectar ao banco de dados:", error.message);
    return false;
  }
}

app.get("/health", async (_req, res) => {
  if (await testarConexaoBanco()) {
    return res.status(200).json({ status: "ok" });
  }

  return res.status(503).json({ status: "indisponível" });
});

let server;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Sinal ${signal} recebido. Encerrando o servidor...`);

  server.close(async (error) => {
    try {
      await db.destroy();
    } catch (dbError) {
      console.error("Falha ao encerrar conexões com o banco:", dbError.message);
    }

    if (error) {
      console.error("Falha ao encerrar o servidor HTTP:", error.message);
      process.exit(1);
    }

    process.exit(0);
  });
}

async function start() {
  if (!(await testarConexaoBanco())) {
    process.exit(1);
  }

  server = app.listen(PORT, () => {
    console.log(`🔥 Servidor rodando na porta ${PORT}`);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("uncaughtException", (error) => {
  console.error("❌ EXCEÇÃO NÃO CAPTURADA:", error);
  shutdown("uncaughtException");
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ REJEIÇÃO NÃO TRATADA:", reason);
  shutdown("unhandledRejection");
});

start();
