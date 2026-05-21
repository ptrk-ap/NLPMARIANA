const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.post("/populateBase", adminController.populateBase);
router.post("/carregarExercicioAtual", adminController.carregarExercicioAtual);
router.post("/carregar2025", adminController.carregar2025);
router.post("/carregar2024", adminController.carregar2024);
router.post("/excluirTabelaExecucao2026", adminController.excluirTabelaExecucao2026);
router.post("/testeConsulta2025", adminController.testeConsulta2025);

module.exports = router;
