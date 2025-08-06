const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Team Operations (CRUD, Listing, Summary)
async function getTeams() {
    return prisma.team.findMany({
      include: {
        players: true,
      },
    });
  }
  
  async function getTeamsForHome() {
    const teams = await prisma.team.findMany({
      select: {
        name: true,
        wins: true,
        losses: true,
        ties: true,
        points: true,
        pointsAgainst: true,
        streak: true,
        playoffSeed: true,
        id: true,
        owner: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
      },
    });
  
    return teams.map(team => {
      const record = team.ties > 0
        ? `${team.wins}-${team.losses}-${team.ties}`
        : `${team.wins}-${team.losses}`;
  
      return {
        name: team.name,
        record,
        pointsFor: team.points,
        pointsAgainst: team.pointsAgainst,
        streak: team.streak,
        wins: team.wins + (team.ties * 0.5),
        id: team.id,
        playoffSeed: team.playoffSeed,
        owner: team.owner || null,  
      };
    });
  }
  
  async function getTeam(name) {
    const team = await prisma.team.findUnique({
      where: { name },
      include: {
        players: {
          include: { weekScores: true },
        },
        owner: {
          select: {
            firstname: true,
            lastname: true,
          },
        },
        team1Matches: {
          include: {
            team2: { select: { id: true, name: true } },
          },
        },
        team2Matches: {
          include: {
            team1: { select: { id: true, name: true } },
          },
        },
        rosters: {
          include: {
            player: true,
          },
        },
        transactions: {
          include: {
            player: true,
          },
        },
      },
    });
  
    if (!team) return null;
  
    const captain = team.owner
      ? `${team.owner.firstname} ${team.owner.lastname.charAt(0)}.`
      : null;
  
    const { wins, losses, ties } = team;
    const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  
    const playersWithAverages = team.players.map((player) => {
      const totalGames = player.weekScores.length;
      const totalPoints = player.weekScores.reduce((sum, score) => sum + score.points, 0);
      const averagePPG = totalGames > 0 ? (totalPoints / totalGames).toFixed(2) : 0;
      return { ...player, totalGames, totalPoints, averagePPG, average: averagePPG };
    });
  
    return { ...team, captain, record, players: playersWithAverages };
  }
  
  async function getTeamById(teamId) {
    return prisma.team.findUnique({
      where: { id: teamId },
    });
  }
  
  async function createTeam(name, userId) {
    const formattedName = name.split(' ').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  
    return prisma.team.create({
      data: {
        name: formattedName,
        ownerId: userId,
      },
    });
  }
  
  async function updateTeamById(id, data) {
    return prisma.team.update({
      where: { id },
      data,
    });
  }

  //Player-Related Queries (Fantasy and Real-world Teams)
  async function getTeamPlayers(teamName) {
    return prisma.player.findMany({
      where: {
        weekScores: {
          some: {
            myTeam: teamName,
          },
        },
      },
      include: {
        weekScores: {
          where: {
            myTeam: teamName,
          },
        },
      },
    });
  }
  
  async function getFantasyTeamPlayers(teamName) {
    const team = await prisma.team.findUnique({
      where: { name: teamName },
      select: { id: true },
    });
  
    if (!team) return null;
  
    const players = await prisma.player.findMany({
      where: {
        team: {
          name: teamName,
        },
      },
      include: {
        weekScores: true,
      },
    });
  
    return {
      teamId: team.id,
      players,
    };
  }

  //Utility Functions
  async function getLockedPlayerIds(teamId, week) {
    const players = await prisma.player.findMany({
      where: { teamId },
      select: { id: true, league: true },
    });
  
    const leagues = [...new Set(players.map(p => p.league))];
  
    const weekLocks = await prisma.weekLock.findMany({
      where: {
        week,
        league: { in: leagues },
      },
    });
  
    const now = new Date();
  
    const lockedPlayerIds = players
      .filter(player => {
        const lock = weekLocks.find(wl => wl.league === player.league);
        return lock && new Date(lock.lockTime) <= now;
      })
      .map(player => player.id);
  
    return lockedPlayerIds;
  }

  async function getTeamRanks(teamName, league) {
    return prisma.bowlingTeam.findFirst({
      where: {
        name: teamName,
        league: league,
      },
      include: {
        rank: true,
      },
    });
  }

  async function getDistinctPriorYears() {
    return prisma.priorYearStanding.findMany({
      select: { year: true },
      distinct: ["year"],
      orderBy: { year: "desc" },
    });
  }

  async function getPriorYearStandingsByYear(year) {
    return prisma.priorYearStanding.findMany({
      where: { year },
      orderBy: { place: "asc" },
      select: {
        id: true,
        year: true,
        place: true,
        wins: true,
        losses: true,
        ties: true,
        pointsFor: true,
        pointsAgainst: true,
        streak: true,
        captainName: true,
        teamName: true,
      },
    });
  }

  module.exports = {
    getTeams,
    getTeamsForHome,
    getTeam,
    getTeamById,
    createTeam,
    updateTeamById,
    getTeamPlayers,
    getFantasyTeamPlayers,
    getLockedPlayerIds,
    getTeamRanks,
    getDistinctPriorYears,
    getPriorYearStandingsByYear,
  };