const { PrismaClient } = require('@prisma/client');
const { calculateFantasyPoints } = require("../utils/calculateFantasyPoints");
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

async function updatePlayerRanks(league) {
  const players = await prisma.player.findMany({
    where: { league },
    include: { weekScores: true },
  });

  if (players.length === 0) return;

  const maxGames = Math.max(...players.map(p =>
    p.weekScores.reduce((sum, ws) => {
      const games = [ws.game1, ws.game2, ws.game3].filter(g => g != null).length;
      return sum + games;
    }, 0)
  ));

  const playerStats = players.map((player) => {
    const ws = player.weekScores;
    const gamesPlayed = ws.reduce((sum, score) =>
      sum + [score.game1, score.game2, score.game3].filter(g => g != null).length, 0);

    const pinfall = ws.reduce((sum, score) =>
      sum + [score.game1, score.game2, score.game3].reduce((a, b) => (b ? a + b : a), 0), 0);

    const seriesHigh = ws.reduce((max, score) => {
      const series = [score.game1, score.game2, score.game3].reduce((a, b) => (b ? a + b : a), 0);
      return series > max ? series : max;
    }, 0);

    const fanPoints = calculateFantasyPoints(ws);

    const eligibleForAverage = gamesPlayed >= (maxGames * 2 / 3);
    const avg = eligibleForAverage && gamesPlayed > 0 ? pinfall / gamesPlayed : 0;
    const fanPPG = eligibleForAverage && gamesPlayed > 0 ? fanPoints / gamesPlayed : 0;

    return {
      playerId: player.id,
      avg,
      fanPoints,
      fanPPG,
      series: seriesHigh,
      pinfall,
      gamesPlayed,
    };
  });

  function rankPlayers(statName, desc = true) {
    const sorted = [...playerStats].sort((a, b) => {
      if (a[statName] === b[statName]) return 0;
      return desc ? b[statName] - a[statName] : a[statName] - b[statName];
    });

    const ranks = {};
    const percents = {};
    let rank = 1;
    let prevValue = null;
    let itemsWithSameRank = 0;

    // Filter players with valid (non-zero) stat
    const eligible = sorted.filter(p => p[statName] > 0);
    const total = eligible.length;

    for (let i = 0; i < sorted.length; i++) {
      const val = sorted[i][statName];

      if (val === 0) {
        ranks[sorted[i].playerId] = 0;
        percents[sorted[i].playerId] = 0;
        continue;
      }

      if (val !== prevValue) {
        rank = rank + itemsWithSameRank;
        itemsWithSameRank = 1;
      } else {
        itemsWithSameRank++;
      }

      ranks[sorted[i].playerId] = rank;
      percents[sorted[i].playerId] = parseFloat(
        ((1 - (rank - 1) / total) * 100).toFixed(2)
      );

      prevValue = val;
    }

    return { ranks, percents };
  }

  const { ranks: avgRanks, percents: avgPercents } = rankPlayers("avg");
  const { ranks: fanPointsRanks, percents: fanPointsPercents } = rankPlayers("fanPoints");
  const { ranks: fanPPGRanks, percents: fanPPGPercents } = rankPlayers("fanPPG");
  const { ranks: seriesRanks, percents: seriesPercents } = rankPlayers("series");
  const { ranks: pinfallRanks, percents: pinfallPercents } = rankPlayers("pinfall");

  const upserts = playerStats.map((p) =>
    prisma.playerRank.upsert({
      where: { playerId: p.playerId },
      update: {
        avgRank: avgRanks[p.playerId] || 0,
        avgPercent: avgPercents[p.playerId] || 0,

        fanPoints: fanPointsRanks[p.playerId] || 0,
        fanPercent: fanPointsPercents[p.playerId] || 0,

        fanPPG: fanPPGRanks[p.playerId] || 0,
        fanPPGPercent: fanPPGPercents[p.playerId] || 0,

        seriesRank: seriesRanks[p.playerId] || 0,
        seriesPercent: seriesPercents[p.playerId] || 0,

        pinfallRank: pinfallRanks[p.playerId] || 0,
        pinfallPercent: pinfallPercents[p.playerId] || 0,
      },
      create: {
        playerId: p.playerId,
        avgRank: avgRanks[p.playerId] || 0,
        avgPercent: avgPercents[p.playerId] || 0,

        fanPoints: fanPointsRanks[p.playerId] || 0,
        fanPercent: fanPointsPercents[p.playerId] || 0,

        fanPPG: fanPPGRanks[p.playerId] || 0,
        fanPPGPercent: fanPPGPercents[p.playerId] || 0,

        seriesRank: seriesRanks[p.playerId] || 0,
        seriesPercent: seriesPercents[p.playerId] || 0,

        pinfallRank: pinfallRanks[p.playerId] || 0,
        pinfallPercent: pinfallPercents[p.playerId] || 0,
      },
    })
  );

  await Promise.all(upserts);
}

