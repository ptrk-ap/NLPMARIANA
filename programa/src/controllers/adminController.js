const { populateContratos } = require("../utils/populate_contratos");
const { populateCredores } = require("../utils/populate_credores");
const { populateEmendas } = require("../utils/populate_emendas");
const { populateExecucao2026 } = require("../utils/populate_execucao2026");

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
  }
};

module.exports = adminController;
