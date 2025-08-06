const express = require("express");
const multer = require('multer');
const path = require("path");
const miscController = require("../controllers/miscController");


const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, "../uploads/"),
});

// GET routes
router.get("/api/get-users", miscController.getUsers);
router.get("/api/match/:id", miscController.getMatchups);
router.get("/api/matches/recent/:teamName/:week", miscController.getRecentMatches);
router.get("/api/owner/:ownerName", miscController.getOwner);
router.get("/api/owners", miscController.getAllOwners);
router.get("/api/transactions/recent", miscController.getTransactions);
router.get("/get-all-lock-statuses", miscController.getAllLockStatuses);
router.get("/api/schedule", miscController.getSchedule);
router.get("/totalLeagues", miscController.getAllLeagues);

// PATCH routes
router.patch("/change-team-name", miscController.changeTeamName);
router.patch("/update-color", miscController.updateColor);
router.patch("/api/user/email-subscription", miscController.handleEmail);

// POST routes
router.post("/upload-avatar", upload.single('avatar'), miscController.uploadAvatar);

module.exports = router;