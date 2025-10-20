const db = require("../db/survivorQueries");

async function createSurvivorTeam(req, res) {
  try {
    let { userId, league, teamName } = req.body;

    if (!userId || !league || !teamName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Normalize the team name: trim, collapse spaces, capitalize words
    teamName = teamName
      .trim()                 // remove leading/trailing spaces
      .replace(/\s+/g, ' ')   // collapse multiple spaces into one
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const newTeam = await db.createSurvivorTeamEntry(userId, league, teamName);

    res.status(201).json({ message: 'Survivor team created', team: newTeam });
  } catch (error) {
    console.error('Error creating survivor team:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

  async function getSurvivorEntries(req, res) {
    try {
      const { userId } = req.params;
  
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }
  
      const entries = await db.findSurvivorEntriesByUserId(userId);
  
      res.status(200).json(entries);
    } catch (error) {
      console.error("Error fetching survivor entries:", error);
      res.status(500).json({ error: "Failed to fetch survivor entries" });
    }
  }

  async function getSurvivorEntriesByLeague(req, res) {
    const { league } = req.params;
  
    try {
      const entries = await db.getSurvivorEntriesByLeague(league);
      res.status(200).json({ entries });
    } catch (error) {
      console.error("Error fetching survivor entries:", error);
      res.status(500).json({ message: "Failed to fetch survivor entries." });
    }
  }

  async function getSurvivorTeamPicks(req, res) {
    try {
      const { league, teamName } = req.params;  // Use camelCase 'teamName'
      const picks = await db.getSurvivorPicksForTeam(league, teamName);
      res.json({ picks });
    } catch (error) {
      console.error("Error fetching picks:", error);
      res.status(500).json({ error: "Failed to get team picks." });
    }
  }

  async function getEligibleSurvivorPlayers(req, res) {
    const { league, teamName } = req.params;
  
    try {
      const eligiblePlayers = await db.findEligibleSurvivorPlayers(league, teamName);
      res.json({ players: eligiblePlayers });
    } catch (error) {
      console.error("Error fetching eligible players:", error);
      if (error.message === "Survivor entry not found") {
        return res.status(404).json({ error: error.message });
      }
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async function submitSurvivorPicks(req, res) {
    const { league, teamName } = req.params;
    const { picks } = req.body;
  
    try {
      if (!Array.isArray(picks) || picks.length !== 5) {
        return res.status(400).json({ error: "Must provide exactly 5 picks" });
      }
  
      await db.submitFullSurvivorLineup(league, teamName, picks);
  
      res.status(200).json({ message: "Lineup submitted successfully" });
    } catch (error) {
      console.error("Error submitting lineup:", error);
      res.status(500).json({ error: error.message || "Internal server error" });
    }
  }

  async function getSurvivorUserPicks(req, res) {
    const { league, teamName } = req.params;
    const userId = req.query.userId; // Pass from frontend
  
    if (!userId) {
      return res.status(400).json({ error: "Missing userId" });
    }
  
    try {
      const entry = await db.getSurvivorEntryByLeagueAndTeam(league, teamName);
  
      if (!entry || entry.userId !== userId) {
        return res.status(403).json({ error: "Not authorized to view these picks" });
      }
  
      const picks = await db.getSurvivorUserPicksQuery(entry.id);
  
      res.json({ picks });
    } catch (error) {
      console.error("Error fetching user survivor picks:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async function completeSurvivorWeek(req, res) {
    const { league, week } = req.body;
  
    // Skip weeks 1 and 2
    if (week < 10) {
      console.log(`⏭ Skipping survivor completion for week ${week} (before week 6).`);
      return res.json({ success: true, message: "Survivor completion starts from week 3." });
    }
  
    const leagueCutoffs = {
      "SundayAM": 0.4,
      "Cheris Nite Out": 0.6,
      "Ren Faire": 0.3,
      "Beavers Latestarters": 0.3,
      "Andys Classic": 0.25,
      "Heyden Classic": 0.4,
    };
  
    const cutoffPercent = leagueCutoffs[league] || 0.4;
  
    try {
      const weekLock = await db.findWeekLock(league, week);
      if (!weekLock) return res.status(404).json({ error: "Week lock not found" });
  
      const entries = await db.getAliveEntries(league);
      if (entries.length === 0) {
        console.log(`ℹ️ No active survivor entries for ${league} week ${week}.`);
        return res.json({ success: true, message: "No active survivor entries for this league/week." });
      }
  
      const weekScores = await db.findWeekScoresByLeagueAndWeek(league, week);
      if (weekScores.length === 0) {
        console.log(`ℹ️ No scores found for ${league} week ${week}.`);
        return res.json({ success: true, message: "No scores found for this league/week." });
      }
  
      const scoresWithSeries = weekScores.map(ws => ({
        playerId: ws.playerId,
        series: (ws.game1 || 0) + (ws.game2 || 0) + (ws.game3 || 0),
      })).sort((a, b) => b.series - a.series);
  
      const numScores = scoresWithSeries.length;
      const numSurvive = Math.ceil(numScores * cutoffPercent);
      const cutoffSeries = scoresWithSeries[numSurvive - 1].series;
  
      console.log(`🏁 Cutoff series for ${league} week ${week}: ${cutoffSeries} (top ${cutoffPercent * 100}%)`);
  
      for (const entry of entries) {
        const weekLineup = await db.getWeekLineup(entry.id, week);
  
        let chosenPlayer = null;
        for (const playerLine of weekLineup) {
          const foundScore = scoresWithSeries.find(s => s.playerId === playerLine.playerId);
          if (foundScore) {
            chosenPlayer = { ...foundScore, playerId: playerLine.playerId };
            break;
          }
        }
  
        if (!chosenPlayer) {
          await db.markEliminated(entry.id, week);
          console.log(`💀 Eliminated ${entry.teamName}: no bowler bowled`);
        } else {
          // Add chosen player to used players for this team and week
          await db.addUsedPlayer(entry.id, week, chosenPlayer.playerId);
  
          // Immediately remove this player from this week's lineup so they can't be chosen again
          await db.removePlayerFromLineup(entry.id, chosenPlayer.playerId);
  
          if (chosenPlayer.series < cutoffSeries) {
            await db.markEliminated(entry.id, week);
            console.log(`💀 Eliminated ${entry.teamName}: score ${chosenPlayer.series} below cutoff`);
          } else {
            console.log(`✅ ${entry.teamName} survives with score ${chosenPlayer.series}`);
          }
        }
      }
  
      // After processing all teams, delete all week lineups for this league & week
      await db.deleteWeekLineups(league, week);
      console.log(`🧹 Cleared survivor week ${week} lineups for ${league}.`);
  
      console.log(`🎯 Survivor week ${week} for ${league} completed.`);
  
      // Check for winner
      await checkForSurvivorWinner(league);
  
      res.json({ success: true, message: `Survivor week ${week} completed for ${league}` });
    } catch (error) {
      console.error("❌ Error completing survivor week:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  async function checkForSurvivorWinner(league) {
    const entries = await db.getAliveEntries(league);
  
    if (entries.length === 1) {
      // Only one left: they win by default
      const winner = entries[0];
      await db.updateEntryWinnerStatus(winner.id, "winner");
      console.log(`🏆 Winner by default: ${winner.teamName}`);
      return winner;
    }
  
    if (entries.length === 0) {
      // Everyone eliminated, tiebreak logic
      const eliminatedEntries = await db.getEliminatedEntries(league);
  
      if (eliminatedEntries.length === 0) {
        console.log(`🤷 No entries at all.`);
        return null;
      }
  
      // Find most recent eliminated week
      const weeks = eliminatedEntries
        .map(e => e.eliminatedWeek)
        .filter(w => w !== null && w !== undefined);
  
      if (!weeks.length) {
        console.log(`⚠️ No eliminated weeks found.`);
        return null;
      }
  
      const lastWeek = Math.max(...weeks);
      const lastEntries = eliminatedEntries.filter(e => e.eliminatedWeek === lastWeek);
  
      if (lastEntries.length === 1) {
        await db.updateEntryWinnerStatus(lastEntries[0].id, "winner");
        console.log(`🏆 Winner by last surviving week: ${lastEntries[0].teamName}`);
        return lastEntries[0];
      }
  
      // Compare bowler score in last week
      let topScore = -1;
      let topEntries = [];
  
      for (const entry of lastEntries) {
        if (!entry || !entry.id) continue;
  
        const usedPlayer = await db.getUsedPlayer(entry.id, lastWeek);
        if (!usedPlayer || !usedPlayer.playerId) {
          console.log(`⚠️ Entry ${entry.teamName} has no used player for week ${lastWeek}`);
          continue;
        }
  
        const score = await db.getWeekScore(league, lastWeek, usedPlayer.playerId);
        if (!score) {
          console.log(`⚠️ No score found for player ${usedPlayer.playerId} in week ${lastWeek}`);
          continue;
        }
  
        if (score.series > topScore) {
          topScore = score.series;
          topEntries = [entry];
        } else if (score.series === topScore) {
          topEntries.push(entry);
        }
      }
  
      if (topEntries.length === 1) {
        await db.updateEntryWinnerStatus(topEntries[0].id, "winner");
        console.log(`🏆 Winner by highest bowler score in last week: ${topEntries[0].teamName}`);
        return topEntries[0];
      }
  
      // Compare total season score
      let highestTotal = -1;
      let totalTopEntries = [];
  
      for (const entry of topEntries) {
        if (!entry || !entry.id) continue;
  
        const usedPlayers = await db.getAllUsedPlayers(entry.id);
        let totalSeries = 0;
  
        for (const up of usedPlayers) {
          const weekScore = await db.getWeekScore(league, up.week, up.playerId);
          if (weekScore) totalSeries += weekScore.series;
        }
  
        if (totalSeries > highestTotal) {
          highestTotal = totalSeries;
          totalTopEntries = [entry];
        } else if (totalSeries === highestTotal) {
          totalTopEntries.push(entry);
        }
      }
  
      if (totalTopEntries.length === 1) {
        await db.updateEntryWinnerStatus(totalTopEntries[0].id, "winner");
        console.log(`🏆 Winner by total season score: ${totalTopEntries[0].teamName}`);
        return totalTopEntries[0];
      }
  
      // Fallback to random selection
      if (totalTopEntries.length > 1) {
        const randomWinner = totalTopEntries[Math.floor(Math.random() * totalTopEntries.length)];
        await db.updateEntryWinnerStatus(randomWinner.id, "winner");
        console.log(`🏆 Winner by random tiebreak: ${randomWinner.teamName}`);
        return randomWinner;
      }
  
      // Extra fallback: if no valid totalTopEntries, fallback to lastEntries
      if (lastEntries.length > 0) {
        const randomFallback = lastEntries[Math.floor(Math.random() * lastEntries.length)];
        await db.updateEntryWinnerStatus(randomFallback.id, "winner");
        console.log(`🏆 Winner by random fallback among last entries: ${randomFallback.teamName}`);
        return randomFallback;
      }
  
      // No entries left at all
      console.log("❌ No entries left to choose from. No winner declared.");
      return null;
    }
  
    console.log(`🟢 No winner yet, entries remaining: ${entries.length}`);
    return null;
  }

  async function resetSurvivorLeague(req, res) {
    const { league } = req.body;
  
    if (!league) {
      return res.status(400).json({ error: "League is required" });
    }
  
    try {
      await db.resetSurvivorLeagueData(league);
      res.json({ success: true, message: `Survivor league '${league}' reset successfully.` });
    } catch (error) {
      console.error("Error resetting survivor league:", error);
      res.status(500).json({ error: "Failed to reset survivor league." });
    }
  }

  module.exports = {
    createSurvivorTeam,
    getSurvivorEntries,
    getSurvivorEntriesByLeague,
    getSurvivorTeamPicks,
    getEligibleSurvivorPlayers,
    submitSurvivorPicks,
    getSurvivorUserPicks,
    completeSurvivorWeek,
    resetSurvivorLeague,
  };