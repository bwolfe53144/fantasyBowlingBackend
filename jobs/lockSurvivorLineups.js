const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function lockSurvivorLineups() {
  console.log("⏰ Running survivor lineup lock job...");

  try {
    const now = new Date();

    // 1️⃣ Get all week locks where the lock time has passed
    const weekLocks = await prisma.weekLock.findMany({
      where: { lockTime: { lte: now } },
      orderBy: [{ league: "asc" }, { week: "desc" }], // most recent first
    });

    if (weekLocks.length === 0) {
      console.log("⏳ No leagues with past lock times, skipping.");
      return;
    }

    // 2️⃣ Take only the most recent lock per league
    const latestLocks = Object.values(
      weekLocks.reduce((acc, lock) => {
        if (!acc[lock.league]) acc[lock.league] = lock;
        return acc;
      }, {})
    );

    console.log(`📋 Found ${latestLocks.length} leagues ready for snapshot:`);
    latestLocks.forEach(lock =>
      console.log(`   - ${lock.league} (Week ${lock.week})`)
    );

    let totalCreated = 0;
    let totalSkipped = 0;

    for (const lock of latestLocks) {
      console.log(`\n🔹 Processing ${lock.league} week ${lock.week}...`);

      // 🧩 Skip leagues with week < 10
      if (lock.week < 10) {
        console.log(`🚫 ${lock.league} week ${lock.week} is before Week 10 — skipping snapshot.`);
        totalSkipped++;
        continue;
      }

      // 3️⃣ Skip if this league/week already has a snapshot
      const existingSnapshot = await prisma.survivorWeekLineup.findFirst({
        where: { week: lock.week, entry: { league: lock.league } },
      });

      if (existingSnapshot) {
        console.log(`⏭️  Skipping — snapshots already exist for ${lock.league} week ${lock.week}.`);
        totalSkipped++;
        continue;
      }

      // 4️⃣ Get all active entries (not eliminated)
      const entries = await prisma.survivorEntry.findMany({
        where: { league: lock.league, eliminated: false },
      });

      if (entries.length === 0) {
        console.log(`⚠️  No active entries found for ${lock.league}, skipping.`);
        totalSkipped++;
        continue;
      }

      let createdForLeague = 0;

      for (const entry of entries) {
        const lineup = await prisma.survivorPlayer.findMany({
          where: { entryId: entry.id },
          orderBy: { rank: "asc" },
        });

        if (lineup.length === 0) {
          console.log(`⚠️  ${entry.teamName} has no players — skipping empty lineup.`);
          continue;
        }

        const snapshotData = lineup.map(player => ({
          entryId: entry.id,
          week: lock.week,
          playerId: player.playerId,
          rank: player.rank,
        }));

        await prisma.survivorWeekLineup.createMany({
          data: snapshotData,
          skipDuplicates: true,
        });

        console.log(
          `✅ Snapshotted lineup for ${entry.teamName} (${lineup.length} players) in ${lock.league} week ${lock.week}`
        );

        createdForLeague++;
      }

      if (createdForLeague > 0) {
        console.log(`📦 Created ${createdForLeague} snapshots for ${lock.league} week ${lock.week}`);
        totalCreated++;
      } else {
        console.log(`⚪ No valid lineups found in ${lock.league}, marking as skipped.`);
        totalSkipped++;
      }
    }

    console.log(`\n🏁 Survivor lineup lock job finished — ${totalCreated} leagues snapshotted, ${totalSkipped} skipped.`);
  } catch (error) {
    console.error("❌ Error in survivor lineup lock job:", error);
  } finally {
    await prisma.$disconnect();
  }
}

module.exports = lockSurvivorLineups;


