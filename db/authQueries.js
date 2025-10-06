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
  return prisma.user.findUnique({
    where: { id },
    include: {
      team: {
        include: {
          players: {
            include: {
              tradePlayers: {
                include: {
                  trade: {
                    select: {   // ← use select here
                      status: true,
                      fromTeam: { select: { id: true, name: true } },
                      toTeam: { select: { id: true, name: true } },
                    },
                  },
                },
              },
              claims: {
                where: { resolved: false },
                include: {
                  claimants: {
                    include: {
                      user: true,
                      dropPlayer: true,
                    },
                  },
                },
              },
              dropClaimants: {
                where: { claim: { resolved: false } },
                include: {
                  claim: true,
                  user: true,
                  dropPlayer: true,
                },
              },
            },
          },
        },
      },
    },
  });
}

async function getUserByEmail(email) {
  return await prisma.user.findUnique({ where: { email } });
}

async function setResetToken(userId, hashedToken, expires) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: expires,
    },
  });
}

async function getUserByResetToken(hashedToken) {
  return await prisma.user.findFirst({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: {
        gt: new Date(),
      },
    },
  });
}

async function updatePasswordAndClearResetToken(userId, newHashedPassword) {
  return await prisma.user.update({
    where: { id: userId },
    data: {
      password: newHashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });
}

module.exports = {
  checkUsernameEmail,
  checkName,
  addUser,
  getUser,
  findUser,
  getUserByEmail, 
  setResetToken,
  getUserByResetToken,
  updatePasswordAndClearResetToken,
};