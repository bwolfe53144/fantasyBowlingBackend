const db = require("../db/playoffQueries");

async function generatePlayoffs(req, res) {
    const { remainingWeeks, week, season } = req.body;
  
    if (![0, 1, 2, 3].includes(remainingWeeks)) {
      return res.status(400).json({ error: "Invalid remainingWeeks value" });
    }
  
    try {
      const existingMatches = await db.getMatchesForWeek(week);
  
      if (existingMatches.length > 0) {
        return res
          .status(409)
          .json({ message: `Playoff matches already exist for Week ${week}.` });
      }
  
      if (remainingWeeks === 3) {
        await db.generatePlayoffRound1(week, season);
      } else if (remainingWeeks === 2) {
        await db.generatePlayoffRound2(week, season);
      } else if (remainingWeeks === 1) {
        await db.generatePlayoffFinal(week, season);
      } else if (remainingWeeks === 0) {
        await db.giveTrophies(week, season);
      }
  
      res.status(200).json({ message: `Playoff round for Week ${week} generated.` });
    } catch (err) {
      console.error("Failed to generate playoffs:", err);
      res.status(500).json({ error: "Error generating playoffs." });
    }
  }
  
  module.exports = { generatePlayoffs };