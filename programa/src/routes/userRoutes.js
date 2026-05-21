const express = require("express");
const userController = require("../controllers/userController");
const ugController = require("../controllers/ugController");

const router = express.Router();

router.get("/", userController.listUsers);
router.get("/ug", ugController.listUg);
router.post("/", userController.createUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
