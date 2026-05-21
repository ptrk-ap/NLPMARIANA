const express = require("express");
const consultaController = require("../controllers/consultaController");


const router = express.Router();

router.post("/", consultaController.consulta);


module.exports = router;
