const express = require("express");
const { validateUser } = require("../controllers/validateController");
const authController = require("../controllers/authController");
const router = express.Router();

router.get("/user", authController.getUser);

router.post("/signin", authController.login);
router.post("/signup", validateUser, authController.signup);

module.exports = router;