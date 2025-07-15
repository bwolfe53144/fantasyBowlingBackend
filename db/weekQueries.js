const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// WeekLocks 
async function findIncompleteWeekLocks() {
  return prisma.weekLock.findMany({
    where: { completed: "no" },
    select: { league: true, week: true },
    orderBy: [
      { week: 'asc' },
      { league: 'asc' }
    ],
  });
}

async function completeWeekLock(league, season, week) {
  return prisma.weekLock.update({
    where: {
      league_season_week: { league, season, week },
    },
    data: {
      completed: "yes",
    },
  });
}

async function findAllWeekLocksOrdered() {
  return prisma.weekLock.findMany({
    orderBy: { week: 'asc' }
  });
}

async function findMatchWeeks() {
  const weeks = await prisma.match.findMany({
    select: { week: true },
    distinct: ["week"],
    orderBy: { week: "asc" },
  });

  const grouped = await prisma.match.groupBy({
    by: ["week"],
    _count: { id: true },
    orderBy: { week: "asc" },
  });

  const firstPlayoffWeekEntry = grouped.find((g) => g._count.id < 3);
  const maxWeek = grouped.length > 0 ? grouped[grouped.length - 1].week : null;

  let playoffStartWeek;

  if (firstPlayoffWeekEntry) {
    playoffStartWeek = firstPlayoffWeekEntry.week;
  } else {
    playoffStartWeek = maxWeek !== null ? maxWeek + 1 : null;
  }

  return {
    weeks: weeks.map((w) => w.week),
    playoffStartWeek,
  };
}

async function findCompletedWeekLocks() {
  return prisma.weekLock.findMany({
    where: { completed: "yes" },
    select: {
      league: true,
      week: true,
    },
    orderBy: [
      { week: 'asc' },
      { league: 'asc' },
    ]
  });
}

async function findCompletedLeaguesByWeek(week) {
  return prisma.weekLock.findMany({
    where: {
      completed: "yes",
      week,
    },
    select: {
      league: true,
      season: true,
      week: true,
      completed: true,
    },
  });
}

// Matches 
async function findMatchupsByWeek(week) {
  return prisma.match.findMany({
    where: { week },
    select: {
      team1Id: true,
      team2Id: true,
    },
  });
}

// WeekScores 
async function createWeekScore(week, game1, game2, game3, average, playerId, opponent, lanes, myTeam) {
  const existingScore = await prisma.weekScore.findFirst({
    where: {
      playerId: playerId,
      week: week,
    }
  });

  if (existingScore) {
    console.log(`Score already exists for playerId ${playerId}, week ${week}`);
    return existingScore;
  }

  const newScore = await prisma.weekScore.create({
    data: {
      week,
      game1,
      game2,
      game3,
      average,
      opponent,
      lanes,
      myTeam,
      player: { connect: { id: playerId } }
    }
  });

  console.log(`Created new score for playerId ${playerId}, week ${week}`);
  return newScore;
}

async function getAllWeekScores() {
  return prisma.weekScore.findMany({});
}

async function findWeekScoresByWeek(week) {
  return prisma.weekScore.findMany({
    where: { week },
  });
}

module.exports = {
  completeWeekLock,
  createWeekScore,
  findAllWeekLocksOrdered,
  findMatchWeeks,
  findCompletedLeaguesByWeek,
  findCompletedWeekLocks,
  findIncompleteWeekLocks,
  findMatchupsByWeek,
  findWeekScoresByWeek,
  getAllWeekScores,
};