function normalizeTeamName(name) {
  return name.trim().toLowerCase();
}

async function updateTeamRanks(league) {
  const scores = await prisma.weekScore.findMany({
    where: { player: { league } },
    include: { player: true },
  });

  // Map normalizedTeamName -> canonical display name
  const canonicalNames = {};

  // Map normalizedTeamName -> week -> aggregated data
  const teamWeekMap = {};

  for (const score of scores) {
    if (!score.myTeam) continue;

    const normalizedTeamName = normalizeTeamName(score.myTeam);
    if (!canonicalNames[normalizedTeamName]) {
      canonicalNames[normalizedTeamName] = score.myTeam.trim();
    }

    if (!teamWeekMap[normalizedTeamName]) {
      teamWeekMap[normalizedTeamName] = {};
    }

    const week = score.week;
    if (!teamWeekMap[normalizedTeamName][week]) {
      teamWeekMap[normalizedTeamName][week] = {
        pinfall: 0,
        games: 0,
        fanPoints: 0,
      };
    }

    const games = [score.game1, score.game2, score.game3].filter(g => g != null);
    const seriesTotal = games.reduce((a, b) => a + b, 0);
    const fanPoints = calculateFantasyPoints([score]);

    teamWeekMap[normalizedTeamName][week].pinfall += seriesTotal;
    teamWeekMap[normalizedTeamName][week].games += games.length;
    teamWeekMap[normalizedTeamName][week].fanPoints += fanPoints;
  }

  // Aggregate across all weeks per normalized team name
  const teamStats = Object.entries(teamWeekMap).map(([normalizedName, weeks]) => {
    let totalPinfall = 0;
    let totalGames = 0;
    let totalFanPoints = 0;
    let highSeries = 0;

    for (const weekData of Object.values(weeks)) {
      totalPinfall += weekData.pinfall;
      totalGames += weekData.games;
      totalFanPoints += weekData.fanPoints;

      if (weekData.pinfall > highSeries) {
        highSeries = weekData.pinfall;
      }
    }

    return {
      normalizedName,
      displayName: canonicalNames[normalizedName],
      league,
      totalPinfall,
      totalGames,
      totalFanPoints,
      highSeries,
      avg: totalGames > 0 ? totalPinfall / totalGames : 0,
      fanPPG: totalGames > 0 ? totalFanPoints / totalGames : 0,
    };
  });

  // Ranking function (same as before)
  function rank(stat) {
    const sorted = [...teamStats].sort((a, b) => b[stat] - a[stat]);
    const ranks = {};
    const percents = {};
    let rank = 1;
    let prev = null;
    let ties = 0;

    const eligible = sorted.filter(t => t[stat] > 0);
    const total = eligible.length;

    for (const t of sorted) {
      if (t[stat] === 0) {
        ranks[t.normalizedName] = 0;
        percents[t.normalizedName] = 0;
        continue;
      }

      if (t[stat] !== prev) {
        rank += ties;
        ties = 1;
      } else {
        ties++;
      }

      ranks[t.normalizedName] = rank;
      percents[t.normalizedName] = parseFloat(((1 - (rank - 1) / total) * 100).toFixed(2));
      prev = t[stat];
    }

    return { ranks, percents };
  }

  const { ranks: avgRanks, percents: avgPercents } = rank("avg");
  const { ranks: seriesRanks, percents: seriesPercents } = rank("highSeries");
  const { ranks: pinfallRanks, percents: pinfallPercents } = rank("totalPinfall");
  const { ranks: fanPointsRanks, percents: fanPointsPercents } = rank("totalFanPoints");
  const { ranks: fanPPGRanks, percents: fanPPGPercents } = rank("fanPPG");

  // Upsert bowling teams with normalized names, use canonical display name
  await Promise.all(
    teamStats.map(team =>
      prisma.bowlingTeam.upsert({
        where: {
          name_league: {
            name: team.normalizedName,
            league: team.league,
          },
        },
        update: {},
        create: {
          name: team.normalizedName,
          league: team.league,
        },
      })
    )
  );

  // Fetch all teams with normalized names for ID mapping
  const allTeams = await prisma.bowlingTeam.findMany({
    where: { league },
    select: { id: true, name: true },
  });
  const idByName = Object.fromEntries(allTeams.map(t => [t.name, t.id]));

  // Upsert bowling team ranks with normalized name keys
  const upserts = teamStats.map(team =>
    prisma.bowlingTeamRank.upsert({
      where: { teamId: idByName[team.normalizedName] },
      update: {
        avgRank: avgRanks[team.normalizedName],
        avgPercent: avgPercents[team.normalizedName],

        fanPoints: fanPointsRanks[team.normalizedName],
        fanPercent: fanPointsPercents[team.normalizedName],

        fanPPG: fanPPGRanks[team.normalizedName],
        fanPPGPercent: fanPPGPercents[team.normalizedName],

        seriesRank: seriesRanks[team.normalizedName],
        seriesPercent: seriesPercents[team.normalizedName],

        pinfallRank: pinfallRanks[team.normalizedName],
        pinfallPercent: pinfallPercents[team.normalizedName],
      },
      create: {
        teamId: idByName[team.normalizedName],
        avgRank: avgRanks[team.normalizedName],
        avgPercent: avgPercents[team.normalizedName],

        fanPoints: fanPointsRanks[team.normalizedName],
        fanPercent: fanPointsPercents[team.normalizedName],

        fanPPG: fanPPGRanks[team.normalizedName],
        fanPPGPercent: fanPPGPercents[team.normalizedName],

        seriesRank: seriesRanks[team.normalizedName],
        seriesPercent: seriesPercents[team.normalizedName],

        pinfallRank: pinfallRanks[team.normalizedName],
        pinfallPercent: pinfallPercents[team.normalizedName],
      },
    })
  );

  await Promise.all(upserts);
}

