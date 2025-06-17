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
  const operations = entries.map(({ week, playerId, teamId, position }) =>
    prisma.roster.upsert({
      where: {
        week_playerId: { week, playerId },
      },
      update: { position },
      create: { week, playerId, teamId, position },
    })
  );
  return prisma.$transaction(operations);
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

async function setPlayerPositions(teamId, players) {
  const { unlockedWeeks, lockedWeeks } = await getUnlockedWeeks();
  const operations = [];

  for (const player of players) {
    operations.push(
      prisma.player.update({
        where: { id: player.playerId },
        data: { setPosition: player.setPosition },
      })
    );

    if (unlockedWeeks.length > 0) {
      for (const unlockedWeek of unlockedWeeks) {
        console.log(`Upserting roster for player ${player.playerId} for week ${unlockedWeek}`);

        operations.push(
          prisma.roster.upsert({
            where: {
              week_playerId: {
                week: unlockedWeek,
                playerId: player.playerId,
              },
            },
            update: { position: player.setPosition },
            create: {
              week: unlockedWeek,
              position: player.setPosition,
              playerId: player.playerId,
              teamId,
            },
          })
        );
      }
    }
  }

  try {
    await Promise.all(operations);
    console.log("All operations successful");

    return {
      success: true,
      updatedWeeks: unlockedWeeks,
      skippedWeeks: lockedWeeks,
    };
  } catch (error) {
    console.error("Error during setPlayerPositions:", error);
    return { error: "Failed to set player positions." };
  }
}

// Lock Time Helpers
async function getUnlockedWeeks() {
  const now = new Date();

  const allWeekLocks = await prisma.weekLock.findMany({
    select: { week: true, lockTime: true },
  });

  const unlockedWeeks = [];
  const lockedWeeks = [];

  for (const { week, lockTime } of allWeekLocks) {
    if (now > lockTime) {
      lockedWeeks.push(week);
    } else {
      unlockedWeeks.push(week);
    }
  }

  return { unlockedWeeks, lockedWeeks };
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
};