const express = require("express");
const teamController = require("../controllers/teamController");
const router = express.Router();

// GET routes
router.get("/api/fantasy-team/:teamName/players", teamController.getFantasyTeamPlayers);
router.get("/api/team/:league/:teamName/ranks", teamController.getTeamRanks);
router.get("/api/team/:teamName/players", teamController.getTeamPlayers);
router.get("/api/trades/:id", teamController.getTradeById);
router.get("/prior-years", teamController.getPriorYears);
router.get("/prior-year-standings/:year", teamController.getSpecificYear);
router.get("/roster-lock-status/:teamId/:week", teamController.checkLockStatus);
router.get("/team-by-id/:teamId", teamController.getTeamById);
router.get("/team/:name", teamController.getTeam);
router.get("/teams", teamController.getTeams);
router.get("/teamsForHome", teamController.getTeamsForHome);
router.get("/trades", teamController.getTrades);

// POST routes
router.post("/create-team", teamController.createTeam);
router.post("/api/trades/:id/accept", teamController.acceptTrade);
router.post("/api/trades/:id/decline", teamController.declineTrade);
router.post("/api/trades/:tradeId/vote", teamController.tradeVote);
router.post("/api/trades/propose", teamController.proposeTrade);
router.post("/trades/mark-viewed", teamController.markTradeViewed);

// PUT routes
router.put("/api/team/:id", teamController.updateTeam);

module.exports = router;