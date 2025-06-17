const express = require("express");
const playoffController = require("../controllers/playoffController");

const router = express.Router();

router.post("/api/playoffs/generate", playoffController.generatePlayoffs);

module.exports = router;