function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ❌ ERRO:`, err.message || err);

  // Log detalhado para depuração
  if (process.env.NODE_ENV !== "production") {
    console.error(err.stack);
  }

  // Entrada duplicada no banco
  if (err.code === "ER_DUP_ENTRY") {
    return res.status(409).json({
      error: "Entrada duplicada",
      message: "Este registro já existe no sistema.",
    });
  }

  // Banco de dados ou serviço externo inacessível
  if (err.code === "ECONNREFUSED") {
    return res.status(503).json({
      error: "Serviço Indisponível",
      message: "Não foi possível conectar ao banco de dados ou serviço externo.",
    });
  }

  // Erros de validação lançados manualmente
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Erro de Validação",
      message: err.message,
    });
  }

  // Erro padrão
  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    error: statusCode === 500 ? "Erro Interno do Servidor" : "Erro",
    message: err.message || "Ocorreu um erro inesperado.",
    timestamp,
  });
}

module.exports = errorHandler;
