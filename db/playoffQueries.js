const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { calculateFantasyPoints } = require("../utils/calculateFantasyPoints");

async function generatePlayoffRound1(week, season) {
    const teams = await prisma.team.findMany();
  
    const rankedTeams = teams
      .map((team) => {
        const wins = team.wins || 0;
        const losses = team.losses || 0;
        const ties = team.ties || 0;
        const totalGames = wins + losses + ties || 1;
  
        const winPct = (wins + ties * 0.5) / totalGames;
  
        return {
          ...team,
          winPct,
        };
      })
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.points !== a.points) return b.points - a.points;
        return Math.random() < 0.5 ? -1 : 1;
      });
  
    const top6 = rankedTeams.slice(0, 6);
  
    if (top6.length < 6) {
      throw new Error(`Not enough teams for playoffs. Only found ${top6.length}`);
    }
  
    top6.forEach((team, index) => {
      team.playoffSeed = index + 1;
    });
  
    await Promise.all(
      top6.map((team) =>
        prisma.team.update({
          where: { id: team.id },
          data: { playoffSeed: team.playoffSeed },
        })
      )
    );
  
    const seed3 = top6.find((t) => t.playoffSeed === 3);
    const seed6 = top6.find((t) => t.playoffSeed === 6);
    const seed4 = top6.find((t) => t.playoffSeed === 4);
    const seed5 = top6.find((t) => t.playoffSeed === 5);
  
    if (!seed3 || !seed6 || !seed4 || !seed5) {
      throw new Error("Missing seed teams for Round 1.");
    }
  
    await prisma.match.createMany({
      data: [
        {
          week: week + 1,
          season,
          matchType: "First Round Playoff",
          team1Id: seed3.id,
          team2Id: seed6.id,
        },
        {
          week: week + 1,
          season,
          matchType: "First Round Playoff",
          team1Id: seed4.id,
          team2Id: seed5.id,
        },
      ],
    });
  }
  
  async function generatePlayoffRound2(week, season) {
    const previousWeek = week; 
    const semifinalWeek = week + 1;
  
    const round1Matches = await prisma.match.findMany({
      where: { week: previousWeek },
    });
  
    if (round1Matches.length !== 2) {
      throw new Error(`Expected 2 matches in round 1, found ${round1Matches.length}`);
    }
  
    const allRosters = await prisma.roster.findMany();
    const allScores = await prisma.weekScore.findMany();
  
    const validPositions = ["1", "2", "3", "4", "5", "Flex"];
    const teamScores = {};
  
    allRosters
      .filter(r => Number(r.week) === Number(previousWeek) && validPositions.includes(r.position))
      .forEach(r => {
        if (!teamScores[r.teamId]) teamScores[r.teamId] = 0;
  
        const playerWeekScores = allScores.filter(
          s => s.playerId === r.playerId && s.week === previousWeek
        );
  
        const fantasyPoints = calculateFantasyPoints(playerWeekScores);
        teamScores[r.teamId] += fantasyPoints;
      });
  
    const losers = [];
  
    for (const match of round1Matches) {
      const team1Score = teamScores[match.team1Id] ?? 0;
      const team2Score = teamScores[match.team2Id] ?? 0;
  
      if (team1Score > team2Score) {
        losers.push(match.team2Id);
      } else if (team2Score > team1Score) {
        losers.push(match.team1Id);
      } else {
        // Tie breaker (random)
        const loser = Math.random() < 0.5 ? match.team1Id : match.team2Id;
        losers.push(loser);
        console.log(`Tie - Randomly chosen loser: Team ${loser}`);
      }
    }
  
    await Promise.all(
      losers.map((id) =>
        prisma.team.update({
          where: { id },
          data: { playoffSeed: null },
        })
      )
    );
  
    const remaining = await prisma.team.findMany({
      where: {
        playoffSeed: {
          in: [1, 2, 3, 4, 5, 6],
        },
      },
    });
  
    const seedMap = new Map(
      remaining
        .filter((team) => team.playoffSeed !== undefined)
        .map((team) => [team.playoffSeed, team])
    );
  
    const opponentFor1 = seedMap.get(4) || seedMap.get(5);
    const opponentFor2 = seedMap.get(3) || seedMap.get(6);
  
    if (!seedMap.get(1) || !opponentFor1 || !seedMap.get(2) || !opponentFor2) {
      throw new Error("Missing teams for round 2 matchups.");
    }
  
    const matchups = [
      {
        team1Id: seedMap.get(1).id,
        team2Id: opponentFor1.id,
        matchType: "Semifinals",
        week: semifinalWeek,
        season,
      },
      {
        team1Id: seedMap.get(2).id,
        team2Id: opponentFor2.id,
        matchType: "Semifinals",
        week: semifinalWeek,
        season,
      },
    ];
  
    await prisma.match.createMany({ data: matchups });
  }
  
  async function generatePlayoffFinal(week, season) {
    const semifinalMatches = await prisma.match.findMany({
      where: { week },
    });
  
    if (semifinalMatches.length !== 2) {
      throw new Error(`Expected 2 semifinal matches, found ${semifinalMatches.length}`);
    }
  
    const allRosters = await prisma.roster.findMany();
    const allScores = await prisma.weekScore.findMany();
  
    const validPositions = ["1", "2", "3", "4", "5", "Flex"];
    const teamScores = {};
  
    allRosters
      .filter(r => Number(r.week) === Number(week) && validPositions.includes(r.position))
      .forEach(r => {
        if (!teamScores[r.teamId]) teamScores[r.teamId] = 0;
  
        const playerWeekScores = allScores.filter(
          s => s.playerId === r.playerId && s.week === week
        );
  
        const fantasyPoints = calculateFantasyPoints(playerWeekScores);
        teamScores[r.teamId] += fantasyPoints;
      });
  
    const winners = [];
    const losers = [];
  
    for (const match of semifinalMatches) {
      const team1Score = teamScores[match.team1Id] ?? 0;
      const team2Score = teamScores[match.team2Id] ?? 0;
  
      if (team1Score > team2Score) {
        winners.push(match.team1Id);
        losers.push(match.team2Id);
      } else if (team2Score > team1Score) {
        winners.push(match.team2Id);
        losers.push(match.team1Id);
      } else {
        // Tie-breaker: randomly pick winner and loser
        if (Math.random() < 0.5) {
          winners.push(match.team1Id);
          losers.push(match.team2Id);
        } else {
          winners.push(match.team2Id);
          losers.push(match.team1Id);
        }
      }
    }
  
    if (winners.length !== 2 || losers.length !== 2) {
      throw new Error(`Expected 2 winners and 2 losers, found winners: ${winners.length}, losers: ${losers.length}`);
    }
  
    await prisma.match.createMany({
      data: [
        {
          week: week + 1,
          season,
          matchType: "Championship",
          team1Id: winners[0],
          team2Id: winners[1],
        },
        {
          week: week + 1,
          season,
          matchType: "Third Place",
          team1Id: losers[0],
          team2Id: losers[1],
        },
      ],
    });
  }
  
  async function giveTrophies(week, season) {
    // 1. Clear all playoff seeds
    await prisma.team.updateMany({
      data: { playoffSeed: null },
    });
  
    // 2. Fetch final week matchups with matchType
    const finalMatchups = await prisma.match.findMany({
      where: { week, season },
      include: {
        team1: true,
        team2: true,
      },
    });
  
    const championshipMatch = finalMatchups.find(m => m.matchType === "Championship");
    const thirdPlaceMatch = finalMatchups.find(m => m.matchType === "Third Place");
  
    if (!championshipMatch || !thirdPlaceMatch) {
      console.error("Expected both a Championship and Third Place match.");
      return;
    }
  
    // 3. Calculate scores
    const allRosters = await prisma.roster.findMany({ where: { week } });
    const allScores = await prisma.weekScore.findMany({ where: { week } });
  
    const validPositions = ["1", "2", "3", "4", "5", "Flex"];
    const teamScores = {};
  
    allRosters
      .filter(r => validPositions.includes(r.position))
      .forEach(r => {
        if (!teamScores[r.teamId]) teamScores[r.teamId] = 0;
  
        const playerScores = allScores.filter(s => s.playerId === r.playerId);
        const fantasyPoints = calculateFantasyPoints(playerScores);
        teamScores[r.teamId] += fantasyPoints;
      });
  
    // 4. Determine winners and losers
    const getWinnerLoser = (match) => {
      const team1Score = teamScores[match.team1Id] ?? 0;
      const team2Score = teamScores[match.team2Id] ?? 0;
  
      if (team1Score > team2Score) {
        return { winner: match.team1Id, loser: match.team2Id };
      } else if (team2Score > team1Score) {
        return { winner: match.team2Id, loser: match.team1Id };
      } else {
        const rand = Math.random() < 0.5;
        return {
          winner: rand ? match.team1Id : match.team2Id,
          loser: rand ? match.team2Id : match.team1Id,
        };
      }
    };
  
    const { winner: champion, loser: runnerUp } = getWinnerLoser(championshipMatch);
    const { winner: thirdPlace, loser: fourthPlace } = getWinnerLoser(thirdPlaceMatch);
  
    // 5. Assign playoff seeds
    await prisma.team.updateMany({ where: { id: champion }, data: { playoffSeed: 1 } });
    await prisma.team.updateMany({ where: { id: runnerUp }, data: { playoffSeed: 2 } });
    await prisma.team.updateMany({ where: { id: thirdPlace }, data: { playoffSeed: 3 } });
  
    console.log("🏆 Playoff results assigned.");
  }

  async function getMatchesForWeek(week) {
    return await prisma.match.findMany({
      where: { week: parseInt(week) + 1 },
    });
  }
  
  module.exports = {
    generatePlayoffRound1,
    generatePlayoffRound2,
    generatePlayoffFinal,
    giveTrophies,
    getMatchesForWeek,
  };