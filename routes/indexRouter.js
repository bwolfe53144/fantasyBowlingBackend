const express = require("express");

const adminRoutes = require("./adminRoutes");
const authRoutes = require("./authRoutes");
const claimRoutes = require("./claimRoutes");
const messageRoutes = require("./messageRoutes");
const miscRoutes = require("./miscRoutes");
const playerRoutes = require("./playerRoutes");
const playoffRoutes = require("./playoffRoutes")
const rosterRoutes = require("./rosterRoutes");
const survivorRoutes = require("./survivorRoutes");
const teamRoutes = require("./teamRoutes");
const weekRoutes = require("./weekRoutes");

const router = express.Router();

router.use(adminRoutes);
router.use(authRoutes);
router.use(claimRoutes);
router.use(messageRoutes);
router.use(miscRoutes);
router.use(playerRoutes);
router.use(playoffRoutes);
router.use(rosterRoutes);
router.use(survivorRoutes);
router.use(teamRoutes);
router.use(weekRoutes);

module.exports = router;