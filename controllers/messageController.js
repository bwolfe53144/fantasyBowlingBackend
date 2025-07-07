const db = require("../db/messageQueries");

async function getMessages(req, res) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  const userId = req.query.userId;

  try {
    const { messages, starredMessages, totalMessages } = await db.findMessages({
      skip,
      take: limit,
      userId,
    });

    res.json({ messages, starredMessages, totalMessages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    res.status(500).json({ error: "Failed to fetch messages." });
  }
}

async function viewMessage(req, res) {
  try {
    const { id } = req.params;
    const message = await db.findMessageById(id);

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    res.json(message);
  } catch (error) {
    console.error("Error fetching message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function postMessage(req, res) {
  const { title, content, authorId } = req.body;

  if (!title || !content || !authorId) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const formattedTitle = title
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  const formattedContent = content.charAt(0).toUpperCase() + content.slice(1);

  try {
    const newMessage = await db.createMessage({
      title: formattedTitle,
      content: formattedContent,
      authorId,
    });

    res.status(201).json(newMessage);
  } catch (error) {
    console.error("Error creating message:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function postStarMessage(req, res) {
  try {
    const { messageId } = req.params;
    const { userId } = req.body;

    const existing = await db.findStarredMessage(userId, messageId);

    if (existing) {
      await db.deleteStarredMessage(existing.id);
    } else {
      await db.createStarredMessage(userId, messageId);
    }

    res.status(200).json({ message: "Success" });
  } catch (error) {
    console.error("Error in postStarMessage:", error);
    res.status(500).json({ error: "Failed to star message" });
  }
}

async function getStarredMessages(req, res) {
  const { userId } = req.params;

  try {
    const messages = await db.findStarredMessagesByUser(userId);
    res.json(messages);
  } catch (error) {
    console.error("Error fetching starred messages:", error);
    res.status(500).json({ error: "Failed to fetch starred messages" });
  }
}

async function addComment(req, res) {
  try {
    const { content, messageId, authorId } = req.body;

    if (!content || !messageId || !authorId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const comment = await db.createComment(content, messageId, authorId);
    res.status(201).json(comment);
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function deleteMessage(req, res) {
  try {
    const { id } = req.params;

    const message = await db.findMessageById(id);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    await db.deleteCommentsByMessageId(id);
    await db.deleteStarredMessagesByMessageId(id);
    await db.deleteMessageById(id);

    res.status(200).json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting message:", error);
    res.status(500).json({ error: "Failed to delete message" });
  }
}

async function globalStarMessage(req, res) {
  const messageId = req.params.id;

  try {
    // Call query function to mark message as starred for all
    await starMessageForAllUsers(messageId);

    res.status(200).json({ success: true, message: "Message starred for all users." });
  } catch (error) {
    console.error("Error globally starring message:", error);
    res.status(500).json({ error: "Failed to globally star message." });
  }
}

module.exports = {
  getMessages, 
  viewMessage, 
  postMessage, 
  postStarMessage, 
  getStarredMessages, 
  addComment, 
  deleteMessage,
  globalStarMessage, 
};