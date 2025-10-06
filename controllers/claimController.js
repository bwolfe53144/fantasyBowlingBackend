const db = require("../db/claimQueries");

// Helper to compute expiration time (7 AM min 48 hours)
function getExpiresAtAt7AM_Min48Hours(createdAt) {
  const minExpires = new Date(createdAt.getTime() + 48 * 3600000); // add 48 hours
  const expires = new Date(minExpires);

  // Set time to 7:00 AM
  expires.setHours(7, 0, 0, 0);

  // If 7AM is earlier than minExpires, add one day
  if (expires < minExpires) {
    expires.setDate(expires.getDate() + 1);
  }

  return expires;
}

// Utility to get time left
function getTimeLeft(expiresAt) {
  const now = new Date();
  const diff = new Date(expiresAt) - now;
  if (diff <= 0) return "Expired";
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${minutes}m left`;
}

// Claim a player with optional drop
async function pickDropPlayer(req, res) {
  const { claimPlayerId, dropPlayerId, userId } = req.body;

  if (!claimPlayerId || !userId) {
    return res.status(400).json({ error: "Missing required parameters." });
  }

  try {
    const now = new Date();
    const expiresAt = getExpiresAtAt7AM_Min48Hours(now);

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

// View all claimed players
async function viewAllClaims(req, res) {
  try {
    const allClaimedPlayers = await db.getAllClaims();

    const processedClaims = allClaimedPlayers.map((claim) => {
      const teams = (claim.claimants || [])
        .map(c => ({
          id: c.user?.team?.id,
          name: c.user?.team?.name,
        }))
        .filter(t => t.id);

      return {
        playerName: claim.player?.name || "Unknown",
        playerId: claim.player?.id || null,
        league: claim.player?.league || "Unknown",
        teams,
        expiresAt: claim.expiresAt?.toISOString() || null,
        timeLeft: claim.expiresAt ? getTimeLeft(claim.expiresAt) : "Expired",
      };
    });

    res.json({ allClaimedPlayers: processedClaims });
  } catch (error) {
    console.error("Error fetching claimed players:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// View claims for the logged-in user
async function viewMyClaims(req, res) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized: User not authenticated" });
    }

    const myClaimedPlayers = await db.getClaimsByUserId(req.user.id);

    const processedClaims = myClaimedPlayers.map((claim) => {
      const teams = (claim.claimants || [])
        .map(c => ({
          id: c.user?.team?.id,
          name: c.user?.team?.name,
        }))
        .filter(t => t.id);

      return {
        playerName: claim.player?.name || "Unknown",
        playerId: claim.player?.id || null,
        league: claim.player?.league || "Unknown",
        teams,
        expiresAt: claim.expiresAt?.toISOString() || null,
        timeLeft: claim.expiresAt ? getTimeLeft(claim.expiresAt) : "Expired",
      };
    });

    res.json({ myClaimedPlayers: processedClaims });
  } catch (error) {
    console.error("Error fetching my claimed players:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete a user's claim
async function deleteClaim(req, res) {
  const { playerId } = req.params;
  const { userId } = req.body;

  if (!playerId || !userId) {
    return res.status(400).json({ error: "Missing required parameters." });
  }

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
