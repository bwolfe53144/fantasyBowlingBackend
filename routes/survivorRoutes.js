const express = require("express");
const survivorController = require("../controllers/survivorController");
const router = express.Router();

// GET routes
router.get("/api/survivor-eligible-players/:league/:teamName", survivorController.getEligibleSurvivorPlayers);
router.get("/survivor-entries/:userId", survivorController.getSurvivorEntries);
router.get("/api/survivor-entries/:league", survivorController.getSurvivorEntriesByLeague);
router.get("/api/survivor-picks/:league/:teamName", survivorController.getSurvivorTeamPicks);
router.get("/api/survivor-picks/user/:league/:teamName", survivorController.getSurvivorUserPicks);

// POST routes
router.post("/api/survivor/complete-week", survivorController.completeSurvivorWeek);
router.post("/api/survivor/signup", survivorController.createSurvivorTeam);
router.post("/survivor/reset-league", survivorController.resetSurvivorLeague);
router.post("/api/survivor-picks/:league/:teamName", survivorController.submitSurvivorPicks);

module.exports = router;