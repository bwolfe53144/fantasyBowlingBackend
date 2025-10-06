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

  async function getTeamRanks(req, res) {
    const { league, teamName } = req.params;
  
    try {
      const team = await db.getTeamRanks(teamName, league);
  
      // ✅ Instead of 404, return a normal response with rank: null
      if (!team || team.rank == null) {
        return res.json({ rank: null });
      }
  
      res.json({ rank: team.rank });
    } catch (error) {
      console.error("Error fetching team ranks:", error);
      res.status(500).json({ error: "Failed to fetch team ranks" });
    }
  }

  async function getPriorYears(req, res) {
    try {
      const years = await db.getDistinctPriorYears();
      const uniqueYears = years.map((y) => y.year);
      return res.status(200).json({ years: uniqueYears });
    } catch (error) {
      console.error("Error fetching prior years:", error);
      return res.status(500).json({ error: "Failed to fetch prior years" });
    }
  }

  async function getSpecificYear(req, res) {
    const { year } = req.params;
  
    if (!year || isNaN(parseInt(year))) {
      return res.status(400).json({ error: "Invalid or missing year parameter" });
    }
  
    try {
      const results = await db.getPriorYearStandingsByYear(parseInt(year));
      return res.status(200).json(results);
    } catch (err) {
      console.error("Error fetching prior standings:", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  }

  async function proposeTrade(req, res) {
    try {
      const { fromTeamId, toTeamId, offeredPlayerIds = [], requestedPlayerIds = [], dropPlayerIds = [] } = req.body;
  
      if (!offeredPlayerIds.length || !requestedPlayerIds.length) {
        return res.status(400).json({ error: "Must provide at least one offered and one requested player" });
      }
  
      // Fetch rosters
      const fromTeamRoster = await db.getTeamRoster(fromTeamId);
      const toTeamRoster = await db.getTeamRoster(toTeamId);
  
      // Validate offered players
      const invalidOffered = offeredPlayerIds.filter(pid => !fromTeamRoster.find(p => p.id === pid));
      if (invalidOffered.length) {
        return res.status(400).json({ error: "Some offered players do not belong to your team", invalidOffered });
      }
  
      // Validate requested players
      const invalidRequested = requestedPlayerIds.filter(pid => !toTeamRoster.find(p => p.id === pid));
      if (invalidRequested.length) {
        return res.status(400).json({ error: "Some requested players do not belong to the target team", invalidRequested });
      }
  
      // Ensure valid drop logic
      if (requestedPlayerIds.length > offeredPlayerIds.length && dropPlayerIds.length !== requestedPlayerIds.length - offeredPlayerIds.length) {
        return res.status(400).json({
          error: "Must select drop player(s) if requesting more players than offering",
        });
      }
  
      // ✅ Check for existing pending trade between these teams
      const existingTrade = await db.findPendingTrade(fromTeamId, toTeamId);
      if (existingTrade) {
        return res.status(400).json({
          error: "A pending trade already exists between these teams",
          tradeId: existingTrade.id,
        });
      }
  
      // ✅ Check if any offered/requested players are already in pending or accepted trades
      const allPlayerIds = [...offeredPlayerIds, ...requestedPlayerIds];
      const blockedPlayers = await db.getPlayersInAcceptedTrades(allPlayerIds);
      if (blockedPlayers.length > 0) {
        return res.status(400).json({
          error: "Some players are already involved in a trade",
          players: blockedPlayers.map(p => p.name),
        });
      }
  
      // 1️⃣ Create trade
      const trade = await db.createTrade({ fromTeamId, toTeamId });
  
      // 2️⃣ Add offered players
      await db.addTradePlayers(offeredPlayerIds.map(pid => ({
        tradeId: trade.id,
        playerId: pid,
        role: "OFFERED",
      })));
  
      // 3️⃣ Add requested players
      await db.addTradePlayers(requestedPlayerIds.map(pid => ({
        tradeId: trade.id,
        playerId: pid,
        role: "REQUESTED",
      })));
  
      // 4️⃣ Add drop players if provided
      if (dropPlayerIds.length) {
        await db.addTradeDrops(dropPlayerIds.map(pid => ({
          tradeId: trade.id,
          teamId: fromTeamId,
          playerId: pid,
        })));
      }
  
      return res.json({ success: true, tradeId: trade.id });
    } catch (err) {
      console.error("Error proposing trade:", err);
      return res.status(500).json({ error: "Failed to propose trade" });
    }
  }

  async function getTrades(req, res) {
    try {
      const trades = await db.getAllTrades();
      return res.json(trades);
    } catch (err) {
      console.error("Error fetching trades:", err);
      return res.status(500).json({ error: "Failed to fetch trades" });
    }
  }

  async function markTradeViewed(req, res) {
    const { id } = req.body; 
    try {
      await db.markTradeAsViewed(id);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Failed to mark trade viewed" });
    }
  }

  async function getTradeById(req, res) {
    const { id } = req.params;
  
    try {
      const trade = await db.getTradeById(id);
      if (!trade) {
        return res.status(404).json({ message: "Trade not found" });
      }
      res.json(trade);
    } catch (err) {
      console.error("Error fetching trade:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
  
  // Accept a trade by ID
  async function acceptTrade(req, res) {
    const { id } = req.params;
    const { dropPlayerId } = req.body; // optional
  
    try {
      // Pass dropPlayerId directly to the DB layer
      const updatedTrade = await db.acceptTrade(id, dropPlayerId);
  
      if (!updatedTrade) {
        return res.status(404).json({ message: "Trade not found or cannot be accepted" });
      }
  
      res.json({ message: "Trade accepted", trade: updatedTrade });
    } catch (err) {
      console.error("Error accepting trade:", err);
      res.status(500).json({ message: "Server error" });
    }
  }
  
  // Decline a trade by ID
  async function declineTrade(req, res) {
    const { id } = req.params;
  
    try {
      const updatedTrade = await db.declineTrade(id);
      if (!updatedTrade) {
        return res.status(404).json({ message: "Trade not found or cannot be declined" });
      }
      res.json({ message: "Trade declined", trade: updatedTrade });
    } catch (err) {
      console.error("Error declining trade:", err);
      res.status(500).json({ message: "Server error" });
    }
  }

  async function tradeVote(req, res) {
    try {
      const { tradeId, teamId, approved } = req.body;
  
      if (!tradeId || !teamId || typeof approved !== "boolean") {
        return res.status(400).json({ error: "Missing or invalid fields" });
      }
  
      // Cast or update vote
      const vote = await db.castTradeVote(tradeId, teamId, approved);
    
      return res.status(200).json({
        message: "Vote recorded successfully",
        vote,
      });
    } catch (err) {
      console.error("Error recording trade vote:", err);
      res.status(500).json({ error: "Failed to record trade vote" });
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
    getTeamRanks,
    getPriorYears,
    getSpecificYear,
    proposeTrade,
    getTrades,
    markTradeViewed,
    getTradeById,
    acceptTrade,
    declineTrade,
    tradeVote,
  };

