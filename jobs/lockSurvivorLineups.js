const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function lockSurvivorLineups() {
  console.log("⏰ Running survivor lineup lock job...");

  try {
    const now = new Date();

    // 1️⃣ Get all locks where the lock time has passed
    const weekLocks = await prisma.weekLock.findMany({
      where: {
        lockTime: { lte: now },
      },
      orderBy: [{ league: "asc" }, { week: "asc" }], // oldest first per league
    });

    if (weekLocks.length === 0) {
      console.log("⏳ No leagues with past lock times, skipping.");
      return;
    }

    // 2️⃣ For each league, take only the *first* week that has passed
    const firstLocks = Object.values(
      weekLocks.reduce((acc, lock) => {
        if (!acc[lock.league]) acc[lock.league] = lock;
        return acc;
      }, {})
    );

    for (const lock of firstLocks) {
      // 3️⃣ Skip weeks that already have a snapshot
      const existingSnapshot = await prisma.survivorWeekLineup.findFirst({
        where: { week: lock.week, entry: { league: lock.league } },
      });

      if (existingSnapshot) {
        console.log(`✅ ${lock.league} week ${lock.week} already has snapshots, skipping.`);
        continue;
      }

      // 4️⃣ Find all active entries for this league
      const entries = await prisma.survivorEntry.findMany({
        where: { league: lock.league, eliminated: false },
      });

      for (const entry of entries) {
        // Get current lineup for the entry
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

        if (snapshotData.length > 0) {
          await prisma.survivorWeekLineup.createMany({
            data: snapshotData,
            skipDuplicates: true,
          });
          console.log(`✅ Snapshotted lineup for ${entry.teamName} (${lineup.length}) in ${lock.league} week ${lock.week}`);
        } else {
          console.log(`⚠️ No players for ${entry.teamName} — skipping empty lineup.`);
        }
      }
    }

    console.log("🏁 Survivor lineup lock job finished.");
  } catch (error) {
    console.error("❌ Error in survivor lineup lock job:", error);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = lockSurvivorLineups;