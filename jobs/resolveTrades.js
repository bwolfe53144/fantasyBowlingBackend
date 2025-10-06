const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const playerdb = require("../db/playerQueries");

const MY_TEAM_ID = "1a288661-7177-40bb-86fe-974e1c864ddd";
const MIKE_TS_TEAM_ID = "e113163f-6e13-4a05-9e88-a22c832516db";

async function resolveTrades() {
  console.log("Resolving accepted trades...");

  // 24-hour buffer
  const bufferTime = 24 * 60 * 60 * 1000;

  const acceptedTrades = await prisma.trade.findMany({
    where: {
      status: "ACCEPTED",
      updatedAt: { lte: new Date(Date.now() - bufferTime) },
    },
    include: {
      players: { include: { player: true } },
      drops: { include: { player: true } },
      votes: true,
      fromTeam: true,
      toTeam: true,
    },
  });

  console.log(`Found ${acceptedTrades.length} trades ready to resolve`);

  for (const trade of acceptedTrades) {
    try {
      // Compute vote counts
      const totalVotes = trade.votes.length;
      const weightedVotes = trade.votes.reduce((sum, v) => {
        if (v.teamId === MY_TEAM_ID || v.teamId === MIKE_TS_TEAM_ID) return sum + 2;
        return sum + 1;
      }, 0);

      let vetoCount = trade.votes.filter(v => !v.approved).length;

      // Extra veto weighting for special teams
      for (const specialId of [MY_TEAM_ID, MIKE_TS_TEAM_ID]) {
        const vote = trade.votes.find(v => v.teamId === specialId);
        if (vote && !vote.approved) vetoCount++;
      }

      const isVetoed = totalVotes >= 6 && vetoCount / weightedVotes >= 2 / 3;

      if (isVetoed) {
        console.log(`Trade ${trade.id} vetoed by votes`);

        const playerNames = trade.players
          .map(tp => tp.player?.name || "Unknown Player")
          .join(" for ");
        const vetoMessage = `Trade vetoed between ${trade.fromTeam.name} and ${trade.toTeam.name}: ${playerNames}`;

        await prisma.playerTransaction.create({
          data: {
            action: vetoMessage,
            playerId: null,
            playerName: null,
            teamId: trade.fromTeamId,
            teamName: `${trade.fromTeam.name} & ${trade.toTeam.name}`,
          },
        });
      } else {
        const { unlockedWeeks } = await playerdb.getUnlockedWeeks();

        // Move players
        for (const tp of trade.players) {
          const oldTeamId = tp.player.teamId;
          const newTeamId = tp.role === "OFFERED" ? trade.toTeamId : trade.fromTeamId;

          await prisma.player.update({
            where: { id: tp.playerId },
            data: { teamId: newTeamId },
          });

          // Log “traded for” for receiving team
          await prisma.playerTransaction.create({
            data: {
              action: "traded for",
              playerId: tp.player.id,
              playerName: tp.player.name,
              teamId: newTeamId,
              teamName: newTeamId === trade.toTeamId ? trade.toTeam.name : trade.fromTeam.name,
            },
          });

          // Log “traded” for old team
          if (oldTeamId && oldTeamId !== newTeamId) {
            await prisma.playerTransaction.create({
              data: {
                action: "traded",
                playerId: tp.player.id,
                playerName: tp.player.name,
                teamId: oldTeamId,
                teamName: oldTeamId === trade.fromTeamId ? trade.fromTeam.name : trade.toTeam.name,
              },
            });

            await playerdb.clearPlayerRosters(tp.playerId, oldTeamId, unlockedWeeks);
          }
        }

        // Handle drops (skip any player already traded above)
        for (const drop of trade.drops) {
          if (trade.players.some(tp => tp.playerId === drop.playerId)) continue;

          const oldTeamId = drop.teamId;

          await playerdb.dropPlayer(drop.playerId, oldTeamId);
          await playerdb.clearPlayerRosters(drop.playerId, oldTeamId, unlockedWeeks);

          await prisma.playerTransaction.create({
            data: {
              action: "dropped",
              playerId: drop.player.id,
              playerName: drop.player.name,
              teamId: oldTeamId,
              teamName: oldTeamId === trade.toTeamId ? trade.toTeam.name : trade.fromTeam.name,
            },
          });
        }
      }

      // Cleanup for all trades (accepted or vetoed)
      await prisma.tradePlayer.deleteMany({ where: { tradeId: trade.id } });
      await prisma.tradeDrop.deleteMany({ where: { tradeId: trade.id } });
      await prisma.tradeVote.deleteMany({ where: { tradeId: trade.id } });
      await prisma.trade.delete({ where: { id: trade.id } });

      console.log(`Trade ${trade.id} resolved (vetoed: ${isVetoed})`);
    } catch (err) {
      console.error(`Failed to resolve trade ${trade.id}:`, err);
    }
  }
}

module.exports = resolveTrades;


