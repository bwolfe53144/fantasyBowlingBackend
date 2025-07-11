const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// PlayerClaim retrieval and creation 
async function getPlayerClaim(playerId) {
  return await prisma.playerClaim.findFirst({
    where: { playerId },
    include: {
      player: true,
      claimants: {
        include: {
          user: {
            include: { team: true },
          },
        },
      },
    },
  });
}


async function findOrCreatePlayerClaim(playerId) {
  let playerClaim = await prisma.playerClaim.findFirst({ where: { playerId } });

  if (!playerClaim) {
    playerClaim = await prisma.playerClaim.create({
      data: {
        playerId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry for pickDropPlayer
      },
    });
  }
  return playerClaim;
}

// Claimant related functions 

async function findClaimant(userId, claimId) {
  return await prisma.claimant.findUnique({
    where: {
      userId_claimId: {
        userId,
        claimId,
      },
    },
  });
}

async function createClaimant(userId, claimId, dropPlayerId = null) {
  return await prisma.claimant.create({
    data: {
      userId,
      claimId,
      dropPlayerId,
    },
  });
}

async function deleteClaimants(claimId, userId) {
  return await prisma.claimant.deleteMany({
    where: {
      claimId,
      userId,
    },
  });
}

// Utility functions 
async function countClaimants(claimId) {
  return await prisma.claimant.count({
    where: { claimId },
  });
}

async function deletePlayerClaim(claimId) {
  return await prisma.playerClaim.delete({
    where: { id: claimId },
  });
}

async function getAllClaims() {
  return await prisma.playerClaim.findMany({
    include: {
      player: true,
      claimants: {
        include: {
          user: {
            include: { team: true },
          },
        },
      },
    },
  });
}

// Get all claims for a specific user by userId
async function getClaimsByUserId(userId) {
  return await prisma.playerClaim.findMany({
    where: {
      claimants: {
        some: {
          userId,
        },
      },
    },
    include: {
      player: true,
      claimants: {
        include: {
          user: {
            include: { team: true },
          },
        },
      },
    },
  });
}

module.exports = {
  getPlayerClaim,
  findOrCreatePlayerClaim,
  findClaimant,
  createClaimant,
  deleteClaimants,
  countClaimants,
  deletePlayerClaim,
  getAllClaims,
  getClaimsByUserId,
};