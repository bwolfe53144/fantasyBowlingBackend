const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const playerdb = require("../db/playerQueries");

async function resolveExpiredClaims() {
  console.log("Checking for expired claims...");

  const expiredClaims = await prisma.playerClaim.findMany({
    where: {
      createdAt: { lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }, // 2 days ago
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

  for (const claim of expiredClaims) {
    try {
      if (claim.claimants.length === 0) {
        console.warn(`No claimants for claim ID: ${claim.id}`);
        continue;
      }

      const winner = claim.claimants[Math.floor(Math.random() * claim.claimants.length)];

      if (!winner.user.team?.id) {
        console.warn(`Claimant ${winner.user.username} has no team.`);
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

      if (winner.dropPlayerId) {
        const droppedPlayer = await prisma.player.findUnique({
          where: { id: winner.dropPlayerId },
        });

        if (droppedPlayer) {
          const { unlockedWeeks } = await playerdb.getUnlockedWeeks();

          // Drop player
          await playerdb.dropPlayer(
            droppedPlayer.id,
            winner.user.team.id
          );

          // Clear roster only for unlocked weeks
          await playerdb.clearPlayerRosters(
            droppedPlayer.id,
            winner.user.team.id,
            unlockedWeeks
          );

          // Find all duplicate claims by this team dropping the same player
          const duplicateClaims = await prisma.playerClaim.findMany({
            where: {
              claimants: {
                some: {
                  user: { teamId: winner.user.team.id },
                  dropPlayerId: droppedPlayer.id,
                },
              },
            },
            include: { player: true },
          });

          for (const dup of duplicateClaims) {
            // Remove claimants
            await prisma.claimant.deleteMany({
              where: { claimId: dup.id },
            });

            // Remove the claim itself
            await prisma.playerClaim.delete({
              where: { id: dup.id },
            });

            console.log(
              `Removed duplicate claim for ${dup.player.name} by team ${winner.user.team.name} (drop ${droppedPlayer.name})`
            );
          }

          console.log(`Dropped player ${droppedPlayer.name} from team ${winner.user.team.name}`);
        }
      }

      // Clean up this resolved claim
      await prisma.claimant.deleteMany({
        where: { claimId: claim.id },
      });

      await prisma.playerClaim.delete({
        where: { id: claim.id },
      });

      console.log(`Resolved and deleted claim for ${claim.player.name}, assigned to ${winner.user.username}`);
    } catch (err) {
      console.error(`Failed to resolve claim ${claim.id}:`, err);
    }
  }
}

module.exports = resolveExpiredClaims;