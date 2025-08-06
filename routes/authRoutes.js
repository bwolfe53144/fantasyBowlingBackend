const express = require("express");
const { validateUser, validatePasswordOnly } = require("../controllers/validateController");
const authController = require("../controllers/authController");
const router = express.Router();

router.get("/user", authController.getUser);

router.post("/auth/forgot-password", authController.forgotPassword);
router.post("/auth/reset-password/:token", validatePasswordOnly, authController.resetPassword);
router.post("/signin", authController.login);
router.post("/signup", validateUser, authController.signup);

module.exports = router;