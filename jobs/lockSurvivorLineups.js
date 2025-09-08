const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function lockSurvivorLineups() {
  console.log("⏰ Running survivor lineup lock job...");

  try {
    // Get all week locks where lockTime has passed but not completed
    const now = new Date();
    const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);

    const weekLocks = await prisma.weekLock.findMany({
      where: {
        completed: "no",
        lockTime: {
          lte: now,  // lockTime is in the past
          gte: threeHoursAgo,  // but not older than 3 hours ago
        },
      },
    });

    if (weekLocks.length === 0) {
      console.log("⏳ No leagues in lock window, skipping.");
      return;
    }

    for (const lock of weekLocks) {
      if (lock.week <= 5) {
        console.log(`⏭️ Skipping week ${lock.week} (no snapshot needed)`);
        continue;
      }

      // Find all active entries for this league
      const entries = await prisma.survivorEntry.findMany({
        where: {
          league: lock.league,
          eliminated: false,
        },
      });

      for (const entry of entries) {
        // Check if we already snapshotted for this week
        const alreadySnapshot = await prisma.survivorWeekLineup.findFirst({
          where: {
            entryId: entry.id,
            week: lock.week,
          },
        });

        if (alreadySnapshot) {
          console.log(`✅ Already snapshot for ${entry.teamName} (week ${lock.week})`);
          continue;
        }

        // Get current lineup (may be empty or incomplete)
        const lineup = await prisma.survivorPlayer.findMany({
          where: { entryId: entry.id },
          orderBy: { rank: "asc" },
        });

        const snapshotData = lineup.map(player => ({
          entryId: entry.id,
          week: lock.week,
          playerId: player.playerId,
          rank: player.rank,
        }));

        // Create snapshot even if empty
        if (snapshotData.length > 0) {
          await prisma.survivorWeekLineup.createMany({
            data: snapshotData,
          });
          console.log(`✅ Snapshotted lineup for ${entry.teamName} (count: ${lineup.length}), week ${lock.week}`);
        } else {
          // If no players, optionally create a placeholder entry or just log
          console.log(`⚠️ No players for ${entry.teamName}, empty lineup snapshotted (no player records).`);
          // You could optionally insert a placeholder record in survivorWeekLineup here if needed
        }
      }
    }

    console.log("🏁 Survivor lineup lock job finished.");
  } catch (error) {
    console.error("❌ Error in survivor lineup lock job:", error);
  }
}

module.exports = lockSurvivorLineups;