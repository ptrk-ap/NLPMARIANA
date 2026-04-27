const express = require("express");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.post("/populateBase", adminController.populateBase);
router.post("/carregarExercicioAtual", adminController.carregarExercicioAtual);
router.post("/excluirTabelaExecucao2026", adminController.excluirTabelaExecucao2026);

module.exports = router;
