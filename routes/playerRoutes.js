const express = require("express");
const playerController = require("../controllers/playerController");
const router = express.Router();

// GET routes
router.get("/api/player-by-name/:fullname", playerController.getPlayerStats);
router.get("/players", playerController.getPlayers);
router.get("/unassigned-players", playerController.getUnassignedPlayers);

// POST routes
router.post("/api/player", playerController.addPlayer);

// DELETE routes
router.delete("/players/drop/:playerId/:teamId", playerController.dropMyPlayer);

module.exports = router;