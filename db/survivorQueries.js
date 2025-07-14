const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createSurvivorTeamEntry(userId, league, teamName) {
  return prisma.survivorEntry.create({
    data: {
      userId,
      league,
      teamName,
    },
  });
}

async function findSurvivorEntriesByUserId(userId) {
  return prisma.survivorEntry.findMany({
    where: { userId },
    select: {
      id: true,
      league: true,
      teamName: true,
    },
  });
}

async function getSurvivorEntriesByLeague(league) {
  return prisma.survivorEntry.findMany({
    where: { league },
    include: {
      user: {
        select: {
          firstname: true,
          lastname: true,
        },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
  });
}

async function getSurvivorPicksForTeam(league, teamName) {
  // Find the specific entry first
  const entry = await prisma.survivorEntry.findUnique({
    where: {
      league_teamName: {
        league,
        teamName,
      },
    },
  });

  if (!entry) {
    throw new Error("Entry not found");
  }

  // Now use entry.id to query SurvivorUsedPlayer directly
  const picks = await prisma.survivorUsedPlayer.findMany({
    where: {
      entryId: entry.id,
    },
    select: {
      week: true,
      player: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      week: "asc",
    },
  });

  return picks;
}

async function findEligibleSurvivorPlayers(league, teamName) {
  const entry = await prisma.survivorEntry.findUnique({
    where: {
      league_teamName: {
        league,
        teamName,
      },
    },
  });

  if (!entry) {
    throw new Error("Survivor entry not found");
  }

  const used = await prisma.survivorUsedPlayer.findMany({
    where: { entryId: entry.id },
    select: { playerId: true },
  });

  const usedIds = used.map((p) => p.playerId);

  const allPlayers = await prisma.player.findMany({
    where: { league },
    orderBy: { name: "asc" },
  });

  return allPlayers.filter((p) => !usedIds.includes(p.id));
}

async function submitFullSurvivorLineup(league, teamName, picks) {
  const entry = await prisma.survivorEntry.findUnique({
    where: {
      league_teamName: {
        league,
        teamName,
      },
    },
  });

  if (!entry) {
    throw new Error("Survivor entry not found");
  }

  if (entry.eliminated) {
    throw new Error("Team is already eliminated");
  }

  const pickIds = picks.map((p) => p.playerId);
  const uniqueIds = new Set(pickIds);
  if (pickIds.length !== uniqueIds.size) {
    throw new Error("Cannot have duplicate players in lineup");
  }

  await prisma.survivorPlayer.deleteMany({
    where: { entryId: entry.id },
  });

  const createOps = picks.map((pick) => ({
    entryId: entry.id,
    playerId: pick.playerId,
    rank: pick.rank,
  }));

  await prisma.survivorPlayer.createMany({
    data: createOps,
  });
}

async function getSurvivorEntryByLeagueAndTeam(league, teamName) {
  return prisma.survivorEntry.findUnique({
    where: {
      league_teamName: {
        league,
        teamName,
      },
    },
  });
}

async function getSurvivorUserPicksQuery(entryId) {
  return prisma.survivorPlayer.findMany({
    where: { entryId },
    orderBy: { rank: "asc" },
    include: { player: true },
  });
}

async function findWeekLock(league, week) {
  return prisma.weekLock.findFirst({
    where: { league, week },
  });
}

async function getAliveEntries(league) {
  return prisma.survivorEntry.findMany({
    where: { league, eliminated: false },
  });
}

async function getEliminatedEntries(league) {
  return prisma.survivorEntry.findMany({
    where: { league, eliminated: true },
  });
}

async function findWeekScoresByLeagueAndWeek(league, week) {
  return prisma.weekScore.findMany({
    where: {
      week,
      player: { league },
    },
    include: { player: true },
  });
}

async function getWeekLineup(entryId, week) {
  return prisma.survivorWeekLineup.findMany({
    where: { entryId, week },
    orderBy: { rank: 'asc' },
  });
}

async function markEliminated(entryId, week) {
  return prisma.survivorEntry.update({
    where: { id: entryId },
    data: { eliminated: true, eliminatedWeek: week },
  });
}

async function updateEntryWinnerStatus(entryId, status) {
  return prisma.survivorEntry.update({
    where: { id: entryId },
    data: { winnerStatus: status },
  });
}

async function addUsedPlayer(entryId, week, playerId) {
  console.log(playerId);
  return prisma.survivorUsedPlayer.create({
    data: { entryId, week, playerId },
  });
}

async function removePlayerFromLineup(entryId, playerId) {
  await prisma.$transaction([
    prisma.survivorPlayer.deleteMany({
      where: { entryId, playerId },
    }),
    prisma.survivorWeekLineup.deleteMany({
      where: { entryId, playerId },
    }),
  ]);

  return { success: true };
}

async function deleteWeekLineups(league, week) {
  return prisma.survivorWeekLineup.deleteMany({
    where: {
      week,
      entry: { league },
    },
  });
}

async function getUsedPlayer(entryId, week) {
  return prisma.survivorUsedPlayer.findFirst({
    where: { entryId, week },
  });
}

async function getAllUsedPlayers(entryId) {
  return prisma.survivorUsedPlayer.findMany({
    where: { entryId },
  });
}

async function getWeekScore(league, week, playerId) {
  return prisma.weekScore.findFirst({
    where: {
      league,
      week,
      playerId,
    },
    select: { series: true },
  });
}

async function resetSurvivorLeagueData(league) {
  await prisma.$transaction([
    prisma.survivorUsedPlayer.deleteMany({
      where: { entry: { league } },
    }),
    prisma.survivorWeekLineup.deleteMany({
      where: { entry: { league } },
    }),
    prisma.survivorEntry.updateMany({
      where: { league },
      data: {
        eliminated: false,
        eliminatedWeek: null,
        winnerStatus: null,
      },
    }),
  ]);
}

module.exports = {
  createSurvivorTeamEntry,
  findSurvivorEntriesByUserId,
  getSurvivorEntriesByLeague,
  getSurvivorPicksForTeam,
  findEligibleSurvivorPlayers,
  submitFullSurvivorLineup,
  getSurvivorEntryByLeagueAndTeam,
  getSurvivorUserPicksQuery,
  findWeekLock,
  getAliveEntries,
  getEliminatedEntries,
  findWeekScoresByLeagueAndWeek,
  getWeekLineup,
  markEliminated,
  updateEntryWinnerStatus,
  addUsedPlayer,
  removePlayerFromLineup,
  deleteWeekLineups,
  getUsedPlayer,
  getAllUsedPlayers,
  getWeekScore,
  resetSurvivorLeagueData,
};