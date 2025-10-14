const db = require("../db/playerQueries");
  
async function getPlayers(req, res) {
    try {
      const players = await db.getAllPlayers();
      res.status(200).json(players);
    } catch (error) {
      console.error("Error fetching players:", error);
      res.status(500).json({ error: "Failed to fetch players." });
    }
  }
  
  async function getUnassignedPlayers(req, res) {
    try {
      const players = await db.getUnassignedPlayers();
      res.status(200).json(players);
    } catch (error) {
      console.error("Error fetching unassigned players:", error);
      res.status(500).json({ error: "Failed to fetch unassigned players." });
    }
  }

  async function addPlayer(req, res) {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
  
    try {
      const { name, league, teamId, position } = req.body;
  
      if (!name || !league || !position) {
        return res.status(400).json({ error: "Missing required fields." });
      }
  
      const newPlayer = await db.createPlayer(name, league, teamId || null, position);
      res.status(200).json(newPlayer);
    } catch (error) {
      console.error("Failed to insert player:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

  async function dropMyPlayer(req, res) {
    const { playerId, teamId } = req.params;
  
    try {
      const { unlockedWeeks } = await db.getUnlockedWeeks();
  
      await db.dropPlayer(playerId, teamId);
      await db.clearPlayerRosters(playerId, teamId, unlockedWeeks);
  
      req.app.get("io").emit("statsUpdated", { message: "Player dropped and rosters updated" });
  
      res.json({ success: true });
    } catch (err) {
      console.error("Error in dropMyPlayer:", err);
      res.status(500).json({ error: "Failed to drop player" });
    }
  }
  
  async function getPlayerStats(req, res) {
    const playerName = req.params.fullname;
    try {
      const players = await db.getPlayerWithStatsByName(playerName);
  
      const allScores = players.flatMap((p) =>
        p.weekScores.map((score) => ({
          ...score,
          league: p.league,
        }))
      );
  
      const leagues = [...new Set(players.map((p) => p.league))];
  
      const playerStatsTableFormat = players.map((p) => ({
        name: p.name,
        league: p.league,
        position: p.position,
        lyAverage: p.lyAverage,
        id: p.id,
        team: p.team || null,
        weekScores: p.weekScores.map((score) => ({
          ...score,
          league: p.league,
        })),
        playerRank: p.playerRank || null,
        badges: p.badges || [],
        tradePlayers: p.tradePlayers || [], // <-- add this
      }));
  
      res.json({
        name: playerName,
        leagues,
        weekScores: allScores,
        players: playerStatsTableFormat,
      });
    } catch (error) {
      console.error("Error fetching player stats:", error);
      res.status(500).json({ error: "Failed to fetch player data" });
    }
  }
  
  module.exports = {
    getPlayers, 
    getUnassignedPlayers, 
    addPlayer,
    dropMyPlayer, 
    getPlayerStats, 
  };