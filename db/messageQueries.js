const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Message retrieval 
async function findMessageById(id) {
  return prisma.message.findUnique({
    where: { id: Number(id) },
    include: {
      comments: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          content: true,
          createdAt: true,
          author: {
            select: {
              id: true,
              firstname: true,
              lastname: true,
            },
          },
        },
      },
      author: {
        select: {
          id: true,
          firstname: true,
          lastname: true,
        },
      },
      starredBy: {
        select: {
          userId: true,
        },
      },
    },
  });
}

async function findMessages({ skip, take, userId }) {
  const messages = await prisma.message.findMany({
    skip,
    take,
    orderBy: { createdAt: 'desc' },
    include: {
      comments: { orderBy: { createdAt: 'asc' } },
      starredBy: true,
      author: {
        select: {
          firstname: true,
          lastname: true,
        },
      },
    },
  });

  const totalMessages = await prisma.message.count();

  const starredMessages = userId
    ? messages.filter(msg =>
        msg.starredBy.some(star => star.userId === userId)
      )
    : [];

  return { messages, starredMessages, totalMessages };
}

// Message creation 
async function createMessage({ title, content, authorId }) {
  return prisma.message.create({
    data: {
      title,
      content,
      author: { connect: { id: authorId } },
    },
  });
}

// Comments 
async function createComment(content, messageId, authorId) {
  return prisma.comment.create({
    data: {
      content,
      message: { connect: { id: Number(messageId) } },
      author: { connect: { id: authorId } },
    },
  });
}

// Starred messages 
async function findStarredMessage(userId, messageId) {
  return prisma.starredMessage.findFirst({
    where: {
      userId,
      messageId: Number(messageId),
    },
  });
}

async function createStarredMessage(userId, messageId) {
  return prisma.starredMessage.create({
    data: {
      userId,
      messageId: Number(messageId),
    },
  });
}

async function deleteStarredMessage(id) {
  return prisma.starredMessage.delete({
    where: { id },
  });
}

async function findStarredMessagesByUser(userId) {
  return prisma.starredMessage.findMany({
    where: { userId },
    include: {
      message: {
        include: {
          author: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

// --- Deletion operations ---
async function deleteCommentsByMessageId(messageId) {
  return prisma.comment.deleteMany({
    where: { messageId: Number(messageId) },
  });
}

async function deleteStarredMessagesByMessageId(messageId) {
  return prisma.starredMessage.deleteMany({
    where: { messageId: Number(messageId) },
  });
}

async function deleteMessageById(id) {
  return prisma.message.delete({
    where: { id: Number(id) },
  });
}

async function starMessageForAllUsers(messageId) {
  // Get all user IDs
  const users = await prisma.user.findMany({
    select: {
      id: true,
    },
  });

  // Create StarredMessage entries for all users (bulk)
  const data = users.map((user) => ({
    userId: user.id,
    messageId,
  }));

  // You might want to first delete any existing duplicates (if not using @@unique)
  // Then createMany
  await prisma.starredMessage.createMany({
    data,
    skipDuplicates: true,
  });

  return;
}

module.exports = {
  findMessageById,
  findMessages,
  createMessage,
  createComment,
  findStarredMessage,
  createStarredMessage,
  deleteStarredMessage,
  findStarredMessagesByUser,
  deleteCommentsByMessageId,
  deleteStarredMessagesByMessageId,
  deleteMessageById,
  starMessageForAllUsers,
};