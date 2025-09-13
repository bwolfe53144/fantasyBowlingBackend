const express = require("express");
const weekController = require("../controllers/weekController");
const router = express.Router();

// GET routes
router.get("/api/weeklocks/completed", weekController.getCompletedWeeks);
router.get("/api/weeklocks/incomplete", weekController.getIncompleteWeeklocks);
router.get("/findCompletedLeagues/:week", weekController.findCompletedLeagues);
router.get("/getCurrentWeek", weekController.findCurrentWeek);
router.get("/getLeagueCurrentWeek/:league", weekController.getLeagueCurrentWeek);
router.get("/matchups/week/:week", weekController.findMatchupsForWeek);
router.get("/weeks", weekController.getWeeks);
router.get("/weekscoreForWeek/:week", weekController.findWeekScoresForWeek);

// POST routes
router.post("/api/weeklocks/complete", weekController.completeWeekLock);
router.post("/api/weekscore", weekController.submitWeekScore);

module.exports = router;