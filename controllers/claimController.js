const db = require("../db/claimQueries");

async function pickDropPlayer(req, res) {
    const { claimPlayerId, dropPlayerId, userId } = req.body;
  
    try {
      const playerClaim = await db.findOrCreatePlayerClaim(claimPlayerId);
  
      const existingClaimant = await db.findClaimant(userId, playerClaim.id);
  
      if (existingClaimant) {
        return res.status(400).json({ error: "You have already claimed this player." });
      }
  
      await db.createClaimant(userId, playerClaim.id, dropPlayerId);
  
      res.status(200).json({ message: "Player claimed with drop selection!" });
    } catch (err) {
      console.error("pickDropPlayer error:", err);
      res.status(500).json({ error: "Server error when processing claim." });
    }
  }

async function viewAllClaims(req, res) {
    try {
      const allClaimedPlayers = await db.getAllClaims();
  
      const CLAIM_DURATION_HOURS = 48;
  
      const processedClaims = allClaimedPlayers.map((claim) => {
        const teams = claim.claimants
          .map(c => ({
            id: c.user.team?.id,
            name: c.user.team?.name,
          }))
          .filter(t => t.id);
  
        const createdAt = new Date(claim.createdAt);
        const expiresAt = new Date(createdAt.getTime() + CLAIM_DURATION_HOURS * 3600000);
        const now = new Date();
        const diff = expiresAt - now;
        const timeLeft = diff > 0
          ? `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m left`
          : "Expired";
  
        return {
          playerName: claim.player.name,
          playerId: claim.player.id,
          league: claim.player.league,
          teams,
          timeLeft,
        };
      });
  
      res.json({ allClaimedPlayers: processedClaims });
    } catch (error) {
      console.error("Error fetching claimed players:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

async function viewMyClaims(req, res) {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ error: "Unauthorized: User not authenticated" });
      }
  
      const myClaimedPlayers = await db.getClaimsByUserId(req.user.id);
  
      const CLAIM_DURATION_HOURS = 48;
  
      const processedClaims = myClaimedPlayers.map((claim) => {
        const teams = claim.claimants
          .map(c => ({
            id: c.user.team?.id,
            name: c.user.team?.name,
          }))
          .filter(t => t.id);
  
        const createdAt = new Date(claim.createdAt);
        const expiresAt = new Date(createdAt.getTime() + CLAIM_DURATION_HOURS * 3600000);
        const now = new Date();
        const diff = expiresAt - now;
        const timeLeft = diff > 0
          ? `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m left`
          : "Expired";
  
        return {
          playerName: claim.player.name,
          playerId: claim.player.id,
          league: claim.player.league,
          teams,
          timeLeft,
        };
      });
  
      res.json({ myClaimedPlayers: processedClaims });
    } catch (error) {
      console.error("Error fetching my claimed players:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  }

async function deleteClaim(req, res) {
  const { playerId } = req.params;
  const { userId } = req.body;

  try {
    const playerClaim = await db.getPlayerClaim(playerId);
    if (!playerClaim) {
      return res.status(404).json({ error: "PlayerClaim not found." });
    }

    await db.deleteClaimants(playerClaim.id, userId);
    const remainingClaimants = await db.countClaimants(playerClaim.id);

    if (remainingClaimants === 0) {
      await db.deletePlayerClaim(playerClaim.id);
    }

    res.status(200).json({ message: "Claim removed successfully." });
  } catch (error) {
    console.error("Error removing claim:", error);
    res.status(500).json({ error: "Failed to remove claim." });
  }
}

module.exports = {
  pickDropPlayer, 
  viewAllClaims, 
  viewMyClaims, 
  deleteClaim, 
};