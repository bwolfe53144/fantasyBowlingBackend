const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getAllPlayers() {
  return await prisma.player.findMany({
    include: {
      team: true,
      weekScores: true,
      tradePlayers: {
        include: {
          trade: true,    
        },
      },
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
    await prisma.$transaction(async (tx) => {
      // 1️⃣ Fetch player
      const player = await tx.player.findUnique({ where: { id: playerId } });
      if (!player) throw new Error("Player not found");

      // 2️⃣ Fetch team
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });
      if (!team) throw new Error("Team not found");

      // 3️⃣ Find all trades involving the dropped player
      const tradesFromPlayers = await tx.tradePlayer.findMany({
        where: { playerId },
        select: { tradeId: true, trade: { select: { status: true } } },
      });

      const tradesFromDrops = await tx.tradeDrop.findMany({
        where: { playerId },
        select: { tradeId: true, trade: { select: { status: true } } },
      });

      // 4️⃣ Collect tradeIds for trades NOT accepted
      const tradeIdsToDelete = [
        ...tradesFromPlayers,
        ...tradesFromDrops,
      ]
        .filter((t) => t.trade?.status !== "ACCEPTED")
        .map((t) => t.tradeId);

      if (tradeIdsToDelete.length > 0) {
        // 5️⃣ Delete all TradePlayer and TradeDrop rows for these trades
        await tx.tradePlayer.deleteMany({
          where: { tradeId: { in: tradeIdsToDelete } },
        });

        await tx.tradeDrop.deleteMany({
          where: { tradeId: { in: tradeIdsToDelete } },
        });

        // 6️⃣ Delete the trades themselves
        await tx.trade.deleteMany({
          where: { id: { in: tradeIdsToDelete } },
        });
      }

      // 7️⃣ Disconnect player from team and clear position
      await tx.player.update({
        where: { id: playerId },
        data: {
          setPosition: "",
          team: { disconnect: true },
        },
      });

      // 8️⃣ Log the transaction
      await tx.playerTransaction.create({
        data: {
          playerId,
          playerName: player.name,
          teamId,
          teamName: team.name,
          action: "drop",
          timestamp: new Date(),
        },
      });
    });

    console.log(`Player ${playerId} dropped successfully along with related pending trades.`);
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
  const allWeekLocks = await prisma.weekLock.findMany({
    select: { week: true, lockTime: true },
  });

  if (allWeekLocks.length === 0) return { unlockedWeeks: [] };

  const now = new Date();
  const weekGroups = {};

  for (const { week, lockTime } of allWeekLocks) {
    if (!weekGroups[week]) weekGroups[week] = [];
    weekGroups[week].push(lockTime);
  }

  // Figure out unlocked weeks (all locks still in the future)
  const unlockedWeeks = Object.entries(weekGroups)
    .filter(([_, locks]) => locks.every(t => t > now))
    .map(([week]) => parseInt(week))
    .sort((a, b) => a - b);

  // 🧩 Debug: log previous week's lock times
  if (unlockedWeeks.length > 0) {
    const firstUnlocked = unlockedWeeks[0];
    const prevWeek = firstUnlocked - 1;

    if (weekGroups[prevWeek]) {
      console.log(`🕒 Previous week (${prevWeek}) lock times:`);
      weekGroups[prevWeek].forEach((t, i) => {
        console.log(`  [${i + 1}] ${t.toISOString()} (now: ${now.toISOString()})`);
      });
    } else {
      console.log(`⚠️ No lock times found for previous week (${prevWeek})`);
    }
  } else {
    console.log("⚠️ No unlocked weeks found at all");
  }

  return { unlockedWeeks };
}


async function getPlayerWithStatsByName(playerName) {
  return await prisma.player.findMany({
    where: {
      name: {
        equals: playerName,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      league: true,
      lyAverage: true,
      position: true,
      team: {
        select: { name: true },
      },
      lyAverage: true,
      weekScores: true,
      playerRank: true,
      badges: true,
      tradePlayers: {
        include: {
          trade: {
            select: {
              id: true,
              status: true,      
              fromTeamId: true,
              toTeamId: true,
            },
          },
        },
      },
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