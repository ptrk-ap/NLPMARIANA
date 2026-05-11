const app = require("./app");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

// Validação básica de variáveis de ambiente
const requiredEnv = ["PORT", "API_USERNAME", "API_PASSWORD"];
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

app.listen(PORT, () => {
  console.log(`🔥 Servidor rodando na porta ${PORT}`);
  console.log("🚀 Pressione Ctrl+C para encerrar");
});
