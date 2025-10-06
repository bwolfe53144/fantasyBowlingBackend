const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const playerdb = require("../db/playerQueries");

async function resolveExpiredClaims() {
  console.log("Checking for expired claims...");

  const expiredClaims = await prisma.playerClaim.findMany({
    where: {
      createdAt: { lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      resolved: false,
    },
    include: {
      claimants: {
        include: {
          user: {
            include: { team: true },
          },
        },
      },
      player: true,
    },
  });

  console.log(`Found ${expiredClaims.length} expired claims`);

  const droppedPlayerIds = new Set();

  for (const claim of expiredClaims) {
    try {
      if (claim.claimants.length === 0) {
        console.warn(`No claimants for claim ID: ${claim.id}`);
        continue;
      }

      // Pick a random winner
      const winner = claim.claimants[Math.floor(Math.random() * claim.claimants.length)];

      if (!winner.user.team?.id) {
        console.warn(`Claimant ${winner.user.username} has no team.`);
        continue;
      }

      // Skip if the winner's dropPlayerId has already been dropped in this run
      if (winner.dropPlayerId && droppedPlayerIds.has(winner.dropPlayerId)) {
        console.log(
          `Skipping claim ${claim.id} for ${claim.player.name} because drop player ${winner.dropPlayerId} was already dropped`
        );
        continue;
      }

      // Assign player to winner's team
      await prisma.player.update({
        where: { id: claim.playerId },
        data: { teamId: winner.user.team.id },
      });

      // Log add transaction
      await prisma.playerTransaction.create({
        data: {
          playerId: claim.player.id,
          playerName: claim.player.name,
          teamId: winner.user.team.id,
          teamName: winner.user.team.name,
          action: "add",
        },
      });

      // Drop player if needed
      if (winner.dropPlayerId) {
        const droppedPlayer = await prisma.player.findUnique({
          where: { id: winner.dropPlayerId },
        });

        if (droppedPlayer) {
          const { unlockedWeeks } = await playerdb.getUnlockedWeeks();

          await playerdb.dropPlayer(droppedPlayer.id, winner.user.team.id);
          await playerdb.clearPlayerRosters(droppedPlayer.id, winner.user.team.id, unlockedWeeks);

          console.log(`Dropped player ${droppedPlayer.name} from team ${winner.user.team.name}`);

          droppedPlayerIds.add(droppedPlayer.id);

          // Delete other claims involving this dropped player
          const otherClaims = await prisma.playerClaim.findMany({
            where: {
              id: { not: claim.id },
              claimants: { some: { dropPlayerId: droppedPlayer.id } },
            },
            include: { claimants: true, player: true },
          });

          for (const c of otherClaims) {
            await prisma.claimant.deleteMany({ where: { claimId: c.id } });
            await prisma.playerClaim.delete({ where: { id: c.id } });
            console.log(
              `Removed claim ${c.id} for ${c.player.name} because it included dropped player ${droppedPlayer.name}`
            );
          }

          // Cancel pending trades involving dropped player
          const pendingTrades = await prisma.trade.findMany({
            where: {
              status: { not: "ACCEPTED" },
              OR: [
                { players: { some: { playerId: droppedPlayer.id } } },
                { drops: { some: { playerId: droppedPlayer.id } } },
              ],
            },
            include: {
              players: true,
              drops: true,
            },
          });

          for (const trade of pendingTrades) {
            // Delete TradePlayer and TradeDrop entries
            await prisma.tradePlayer.deleteMany({ where: { tradeId: trade.id } });
            await prisma.tradeDrop.deleteMany({ where: { tradeId: trade.id } });

            // Delete the trade itself
            await prisma.trade.delete({ where: { id: trade.id } });

            console.log(`Cancelled pending trade ${trade.id} involving dropped player ${droppedPlayer.name}`);
          }
        }
      }

      // Clean up this resolved claim
      await prisma.claimant.deleteMany({ where: { claimId: claim.id } });
      await prisma.playerClaim.delete({ where: { id: claim.id } });

      console.log(`Resolved and deleted claim for ${claim.player.name}, assigned to ${winner.user.username}`);
    } catch (err) {
      console.error(`Failed to resolve claim ${claim.id}:`, err);
    }
  }
}

module.exports = resolveExpiredClaims;