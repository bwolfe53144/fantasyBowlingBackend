const { PrismaClient } = require('@prisma/client');
const playerDb = require("./playerQueries");
const rosterDB = require("./rosterQueries");
const { calculateFantasyPoints } = require("../utils/calculateFantasyPoints");

const prisma = new PrismaClient();

//  Team & Player Assignment
async function clearAllPlayerTeams() {
    return await prisma.player.updateMany({ data: { teamId: null } });
  }
  
  async function assignPlayerToTeam(playerId, teamId) {
    const player = await prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new Error("Player not found");
  
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new Error("Team not found");
  
    await prisma.player.update({ where: { id: playerId }, data: { teamId } });
  
    await prisma.playerTransaction.create({
      data: {
        playerId: player.id,
        playerName: player.name,
        teamId: team.id,
        teamName: team.name,
        action: "add",
        timestamp: new Date(),
      },
    });
  
    return { message: "Player assigned and transaction logged." };
  }
  
  async function removePlayerFromTeam(playerId) {
    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: { team: true },
    });
  
    if (!player || !player.teamId || !player.team) {
      throw new Error("Player not found or not assigned to a team.");
    }
  
    const { unlockedWeeks } = await playerDb.getUnlockedWeeks();
  
    const updatedPlayer = await prisma.player.update({
      where: { id: playerId },
      data: { teamId: null },
    });
  
    await prisma.playerTransaction.create({
      data: {
        playerId: player.id,
        playerName: player.name,
        teamId: player.team.id,
        teamName: player.team.name,
        action: "drop",
        timestamp: new Date(),
      },
    });
  
    await playerDb.clearPlayerRosters(playerId, player.teamId, unlockedWeeks);
  
    return {
      message: "Player removed from team and rosters cleared.",
      player: updatedPlayer,
    };
  }
  
  async function updatePlayerPosition(playerId, position) {
    return await prisma.player.update({
      where: { id: playerId },
      data: { position },
    });
  }
  
  // Schedule & Lock Times  
  function generateRoundRobinWeeks(teams) {
    const totalTeams = teams.length;
    const totalWeeks = totalTeams - 1;
    const halfSize = totalTeams / 2;
  
    const pivot = teams[0];
    const rotating = teams.slice(1);
    const weeks = [];
  
    for (let week = 0; week < totalWeeks; week++) {
      const weeklyMatchups = [];
  
      const left = [pivot, ...rotating.slice(0, halfSize - 1)];
      const right = rotating.slice(halfSize - 1).reverse();
  
      for (let i = 0; i < halfSize; i++) {
        weeklyMatchups.push([left[i], right[i]]);
      }
  
      rotating.unshift(rotating.pop());
      weeks.push(weeklyMatchups);
    }
  
    return weeks;
  }
  
  async function generateSeasonSchedule(weeks, season, skipWeeks = []) {
    const teams = await prisma.team.findMany({ include: { players: true } });
  
    if (!weeks || teams.length < 2) {
      throw new Error("Weeks and at least 2 teams required.");
    }
  
    if (teams.length % 2 !== 0) {
      throw new Error("Number of teams must be even.");
    }
  
    await prisma.match.deleteMany({ where: { season } });
    await rosterDB.resetTeamStats();
  
    const playoffWeeks = new Set([weeks - 2, weeks - 1, weeks]);
    const roundRobinWeeks = generateRoundRobinWeeks(teams);
  
    const schedule = [];
    let roundIndex = 0;
  
    for (let week = 1; week <= weeks; week++) {
      if (skipWeeks.includes(week) || playoffWeeks.has(week)) continue;
  
      const matchups = roundRobinWeeks[roundIndex % roundRobinWeeks.length];
      for (const [team1, team2] of matchups) {
        schedule.push({ week, season, team1Id: team1.id, team2Id: team2.id });
      }
  
      roundIndex++;
    }
  
    await prisma.match.createMany({ data: schedule });
  
    const allPlayers = await prisma.player.findMany({
      include: { weekScores: true },
    });
  
    const updates = allPlayers.map((player) => {
      const scores = player.weekScores;
      const allGames = scores.flatMap(s => [s.game1 || 0, s.game2 || 0, s.game3 || 0]);
      const totalGames = allGames.filter(g => g > 0).length;
      const totalPins = allGames.reduce((acc, val) => acc + val, 0);
      const avg = totalGames > 0 ? (totalPins / totalGames).toFixed(2) : null;
      const totalFantasyPoints = Array.isArray(scores)
        ? scores.reduce((sum, ws) => sum + calculateFantasyPoints([ws]), 0).toFixed(2)
        : "0.00";
  
      return prisma.player.update({
        where: { id: player.id },
        data: {
          lyGames: totalGames.toString(),
          lyAverage: avg ? avg.toString() : null,
          lyPoints: totalFantasyPoints.toString(),
        },
      });
    });
  
    await Promise.all(updates);
  
    return {
      message: "Schedule created and player stats updated",
      weeksScheduled: weeks - skipWeeks.length - 3,
      totalMatchups: schedule.length,
      skippedWeeks: skipWeeks,
    };
  }
  
  async function setWeekLockTimes(lockTimes) {
    const leaguesToReset = Array.from(new Set(lockTimes.map(entry => entry.league)));
  
    // Reset completed = "no" for all weeks in selected leagues and season
    await prisma.weekLock.updateMany({
      where: {
        league: { in: leaguesToReset },
        season: lockTimes[0].season, // assuming all entries have same season (as in your payload)
      },
      data: {
        completed: "no",
      },
    });
  
    // Now update or create each week lock entry
    const upserts = lockTimes.map((entry) =>
      prisma.weekLock.upsert({
        where: {
          league_season_week: {
            league: entry.league,
            season: entry.season,
            week: entry.week,
          },
        },
        update: {
          lockTime: new Date(entry.lockTime),
          completed: "no", // explicitly set it again in case
        },
        create: {
          league: entry.league,
          season: entry.season,
          week: entry.week,
          lockTime: new Date(entry.lockTime),
          completed: "no",
        },
      })
    );
  
    await Promise.all(upserts);
    return { message: "Selected lock times saved and completed flags reset successfully." };
  }
  
  // Claims & Transactions
  async function processPlayerClaim(playerId, teamId) {
    const claim = await prisma.playerClaim.findFirst({
      where: { playerId },
      include: {
        player: true,
        claimants: {
          include: {
            user: { include: { team: true } },
            dropPlayer: true,
          },
        },
      },
    });
  
    if (!claim) throw new Error("Claim not found");
  
    const player = claim.player;
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) throw new Error("Team not found");
  
    const claimant = claim.claimants.find(c => c.user.team?.id === teamId);
    if (!claimant) throw new Error("Claimant for this team not found");
  
    if (claimant.dropPlayerId) {
      await prisma.player.update({
        where: { id: claimant.dropPlayerId },
        data: { teamId: null },
      });
  
      await prisma.playerTransaction.create({
        data: {
          action: "drop",
          playerId: claimant.dropPlayer.id,
          playerName: claimant.dropPlayer.name,
          teamId: team.id,
          teamName: team.name,
          timestamp: new Date(),
        },
      });
    }
  
    await prisma.player.update({
      where: { id: player.id },
      data: { teamId },
    });
  
    await prisma.playerTransaction.create({
      data: {
        action: "add",
        playerId: player.id,
        playerName: player.name,
        teamId: team.id,
        teamName: team.name,
        timestamp: new Date(),
      },
    });
  
    await prisma.claimant.deleteMany({ where: { claimId: claim.id } });
    await prisma.playerClaim.deleteMany({ where: { playerId: player.id } });
  
    return {
      message: `Claim processed: ${player.name} added to ${team.name}` +
        (claimant.dropPlayer?.name ? `, dropped ${claimant.dropPlayer.name}` : ""),
    };
  }
  
  async function clearPlayerTransactions() {
    return await prisma.playerTransaction.deleteMany({});
  }
  
  //  Admin Utilities
  async function clearWeekScores() {
    return await prisma.weekScore.deleteMany({});
  }
  
  async function deleteTeamByName(teamName) {
    return await prisma.team.delete({
      where: { name: teamName },
    });
  }
  
  async function changeUserRole(userId, role) {
    return await prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  async function getEmailSubscribedUsers() {
    return prisma.user.findMany({
      where: {
        emailSubscribed: true,
        email: {
          not: null,
        },
      },
    });
  }
  
  module.exports = {
    clearAllPlayerTeams,
    assignPlayerToTeam,
    removePlayerFromTeam,
    updatePlayerPosition,
    generateSeasonSchedule, 
    setWeekLockTimes,
    processPlayerClaim, 
    clearPlayerTransactions,
    clearWeekScores,
    deleteTeamByName,
    changeUserRole,
    getEmailSubscribedUsers,
  };