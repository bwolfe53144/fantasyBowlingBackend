const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllPlayers() {
  return await prisma.player.findMany({
    include: {
      team: true,
      weekScores: true,
    },
  });
}

async function getUnassignedPlayers() {
  return await prisma.player.findMany({
    where: {
      team: null,
    },
    select: {
      id: true,
      name: true,
      league: true,
    },
    orderBy: {
      name: 'asc',
    },
  });
}

async function createPlayer(name, league, teamId, position) {
  // Try to find the player first
  let player = await prisma.player.findUnique({
    where: {
      name_league: {
        name,
        league,
      },
    },
  });

  if (!player) {
    // If not found, create it
    player = await prisma.player.create({
      data: {
        name,
        league,
        teamId: teamId || null,
        position,
      },
    });
  }
  return player;
}

async function dropPlayer(playerId, teamId) {
  try {
    // Fetch the player by ID
    const player = await prisma.player.findUnique({
      where: { id: playerId },
    });

    if (!player) {
      throw new Error("Player not found");
    }

    // Fetch the team name
    console.log("Attempting to drop player from team ID:", teamId);

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { name: true },
    });

    if (!team) {
      throw new Error("Team not found");
    }

    // Disconnect player from team and clear position
    await prisma.player.update({
      where: { id: playerId },
      data: {
        setPosition: "",
        team: { disconnect: true },
      },
    });

    console.log(`Player ${playerId} has been dropped successfully.`);

    // Log the transaction
    await prisma.playerTransaction.create({
      data: {
        playerId,
        playerName: player.name,
        teamId,
        teamName: team.name,
        action: "drop",
      },
    });

  } catch (error) {
    console.error("Error dropping player:", error);
    throw new Error("Failed to drop player");
  }
}

async function clearPlayerRosters(playerId, teamId, unlockedWeeks) {
  return await prisma.roster.deleteMany({
    where: {
      playerId,
      teamId,
      week: { in: unlockedWeeks },
    },
  });
}

async function getUnlockedWeeks() {
  const weeks = await prisma.weekLock.findMany({
    where: {
      lockTime: {
        gt: new Date(),
      },
    },
    select: {
      week: true,
    },
  });

  return {
    unlockedWeeks: weeks.map(w => w.week),
  };
}

async function getPlayerWithStatsByName(playerName) {
  return await prisma.player.findMany({
    where: {
      name: {
        equals: playerName,
        mode: 'insensitive', // optional: case-insensitive search
      },
    },
    include: {
      weekScores: true,
    },
  });
}

module.exports = {
  getAllPlayers,
  getUnassignedPlayers,
  createPlayer,
  dropPlayer,
  clearPlayerRosters,
  getUnlockedWeeks,
  getPlayerWithStatsByName,
};