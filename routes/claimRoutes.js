const express = require("express");
const authenticateToken = require('../middleware/authMiddleware');
const claimController = require("../controllers/claimController");
const router = express.Router();

// POST routes
router.post("/api/claims/with-drop", claimController.pickDropPlayer);

// GET routes
router.get("/api/claims/all", claimController.viewAllClaims);
router.get("/api/claims/my", authenticateToken, claimController.viewMyClaims);

// DELETE routes
router.delete("/api/claims/delete/:playerId", claimController.deleteClaim);

module.exports = router;