async function completeWeekLock(league, season, week) {
  await prisma.weekLock.update({
    where: {
      league_season_week: { league, season, week },
    },
    data: {
      completed: "yes",
    },
  });

  await updatePlayerRanks(league, season);
  await updateTeamRanks(league);
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
function normalizeTeamName(name) {
  return name?.trim().toLowerCase();
}

async function createWeekScore(week, game1, game2, game3, average, playerId, opponent, lanes, myTeam) {
  const normalizedTeam = normalizeTeamName(myTeam);

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
      myTeam: normalizedTeam,
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

async function findCurrentWeekForLeague(league) {
  if (!league) throw new Error("Missing league parameter");

  // Get all week locks for the league, ordered by week and lockTime
  const leagueLocks = await prisma.weekLock.findMany({
    where: { league },
    orderBy: [
      { week: "asc" },
      { lockTime: "asc" },
    ],
  });

  if (leagueLocks.length === 0) return null;

  const now = new Date();
  const weeks = [...new Set(leagueLocks.map(wl => wl.week))].sort((a, b) => a - b);

  let currentWeek;
  for (const week of weeks) {
    const entries = leagueLocks.filter(wl => wl.week === week);
    const lockedCount = entries.filter(e => e.lockTime <= now).length;
    if (lockedCount < entries.length) {
      currentWeek = week;
      break;
    }
  }

  if (!currentWeek) currentWeek = weeks[weeks.length - 1]; // fallback to last week
  return currentWeek;
}

async function getWeekLocks(week) {
  if (!week) throw new Error("Week is required");

  const locks = await prisma.weekLock.findMany({
    where: { week },
    select: {
      league: true,
      lockTime: true,
    },
  });

  return locks.map(lock => {
    if (!lock.lockTime) return lock;

    // Get the offset between UTC and Central Time in minutes
    const centralOffsetMinutes = new Date(lock.lockTime).toLocaleString("en-US", { timeZone: "America/Chicago", hour12: false });
    
    // Alternatively, just use Date object and compute offset directly
    const utcTime = new Date(lock.lockTime).getTime();
    const centralTime = new Date(utcTime + new Date().getTimezoneOffset() * 60000); // rough offset
    return {
      ...lock,
      lockTime: centralTime,
    };
  });
}

async function findCurrentWeekLocksByLeague() {
  const now = new Date();

  // Get all week locks, ordered by week ascending
  const weekLocks = await prisma.weekLock.findMany({
    select: {
      league: true,
      week: true,
      lockTime: true,
      completed: true,
    },
    orderBy: [
      { league: "asc" },
      { week: "asc" }
    ],
  });

  // Group by league and pick the first lock that hasn't expired
  const nextLocks = [];
  const seenLeagues = new Set();

  for (const lock of weekLocks) {
    if (!seenLeagues.has(lock.league) && lock.lockTime > now) {
      nextLocks.push(lock);
      seenLeagues.add(lock.league);
    }
  }

  return nextLocks;
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
  findCurrentWeekForLeague,
  getWeekLocks, 
  findCurrentWeekLocksByLeague,
};