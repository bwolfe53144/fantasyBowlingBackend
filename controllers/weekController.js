const db = require("../db/weekQueries");

// WeekLocks 
async function getIncompleteWeeklocks(req, res) {
  try {
    const weeks = await db.findIncompleteWeekLocks();
    res.status(200).json(weeks);
  } catch (error) {
    console.error("Error fetching incomplete week locks:", error);
    res.status(500).json({ error: "Failed to fetch incomplete week locks." });
  }
}

async function completeWeekLock(req, res) {
  const { league, season, week } = req.body;
  try {
    const updated = await db.completeWeekLock(league, season, week);
    res.status(200).json(updated);
  } catch (error) {
    console.error("Error completing week:", error);
    res.status(500).json({ error: "Failed to complete the week." });
  }
}

async function findCurrentWeek(req, res) {
  try {
    const allWeekLocks = await db.findAllWeekLocksOrdered();
    const now = new Date();

    const leaguesPerWeek = new Map();
    const weekCompletionMap = new Map();

    for (const entry of allWeekLocks) {
      const { week, completed, lockTime } = entry;
      if (!leaguesPerWeek.has(week)) leaguesPerWeek.set(week, []);
      leaguesPerWeek.get(week).push(entry);

      if (!weekCompletionMap.has(week)) weekCompletionMap.set(week, []);
      weekCompletionMap.get(week).push(completed);
    }

    const allWeeks = [...leaguesPerWeek.keys()].sort((a, b) => a - b);
    const totalWeeks = allWeeks.length;

    let currentWeek;
    for (const week of allWeeks) {
      const entries = leaguesPerWeek.get(week);
      const lockedCount = entries.filter(e => e.lockTime <= now).length;
      if (lockedCount < entries.length) {
        currentWeek = week;
        break;
      }
    }
    if (currentWeek === undefined) currentWeek = allWeeks[allWeeks.length - 1];

    let completedWeeks = 0;
    for (const week of allWeeks) {
      const completions = weekCompletionMap.get(week);
      if (completions.every(c => c !== "no")) completedWeeks++;
    }

    res.json({
      firstWeek: allWeeks[0],
      currentWeek,
      totalWeeks,
      completedWeeks,
    });
  } catch (error) {
    console.error("Error in findCurrentWeek:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getCompletedWeeks(req, res) {
  try {
    const weeks = await db.findCompletedWeekLocks();
    res.status(200).json(weeks);
  } catch (error) {
    console.error("Error fetching completed week locks:", error);
    res.status(500).json({ error: "Failed to fetch completed week locks." });
  }
}

async function findCompletedLeagues(req, res) {
  const week = parseInt(req.params.week);
  if (isNaN(week)) return res.status(400).json({ error: "Invalid week number" });

  try {
    const completedWeeks = await db.findCompletedLeaguesByWeek(week);
    res.json(completedWeeks);
  } catch (err) {
    console.error("Error fetching completed weeks:", err);
    res.status(500).json({ error: "Failed to fetch completed weeks" });
  }
}

// Matches / Matchups 
async function findMatchupsForWeek(req, res) {
  const week = parseInt(req.params.week);
  if (isNaN(week)) return res.status(400).json({ error: "Invalid week number" });

  try {
    const matchups = await db.findMatchupsByWeek(week);
    res.json(matchups);
  } catch (error) {
    console.error('Error fetching matchups for week', week, error);
    res.status(500).json({ error: 'Error fetching matchups' });
  }
}

// WeekScores 
async function submitWeekScore(req, res) {
  try {
    const { week, game1, game2, game3, average, playerId, opponent, lanes, myTeam } = req.body;

    const newScore = await db.createWeekScore(
      week, game1, game2, game3, average, playerId, opponent, lanes, myTeam
    );

    res.status(200).json(newScore);
  } catch (err) {
    console.error("Failed to insert WeekScore:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

async function findWeekScoresForWeek(req, res) {
  const week = parseInt(req.params.week);
  if (isNaN(week)) return res.status(400).json({ error: "Invalid week number" });

  try {
    const scores = await db.findWeekScoresByWeek(week);
    res.json(scores);
  } catch (error) {
    console.error("Error fetching week scores:", error);
    res.status(500).json({ error: "Failed to fetch scores for the week" });
  }
}

async function getWeeks(req, res) {
  try {
    const weeks = await db.getAllWeekScores();
    res.json(weeks);
  } catch (error) {
    console.error("Error fetching week scores:", error);
    res.status(500).json({ error: "Failed to fetch week scores." });
  }
}

module.exports = {
  completeWeekLock, 
  findCompletedLeagues, 
  findCurrentWeek,  
  findMatchupsForWeek, 
  findWeekScoresForWeek, 
  getCompletedWeeks, 
  getIncompleteWeeklocks, 
  getWeeks,  
  submitWeekScore, 
};