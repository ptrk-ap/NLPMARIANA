const { populateContratos } = require("../utils/populate_contratos");
const { populateCredores } = require("../utils/populate_credores");
const { populateEmendas } = require("../utils/populate_emendas");
const { populateExecucao2026, excluirTabelaExecucao2026 } = require("../utils/populate_execucao2026");
const { populateExecucao2025 } = require("../utils/populate_execucao2025");
const { populateExecucao2024 } = require("../utils/populate_execucao2024");
const { testeConsulta010468 } = require("../utils/testeConsulta010468");

const adminController = {
  async populateBase(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando população da base (Contratos, Credores, Emendas)...");

      const resultados = {
        contratos: await populateContratos(),
        credores: await populateCredores(),
        emendas: await populateEmendas()
      };

      return res.status(200).json({
        message: "População da base concluída com sucesso.",
        details: resultados
      });
    } catch (error) {
      console.error("Erro ao popular base:", error);
      return res.status(500).json({
        error: "Ocorreu um erro ao processar a população da base.",
        message: error.message
      });
    }
  },

  async carregarExercicioAtual(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando carregamento do exercício atual (execucao2026)...");

      const resultado = await populateExecucao2026();

      return res.status(200).json({
        message: "Carregamento do exercício atual concluído com sucesso.",
        details: resultado
      });
    } catch (error) {
      console.error("Erro ao carregar exercício atual:", error);
      return res.status(500).json({
        error: "Ocorreu um erro ao processar o carregamento do exercício atual.",
        message: error.message
      });
    }
  },

  async carregar2025(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando carregamento do exercício 2025 (execucao2025)...");

      const resultado = await populateExecucao2025();

      return res.status(200).json({
        message: "Carregamento do exercício 2025 concluído com sucesso.",
        details: resultado
      });
    } catch (error) {
      console.error("Erro ao carregar exercício 2025:", error);
      return res.status(500).json({
        error: "Ocorreu um erro ao processar o carregamento do exercício 2025.",
        message: error.message
      });
    }
  },

  async carregar2024(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando carregamento do exercício 2024 (execucao2024)...");

      const resultado = await populateExecucao2024();

      return res.status(200).json({
        message: "Carregamento do exercício 2024 concluído com sucesso.",
        details: resultado
      });
    } catch (error) {
      console.error("Erro ao carregar exercício 2024:", error);
      return res.status(500).json({
        error: "Ocorreu um erro ao processar o carregamento do exercício 2024.",
        message: error.message
      });
    }
  },

  async excluirTabelaExecucao2026(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando exclusão da tabela execucao2026...");

      const resultado = await excluirTabelaExecucao2026();

      return res.status(200).json({
        message: resultado.message,
        details: resultado
      });
    } catch (error) {
      console.error("Erro ao excluir tabela execucao2026:", error);
      return res.status(500).json({
        error: "Ocorreu um erro ao processar a exclusão da tabela.",
        message: error.message
      });
    }
  },
  async testeConsulta2025(req, res) {
    const { user, password } = req.body;

    if (user !== process.env.TRIGGER_USERNAME || password !== process.env.TRIGGER_PASSWORD) {
      return res.status(401).json({ error: "Acesso negado. Credenciais inválidas." });
    }

    try {
      console.log("Iniciando teste: relatório 010468 vs execucao2025...");
      const resultado = await testeConsulta010468();
      return res.status(200).json(resultado);
    } catch (error) {
      console.error("Erro no teste 010468:", error);
      return res.status(500).json({
        error: "Falha ao executar o teste.",
        message: error.message,
      });
    }
  },
};

module.exports = adminController;
