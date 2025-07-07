const express = require("express");
const messageController = require("../controllers/messageController");
const router = express.Router();

// GET routes
router.get("/api/starred-messages/:userId", messageController.getStarredMessages);
router.get("/messages", messageController.getMessages);
router.get("/messages/:id", messageController.viewMessage);

// POST routes
router.post("/add-comment", messageController.addComment);
router.post("/api/messages/:id/global-star", messageController.globalStarMessage);
router.post("/messages", messageController.postMessage);
router.post("/star-message/:messageId", messageController.postStarMessage);

// DELETE routes
router.delete("/message/:id", messageController.deleteMessage);

module.exports = router;