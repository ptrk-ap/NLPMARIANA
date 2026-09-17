const app = require("./app");
const db = require("./database/connection");

// Validação básica de variáveis de ambiente
const requiredEnv = ["PORT", "API_USERNAME", "API_PASSWORD", "DATABASE_URL"];
const missingEnv = requiredEnv.filter(env => !process.env[env]);

if (missingEnv.length > 0) {
  console.error(`❌ Erro: Variáveis de ambiente ausentes: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const PORT = process.env.PORT || 3001;

// Tratamento de erros não capturados no processo
process.on("uncaughtException", (error) => {
  console.error("❌ EXCEÇÃO NÃO CAPTURADA:", error);
  // Em produção, você pode querer fechar o servidor graciosamente aqui
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ REJEIÇÃO NÃO TRATADA em:", promise, "motivo:", reason);
});

// Testa a conexão com o banco de dados ao iniciar
async function testarConexaoBanco() {
  try {
    await db.raw("SELECT 1");
    console.log("✅ Banco de dados conectado e no ar!");
  } catch (error) {
    console.error("❌ Falha ao conectar ao banco de dados:", error.message);
  }
}

app.listen(PORT, async () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
  console.log("🚀 Pressione Ctrl+C para encerrar");
  await testarConexaoBanco();
});
