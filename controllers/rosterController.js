const db = require("../db/rosterQueries");

  
// Basic Roster CRUD Operations
async function changeRoster(req, res) {
    const { players, week, teamId } = req.body;
  
    try {
      const rosterEntries = players
        .filter(p => p.setPosition)
        .map(p => ({
          week,
          position: p.setPosition,
          playerId: p.playerId,
          teamId,
        }));
  
      await db.upsertRosterEntries(rosterEntries);
      res.status(200).json({ message: "Roster saved successfully!" });
    } catch (error) {
      console.error("Error submitting roster:", error);
      res.status(500).json({ error: "Failed to submit roster." });
    }
  }
  
  const changeMultipleRosters = async (req, res) => {
    const { rosters } = req.body;
    if (!Array.isArray(rosters)) {
      return res.status(400).json({ error: "Missing or invalid rosters array." });
    }
  
    try {
      // Find the latest week in the uploaded rosters
      const targetWeek = Math.max(...rosters.map(r => r.week));
      const latestRosters = rosters.filter(r => r.week === targetWeek);
  
      const updatedPlayerIds = new Set();
  
      for (const roster of latestRosters) {
        const { players, teamId, week } = roster;
        if (!players || !teamId || week === undefined) continue;
  
        // Fetch existing roster for this team/week
        const existingRoster = await db.getRosterForTeamAndWeek(teamId, week);
        const existingMap = new Map(existingRoster.map(p => [p.playerId, p.position]));
  
        const promises = [];
  
        // Upsert new or changed players
        for (const player of players) {
          const existingPosition = existingMap.get(player.playerId);
          if (!existingPosition || existingPosition !== player.position) {
            promises.push(
              db.upsertRosterEntries([{
                week,
                teamId,
                playerId: player.playerId,
                position: player.position,
              }])
            );
            updatedPlayerIds.add(player.playerId);
          }
        }
  
        // Remove players no longer in roster
        for (const existingPlayer of existingRoster) {
          if (!players.some(p => p.playerId === existingPlayer.playerId)) {
            promises.push(db.deleteRosterByPlayer(existingPlayer.playerId, teamId, week));
            updatedPlayerIds.add(existingPlayer.playerId);
          }
        }
  
        await Promise.all(promises);
      }
  
      // Emit only if there are updates
      if (updatedPlayerIds.size > 0) {
        req.app.get("io").emit("statsUpdated", {
          message: "Rosters updated",
          playerIds: Array.from(updatedPlayerIds),
        });
      }
  
      res.status(200).json({
        message: "Rosters updated successfully.",
        updated: updatedPlayerIds.size,
        week: targetWeek,
      });
  
    } catch (err) {
      console.error("Error updating rosters:", err);
      res.status(500).json({ error: "Failed to update rosters." });
    }
  };

  //Roster Generation & Position Assignment
  async function generateRoster(req, res) {
    const { teamId, week } = req.body;
  
    if (!teamId || typeof week !== 'number') {
      return res.status(400).json({ error: 'Missing teamId or week' });
    }
  
    try {
      const existingRoster = await db.findRosterByTeamAndWeek(teamId, week);
      if (existingRoster.length > 0) {
        return res.status(400).json({ error: 'Roster for this week already exists' });
      }
  
      const players = await db.findPlayersByTeam(teamId);
      if (players.length === 0) {
        return res.status(204).end();  
      }
  
      const corePositions = ['1', '2', '3', '4', '5'];
      const flexPositions = [
        'Flex', 'Flex Bench 1', 'Flex Bench 2', 'Flex Bench 3', 'Flex Bench 4',
        'Flex Bench 5', 'Flex Bench 6', 'Flex Bench 7', 'Flex Bench 8', 'Flex Bench 9',
      ];
  
      const shuffledPlayers = [...players].sort(() => 0.5 - Math.random());
      const assigned = new Map();
      const usedPlayerIds = new Set();
  
      for (const pos of corePositions) {
        const match = shuffledPlayers.find(p => p.position === pos && !usedPlayerIds.has(p.id));
        if (match) {
          assigned.set(match.id, pos);
          usedPlayerIds.add(match.id);
        }
      }
  
      for (const pos of corePositions) {
        if (![...assigned.values()].includes(pos)) {
          const fallback = shuffledPlayers.find(p => !usedPlayerIds.has(p.id));
          if (fallback) {
            assigned.set(fallback.id, pos);
            usedPlayerIds.add(fallback.id);
          }
        }
      }
  
      for (const pos of flexPositions) {
        const match = shuffledPlayers.find(p => !usedPlayerIds.has(p.id));
        if (match) {
          assigned.set(match.id, pos);
          usedPlayerIds.add(match.id);
        }
      }
  
      let benchCounter = 1;
      for (const p of shuffledPlayers) {
        if (!usedPlayerIds.has(p.id)) {
          const extraPos = `Extra Bench ${benchCounter++}`;
          assigned.set(p.id, extraPos);
          usedPlayerIds.add(p.id);
        }
      }
  
      const upsertEntries = [];
      for (const [playerId, position] of assigned.entries()) {
        upsertEntries.push({ week, playerId, teamId, position });
      }
  
      await db.upsertRosterEntries(upsertEntries);
      return res.status(200).json({ success: true, generated: assigned.size });
    } catch (err) {
      console.error('Error in generateRoster:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
  
  async function setPositions(req, res) {
    const { teamId, players } = req.body;
  
    if (!teamId || !players || players.length === 0) {
      return res.status(400).json({ error: "Invalid request data." });
    }
  
    try {
      const result = await db.setPlayerPositions(teamId, players);
  
      if (result.error) {
        return res.status(403).json({ error: result.error });
      }
  
      res.status(200).json(result);
    } catch (error) {
      console.error("Error during setPositions:", error);
      res.status(500).json({ error: "Internal server error." });
    }
  }

  // Reset Helpers
  async function resetRoster(req, res) {
    try {
      await db.deleteAllRosters();
      await db.resetTeamStats();
  
      res.status(200).json({ message: "Rosters and team stats reset" });
    } catch (err) {
      console.error("Failed to reset rosters and team stats:", err);
      res.status(500).json({ error: "Failed to reset rosters and team stats" });
    }
  }
  
  async function resetPosition(req, res) {
    try {
      await db.resetPlayerPositions();
      res.status(200).json({ message: "Positions reset" });
    } catch (err) {
      console.error("Failed to reset positions:", err);
      res.status(500).json({ error: "Failed to reset positions" });
    }
  }

  // Roster Validation & Checks
  const checkForRegular = async (req, res) => {
    const { teamId } = req.params;
  
    if (!teamId) {
      return res.status(400).json({ error: "Missing teamId." });
    }
  
    try {
      const allPlayers = await db.getPlayersByTeam(teamId);
      const rosterPlayers = allPlayers.filter(p => p.setPosition !== "");
  
      const hasRegular = rosterPlayers.length === allPlayers.length;
  
      res.json({
        hasRegular,
        roster: hasRegular ? rosterPlayers : [],
      });
    } catch (error) {
      console.error("Error checking for regular roster:", error);
      res.status(500).json({ error: "Server error while checking roster." });
    }
  };

  // Roster Fetching
  const getRoster = async (req, res) => {
    const { teamId, week } = req.params;
    const parsedWeek = parseInt(week);
  
    if (isNaN(parsedWeek) || !teamId) {
      return res.status(400).json({ error: "Invalid teamId or week." });
    }
  
    try {
      const roster = await db.getRosterForTeamAndWeek(teamId, parsedWeek);
      res.json(roster);
    } catch (error) {
      console.error("Error fetching roster:", error);
      res.status(500).json({ error: "Failed to fetch roster." });
    }
  };
  
  const getAllRosters = async (req, res) => {
    try {
      const rosters = await db.getAllRostersWithScores();
  
      const filteredRosters = rosters.map(roster => {
        const filteredPlayer = {
          ...roster.player,
          weekScores: roster.player.weekScores.filter(ws => ws.week === roster.week),
        };
  
        return {
          ...roster,
          player: filteredPlayer,
        };
      });
  
      res.status(200).json(filteredRosters);
    } catch (error) {
      console.error("Error fetching roster:", error);
      res.status(500).json({ error: "Failed to fetch roster." });
    }
  };
  
  const findRostersForTheWeek = async (req, res) => {
    const week = parseInt(req.params.week);
  
    if (isNaN(week)) {
      return res.status(400).json({ error: "Invalid week number" });
    }
  
    try {
      const rosters = await db.getRostersByWeek(week);
      res.json(rosters);
    } catch (err) {
      console.error("Error fetching rosters:", err);
      res.status(500).json({ error: "Failed to fetch rosters for the week" });
    }
  };

 async function getRostersWithScoresForTheWeek(req, res) {
    const week = parseInt(req.params.week, 10);
  
    if (isNaN(week)) {
      return res.status(400).json({ error: "Invalid week parameter" });
    }
  
    try {
      const rosters = await db.getRostersWithScoresForWeek(week);
      res.status(200).json(rosters);
    } catch (err) {
      console.error("Failed to fetch rosters with scores:", err);
      res.status(500).json({ error: "Failed to fetch rosters with scores" });
    }
  }

  module.exports = {
    changeRoster,  
    changeMultipleRosters, 
    generateRoster, 
    resetRoster, 
    resetPosition, 
    setPositions, 
    checkForRegular, 
    getRoster, 
    getAllRosters, 
    findRostersForTheWeek, 
    getRostersWithScoresForTheWeek,
  };
