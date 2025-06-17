const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();

// ✅ Check if username exists OR email (if provided)
async function checkUsernameEmail(username, email) {
  const conditions = [{ username }];
  if (email) {
    conditions.push({ email });
  }

  return prisma.user.findFirst({
    where: { OR: conditions },
  });
}

// ✅ Check if first/last name combo already exists
async function checkName(firstname, lastname) {
  return prisma.user.findFirst({
    where: {
      firstname,
      lastname,
    },
  });
}

// ✅ Add a new user (email optional)
async function addUser(firstname, lastname, data, hashedPassword) {
  return prisma.user.create({
    data: {
      firstname,
      lastname,
      username: data.username,
      email: data.email || null, // ensure null if missing
      password: hashedPassword,
    },
  });
}

// ✅ Get user by username
async function getUser(username) {
  return prisma.user.findUnique({
    where: { username },
  });
}

// ✅ Get user by ID (including team and players)
async function findUser(id) {
  return prisma.user.findFirst({
    where: { id },
    include: {
      team: {
        include: {
          players: true,
        },
      },
    },
  });
}

module.exports = {
  checkUsernameEmail,
  checkName,
  addUser,
  getUser,
  findUser,
};