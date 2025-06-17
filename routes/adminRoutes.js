const express = require("express");
const adminController = require("../controllers/adminController");
const router = express.Router();

// POST routes
router.post("/api/admin-process-claim", adminController.adminProcessClaim);
router.post("/api/admin/send-stats-update-email", adminController.sendStatsEmail);
router.post("/api/assign-player-to-team", adminController.assignPlayerToTeam);
router.post("/api/change-role", adminController.changeRole);
router.post("/api/clear-weekscores", adminController.clearWeekscores);
router.post("/api/setLockTimes", adminController.submitLockTimes);
router.post("/clear-players", adminController.clearPlayers);
router.post("/generate-schedule", adminController.generateSchedule);

// PUT routes
router.put("/api/player/:playerId/position", adminController.changePosition);

// DELETE routes
router.delete("/api/clear-transactions", adminController.deleteTransactions);
router.delete("/player/remove/:playerId", adminController.removePlayer);
router.delete("/team/name/:teamName", adminController.deleteTeam);

module.exports = router;