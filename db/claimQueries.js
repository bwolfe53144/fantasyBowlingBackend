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

async function findOrCreatePlayerClaim({ playerId, expiresAt }) {
  let playerClaim = await prisma.playerClaim.findFirst({ where: { playerId } });

  if (!playerClaim) {
    playerClaim = await prisma.playerClaim.create({
      data: {
        playerId,
        expiresAt,
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

// Get all claims with safe null handling
async function getAllClaims() {
  const claims = await prisma.playerClaim.findMany({
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

  return claims.map(c => ({
    playerId: c.playerId,
    playerName: c.player?.name || null,
    league: c.player?.league || null,
    expiresAt: c.expiresAt,
    teams: c.claimants.map(cl => cl.user?.team).filter(Boolean),
    claimants: c.claimants.map(cl => cl.user).filter(Boolean),
  }));
}

// Get all claims for a specific user safely
async function getClaimsByUserId(userId) {
  const claims = await prisma.playerClaim.findMany({
    where: {
      claimants: {
        some: { userId },
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

  return claims.map(c => ({
    playerId: c.playerId,
    playerName: c.player?.name || null,
    league: c.player?.league || null,
    expiresAt: c.expiresAt,
    teams: c.claimants.map(cl => cl.user?.team).filter(Boolean),
    claimants: c.claimants.map(cl => cl.user).filter(Boolean),
  }));
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
