const db = require("../db/claimQueries");

function getExpiresAtAt7AM_Min48Hours(createdAt) {
  const minExpires = new Date(createdAt.getTime() + 48 * 3600000); // add 48 hours
  const expires = new Date(minExpires);

  // Set time to 7:00 AM on that day
  expires.setHours(7, 0, 0, 0);

  // If setting to 7am made it earlier than minExpires, add 1 day
  if (expires < minExpires) {
    expires.setDate(expires.getDate() + 1);
  }

  return expires;
}

async function pickDropPlayer(req, res) {
  const { claimPlayerId, dropPlayerId, userId } = req.body;

  try {
    const now = new Date();
    const expiresAt = getExpiresAtAt7AM_Min48Hours(now);

    // Pass playerId and expiresAt to findOrCreatePlayerClaim
    const playerClaim = await db.findOrCreatePlayerClaim({
      playerId: claimPlayerId,
      expiresAt,
    });

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

  function getTimeLeft(expiresAt) {
    const now = new Date();
    const diff = new Date(expiresAt) - now;
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m left`;
  }
  
  async function viewAllClaims(req, res) {
    try {
      const allClaimedPlayers = await db.getAllClaims();
  
      const processedClaims = allClaimedPlayers.map((claim) => {
        const teams = claim.claimants
          .map(c => ({
            id: c.user.team?.id,
            name: c.user.team?.name,
          }))
          .filter(t => t.id);
  
        return {
          playerName: claim.player.name,
          playerId: claim.player.id,
          league: claim.player.league,
          teams,
          expiresAt: claim.expiresAt.toISOString(),
          timeLeft: getTimeLeft(claim.expiresAt),
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
  
      const processedClaims = myClaimedPlayers.map((claim) => {
        const teams = claim.claimants
          .map(c => ({
            id: c.user.team?.id,
            name: c.user.team?.name,
          }))
          .filter(t => t.id);
  
        return {
          playerName: claim.player.name,
          playerId: claim.player.id,
          league: claim.player.league,
          teams,
          expiresAt: claim.expiresAt.toISOString(),
          timeLeft: getTimeLeft(claim.expiresAt),
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