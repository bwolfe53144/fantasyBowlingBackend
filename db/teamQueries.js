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
        owner: { select: { firstname: true, lastname: true } },
        players: {
          include: {
            weekScores: true,
            tradePlayers: {
              include: {
                trade: {
                  select: {
                    id: true,
                    status: true,
                    fromTeam: { select: { id: true, name: true } },
                    toTeam: { select: { id: true, name: true } },
                  },
                },
              },
            },
            // Claims where this player is the claimed player
            claims: {
              include: {
                claimants: {
                  include: {
                    user: true,
                    dropPlayer: true,
                  },
                },
              },
            },
            // Claims where this player is the dropped player
            dropClaimants: {
              include: {
                claim: {
                  include: {
                    player: true,
                    claimants: {
                      include: {
                        user: true,
                        dropPlayer: true,
                      },
                    },
                  },
                },
                user: true,
                dropPlayer: true,
              },
            },
          },
        },
        team1Matches: {
          include: { team2: { select: { id: true, name: true } } },
        },
        team2Matches: {
          include: { team1: { select: { id: true, name: true } } },
        },
        rosters: { include: { player: true } },
        transactions: { include: { player: true } },
      },
    });
  
    if (!team) return null;
  
    const captain = team.owner
      ? `${team.owner.firstname} ${team.owner.lastname.charAt(0)}.`
      : null;
  
    const { wins, losses, ties } = team;
    const record = ties > 0 ? `${wins}-${losses}-${ties}` : `${wins}-${losses}`;
  
    const playersWithStats = team.players.map((player) => {
      const totalGames = player.weekScores.length;
      const totalPoints = player.weekScores.reduce((sum, s) => sum + s.points, 0);
      const averagePPG = totalGames > 0 ? (totalPoints / totalGames).toFixed(2) : 0;
  
      return {
        ...player,
        totalGames,
        totalPoints,
        averagePPG,
        average: averagePPG,
        unresolvedClaims: player.claims,          // claims where player is being claimed
        dropUnresolvedClaims: player.dropClaimants, // claims where player is being dropped
      };
    });
  
    return {
      ...team,
      captain,
      record,
      players: playersWithStats,
    };
  }
  
  async function getTeamById(teamId) {
    return prisma.team.findUnique({
      where: { id: teamId },
    });
  }
  
  async function createTeam(name, userId) {
    const formattedName = name
    .trim()                   // remove leading/trailing spaces
    .replace(/\s+/g, ' ')     // collapse multiple spaces into one
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
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
        name: {
          equals: teamName,
          mode: "insensitive",
        },
        league: {
          equals: league,
          mode: "insensitive",
        },
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

  const getPlayerById = (id) => {
    return prisma.player.findUnique({ where: { id } });
  };
  
  // Get the roster for a team
  const getTeamRoster = (teamId) => {
    return prisma.player.findMany({
      where: { teamId },
      orderBy: { name: "asc" }, // optional, for consistent order
    });
  };
  
  // Create a new trade
  const createTrade = ({ fromTeamId, toTeamId }) => {
    return prisma.trade.create({
      data: {
        fromTeamId,
        toTeamId,
        status: "PENDING", 
      },
    });
  };
  
  // Add multiple trade players (offered or requested)
  const addTradePlayers = (players) => {
    return prisma.tradePlayer.createMany({ data: players });
  };
  
  // Add multiple trade drops (for roster balancing)
  const addTradeDrops = (drops) => {
    return prisma.tradeDrop.createMany({ data: drops });
  };

  const getAllTrades = async () => {
    return prisma.trade.findMany({
      include: {
        fromTeam: true,
        toTeam: true,
        players: {
          include: {
            player: true, 
          },
        },
        drops: {
          include: {
            player: true, 
          },
        },
        votes: {
          include: {
            team: true, 
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  };

  const markTradeAsViewed = (tradeId) => {
    return prisma.trade.update({
      where: { id: tradeId },
      data: { status: "VIEWED" }, 
    });
  };

  async function getTradeById(id) {
    return prisma.trade.findUnique({
      where: { id },
      include: {
        fromTeam: true,
        toTeam: true,
        players: {
          include: { player: true }
        },
        drops: {
          include: {
            player: true,  // <- include the Player object
            team: true     // optional if you want the team info
          }
        },
        votes: true
      }
    });
  }
  
  async function acceptTrade(id) {
    console.log("Accepting trade with ID:", id);
  
    // Fetch the trade with all related data
    const trade = await prisma.trade.findUnique({
      where: { id },
      include: {
        players: true,
        drops: true,
      },
    });
  
    if (!trade) return null; // trade not found
  
    // Collect all involved player IDs (traded + dropped)
    const playerIds = [
      ...(trade.players?.map((p) => p.playerId) || []),
      ...(trade.drops?.map((d) => d.playerId) || []),
    ];
  
    return prisma.$transaction(async (prisma) => {
      // 1️⃣ Mark this trade as accepted
      const updatedTrade = await prisma.trade.update({
        where: { id },
        data: { status: "ACCEPTED" },
        include: {
          players: true,
          drops: true,
          votes: true,
          fromTeam: true,
          toTeam: true,
        },
      });
  
      if (playerIds.length > 0) {
        // 2️⃣ Delete all other TradePlayer rows for these players (except current trade)
        await prisma.tradePlayer.deleteMany({
          where: {
            playerId: { in: playerIds },
            trade: { NOT: { id } },
          },
        });
  
        // 3️⃣ Delete all other trades containing these players (except current trade)
        await prisma.trade.deleteMany({
          where: {
            players: { some: { playerId: { in: playerIds } } },
            NOT: { id },
          },
        });
  
        // 4️⃣ Delete unresolved claims for these players, including dropped players
        const claimsToDelete = await prisma.playerClaim.findMany({
          where: {
            resolved: false,
            OR: [
              { playerId: { in: playerIds } }, // claimed player
              { claimants: { some: { dropPlayerId: { in: playerIds } } } }, // dropped players
            ],
          },
          select: { id: true },
        });
  
        const claimIds = claimsToDelete.map((c) => c.id);
        if (claimIds.length > 0) {
          // Delete related claimants first
          await prisma.claimant.deleteMany({
            where: { claimId: { in: claimIds } },
          });
  
          // Then delete the claims
          await prisma.playerClaim.deleteMany({
            where: { id: { in: claimIds } },
          });
        }
      }
  
      return updatedTrade;
    });
  }

  async function declineTrade(id) {
    const trade = await prisma.trade.findUnique({ where: { id } });
    if (!trade) return null;
  
    return prisma.$transaction([
      prisma.tradePlayer.deleteMany({ where: { tradeId: id } }),
      prisma.tradeDrop.deleteMany({ where: { tradeId: id } }),
      prisma.tradeVote.deleteMany({ where: { tradeId: id } }),
      prisma.trade.delete({ where: { id } }),
    ]);
  }

  async function findPendingTrade(fromTeamId, toTeamId) {
    return prisma.trade.findFirst({
      where: {
        fromTeamId,
        toTeamId,
        status: "PENDING",
      },
    });
  }

  async function getPlayersInAcceptedTrades(playerIds) {
    // Fetch TradePlayer rows where the trade is accepted
    const blockedPlayers = await prisma.tradePlayer.findMany({
      where: {
        playerId: { in: playerIds },
        trade: { status: "ACCEPTED" },
      },
      include: { player: true }, // include player info
    });
  
    // Return just the player objects
    return blockedPlayers.map(tp => tp.player);
  }

  async function castTradeVote(tradeId, teamId, approved) {
    // Upsert ensures one vote per team per trade
    return prisma.tradeVote.upsert({
      where: {
        tradeId_teamId: { tradeId, teamId },
      },
      update: {
        approved,
      },
      create: {
        tradeId,
        teamId,
        approved,
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
    getPlayerById,
    getTeamRoster,
    createTrade,
    addTradePlayers,
    addTradeDrops,
    getAllTrades,
    markTradeAsViewed,
    getTradeById,
    acceptTrade,
    declineTrade,
    findPendingTrade,
    getPlayersInAcceptedTrades,
    castTradeVote,
  };