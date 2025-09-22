const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

//  Basic Roster Queries
async function findRosterByTeamAndWeek(teamId, week) {
  return prisma.roster.findMany({ where: { teamId, week } });
}

async function getRosterForTeamAndWeek(teamId, week) {
  return prisma.roster.findMany({
    where: { teamId, week },
    include: {
      player: {
        include: { weekScores: true },
      },
    },
    orderBy: [
      { player: { setPosition: 'asc' } },
      { player: { name: 'asc' } },
    ],
  });
}

async function getRostersByWeek(week) {
  return prisma.roster.findMany({
    where: { week },
    include: {
      player: true,
      team: {
        select: {
          id: true,
          name: true,
          wins: true,
          losses: true,
          ties: true,
          owner: {
            select: {
              avatarUrl: true,
            },
          },
        },
      },
    },
  });
}

async function getAllRostersWithScores() {
  return prisma.roster.findMany({
    include: {
      player: { include: { weekScores: true } },
      team: true,
    },
  });
}

//  Player / Team Queries
async function findPlayersByTeam(teamId) {
  return prisma.player.findMany({ where: { teamId } });
}

async function getPlayersByTeam(teamId) {
  return prisma.player.findMany({ where: { teamId } });
}

//  Create / Update / Delete Roster Entries
async function createRosterEntry({ week, teamId, playerId, position }) {
  return prisma.roster.create({
    data: { week, teamId, playerId, position },
  });
}

async function upsertRosterEntries(entries) {
  const batchSize = 10;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const operations = batch.map(({ week, playerId, teamId, position }) =>
      prisma.roster.upsert({
        where: { week_playerId: { week, playerId } },
        update: { position },
        create: { week, playerId, teamId, position },
      })
    );
    await prisma.$transaction(operations);
  }
}

async function deleteRosterByTeamAndWeek(teamId, week) {
  return prisma.roster.deleteMany({ where: { teamId, week } });
}

async function deleteAllRosters() {
  return prisma.roster.deleteMany();
}

// Reset / Bulk Operations

async function resetTeamStats() {
  return prisma.team.updateMany({
    data: {
      wins: 0,
      losses: 0,
      ties: 0,
      points: 0,
      pointsAgainst: 0,
      streak: "W0",
      playoffSeed: null,
      completedWeeks: [],
    },
  });
}

async function resetPlayerPositions() {
  return prisma.player.updateMany({
    data: { setPosition: "" },
  });
}

async function limitConcurrency(tasks, limit) {
  const results = [];
  const executing = [];

  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    results.push(p);

    if (limit <= tasks.length) {
      const e = p.then(() => executing.splice(executing.indexOf(e), 1));
      executing.push(e);
      if (executing.length >= limit) {
        await Promise.race(executing);
      }
    }
  }
  return Promise.all(results);
}

async function getUnlockedWeeks() {
  const now = new Date();

  // Get all week locks grouped by week
  const allWeekLocks = await prisma.weekLock.findMany({
    select: { week: true, lockTime: true },
  });

  // Group locks by week
  const weekGroups = {};
  for (const { week, lockTime } of allWeekLocks) {
    if (!weekGroups[week]) weekGroups[week] = [];
    weekGroups[week].push(lockTime);
  }

  // Only return weeks where **all leagues are unlocked**
  const unlockedWeeks = Object.entries(weekGroups)
    .filter(([_, lockTimes]) => lockTimes.every(lockTime => now < lockTime))
    .map(([week]) => Number(week));

  return unlockedWeeks;
}

async function setPlayerPositions(teamId, players) {
  const unlockedWeeks = await getUnlockedWeeks();
  console.log(unlockedWeeks);

  if (!unlockedWeeks.length) {
    return { error: "All weeks are locked. Cannot set positions." };
  }

  try {
    const tasks = [];

    for (const player of players) {
      // Update the player's "setPosition" field
      tasks.push(() =>
        prisma.player.update({
          where: { id: player.playerId },
          data: { setPosition: player.setPosition },
        })
      );

      // Update roster for all unlocked weeks
      for (const week of unlockedWeeks) {
        tasks.push(() =>
          prisma.roster.upsert({
            where: {
              week_playerId: { week, playerId: player.playerId },
            },
            update: { position: player.setPosition },
            create: {
              week,
              position: player.setPosition,
              playerId: player.playerId,
              teamId,
            },
          })
        );
      }
    }

    // Limit concurrency to 4 simultaneous DB calls
    await limitConcurrency(tasks, 4);

    return {
      success: true,
      updatedWeeks: unlockedWeeks,
    };
  } catch (error) {
    console.error("Error during setPlayerPositions:", error);
    return { error: "Failed to set player positions." };
  }
}

async function getRostersWithScoresForWeek(week) {
  if (isNaN(week)) throw new Error("Invalid week");

  return prisma.roster.findMany({
    where: { week },
    include: {
      player: {
        include: {
          weekScores: {
            where: { week },
          },
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          wins: true,
          losses: true,
          ties: true,
          owner: {
            select: { avatarUrl: true },
          },
        },
      },
    },
  });
}

module.exports = {
  findRosterByTeamAndWeek,
  getRosterForTeamAndWeek,
  getRostersByWeek,
  getAllRostersWithScores,
  findPlayersByTeam,
  getPlayersByTeam,
  createRosterEntry,
  upsertRosterEntries,
  deleteRosterByTeamAndWeek,
  deleteAllRosters,
  resetTeamStats,
  resetPlayerPositions,
  setPlayerPositions,
  getUnlockedWeeks,
  getRostersWithScoresForWeek,
};