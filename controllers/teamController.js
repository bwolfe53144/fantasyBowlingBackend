const db = require("../db/teamQueries");
  
// Team CRUD Operations (Create, Read, Update)
async function createTeam(req, res) {
    const { teamName, userId } = req.body;
    try {
      await db.createTeam(teamName, userId);
      res.status(200).json({ message: "Team created successfully!" });
    } catch (error) {
      console.error("Error creating team:", error);
      res.status(500).json({ error: "An error occurred while creating the team." });
    }
  }
  
  async function getTeams(req, res) {
    try {
      const teams = await db.getTeams();
      res.json(teams);
    } catch (error) {
      console.error("Error fetching teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  }
  
  async function getTeamsForHome(req, res) {
    try {
      const teams = await db.getTeamsForHome();
      teams.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.pointsFor - a.pointsFor;
      });
      res.json(teams);
    } catch (error) {
      console.error("Error fetching home teams:", error);
      res.status(500).json({ error: "Failed to fetch teams" });
    }
  }
  
  async function getTeam(req, res) {
    const { name } = req.params;
    try {
      const team = await db.getTeam(name);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Error fetching team:", error);
      res.status(500).json({ error: "Failed to fetch team" });
    }
  }
  
  async function getTeamById(req, res) {
    const { teamId } = req.params;
    try {
      const team = await db.getTeamById(teamId);
      if (!team) {
        return res.status(404).json({ error: "Team not found" });
      }
      res.json(team);
    } catch (error) {
      console.error("Error fetching team by ID:", error);
      res.status(500).json({ error: "Server error" });
    }
  }
  
  async function updateTeam(req, res) {
    const { id } = req.params;
    const { wins, losses, ties, points, streak, pointsAgainst } = req.body;
  
    try {
      const updatedTeam = await db.updateTeamById(id, {
        wins,
        losses,
        ties,
        points,
        streak,
        pointsAgainst,
      });
  
      res.json(updatedTeam);
    } catch (error) {
      console.error("Error updating team:", error);
      res.status(500).json({ error: "Failed to update team" });
    }
  }  

  // Team and Player Interaction
  async function getTeamPlayers(req, res) {
    const { teamName } = req.params;  
    try {
      const players = await db.getTeamPlayers(teamName);
      res.json({ teamName, players });
    } catch (error) {
      console.error("Error fetching team players:", error);
      res.status(500).json({ error: "Failed to fetch team players" });
    }
  }
  
  async function getFantasyTeamPlayers(req, res) {
    const { teamName } = req.params;
  
    try {
      const result = await db.getFantasyTeamPlayers(teamName);
      if (!result) {
        return res.status(404).json({ error: "Team not found" });
      }
  
      res.json(result);
    } catch (error) {
      console.error("Error fetching team players:", error);
      res.status(500).json({ error: "Failed to fetch team players" });
    }
  }  

  //Roster Lock Status 
  async function checkLockStatus(req, res) {
    const teamId = req.params.teamId;
    const week = parseInt(req.params.week);
  
    try {
      const lockedPlayerIds = await db.getLockedPlayerIds(teamId, week);
      res.json({ lockedPlayerIds });
    } catch (error) {
      console.error("Error getting locked player IDs:", error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  module.exports = {
    createTeam, 
    getTeams, 
    getTeamsForHome, 
    getTeam, 
    getTeamById, 
    updateTeam, 
    getTeamPlayers, 
    getFantasyTeamPlayers, 
    checkLockStatus,
  };

