require("dotenv").config(); 
const db = require("../db/adminQueries");
const nodemailer = require("nodemailer");


// Player Management
async function clearPlayers(req, res) {
  try {
    await db.clearAllPlayerTeams();
    res.status(200).json({ message: "All players have been removed from their teams." });
  } catch (error) {
    console.error("Error clearing players from teams:", error);
    res.status(500).json({ error: "Failed to clear players from teams." });
  }
}

async function removePlayer(req, res) {
  const { playerId } = req.params;

  if (!playerId) {
    return res.status(400).json({ error: "Missing playerId in request." });
  }

  try {
    const result = await db.removePlayerFromTeam(playerId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error removing player:", error);
    res.status(500).json({ error: error.message || "Failed to remove player from team." });
  }
}

async function assignPlayerToTeam(req, res) {
  const { playerId, teamId } = req.body;

  if (!playerId || !teamId) {
    return res.status(400).json({ error: "Missing playerId or teamId" });
  }

  try {
    const result = await db.assignPlayerToTeam(playerId, teamId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error assigning player to team:", error);
    res.status(500).json({ error: "Failed to assign player to team" });
  }
}

async function changePosition(req, res) {
  const { playerId } = req.params;
  let { position } = req.body;

  if (!playerId || position === undefined) {
    return res.status(400).json({ error: "Player ID and position are required" });
  }

  try {
    const updated = await db.updatePlayerPosition(playerId, String(position));
    res.status(200).json({ message: "Position updated", player: updated });
  } catch (error) {
    console.error("Change position error:", error);
    res.status(500).json({ error: "Failed to change position" });
  }
}

// Team Management
async function deleteTeam(req, res) {
  const { teamName } = req.params;

  if (!teamName) {
    return res.status(400).json({ error: "Team name is required" });
  }

  try {
    const deleted = await db.deleteTeamByName(teamName);
    res.status(200).json({ message: "Team deleted", team: deleted });
  } catch (error) {
    console.error("Delete team error:", error);
    res.status(500).json({ error: "Failed to delete team" });
  }
}

// Claims
async function adminProcessClaim(req, res) {
  const { playerId, teamId } = req.body;

  if (!playerId || !teamId) {
    return res.status(400).json({ error: "Missing playerId or teamId" });
  }

  try {
    const result = await db.processPlayerClaim(playerId, teamId);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error processing claim:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Transactions
async function deleteTransactions(req, res) {
  try {
    await db.clearPlayerTransactions();
    res.status(200).json({ message: 'All transactions cleared successfully' });
  } catch (error) {
    console.error('Error clearing transactions:', error);
    res.status(500).json({ error: 'Failed to clear transactions' });
  }
}

// Scores and Locks
async function clearWeekscores(req, res) {
  try {
    await db.clearWeekScores();
    res.status(200).json({ message: "All weekscores cleared successfully" });
  } catch (error) {
    console.error("Error clearing weekscores:", error);
    res.status(500).json({ error: "Failed to clear weekscores" });
  }
}

async function submitLockTimes(req, res) {
  try {
    const lockTimes = req.body;
    const result = await db.setWeekLockTimes(lockTimes);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error saving lock times:", error);
    res.status(500).json({ error: "Failed to save lock times." });
  }
}

// Schedule
async function generateSchedule(req, res) {
  try {
    const { weeks, season, skipWeeks = [] } = req.body;
    const result = await db.generateSeasonSchedule(weeks, season, skipWeeks);
    res.status(200).json(result);
  } catch (error) {
    console.error("Error generating schedule:", error);
    res.status(500).json({ error: "Failed to generate schedule." });
  }
}

// User Role Management
async function changeRole(req, res) {
  const { userId, role } = req.body;

  if (!userId || !role) {
    return res.status(400).json({ error: "Missing userId or role" });
  }

  try {
    const updatedUser = await db.changeUserRole(userId, role);
    res.status(200).json({ message: "Role updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function sendStatsEmail(req, res) {
  try {
    const users = await db.getEmailSubscribedUsers();

    if (users.length === 0) {
      return res.status(200).json({ message: "No users subscribed to email updates." });
    }

    const transporter = nodemailer.createTransport({
      service: "yahoo",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: `"Fantasy Bowling League" <${process.env.SMTP_USER}>`,
      subject: "Fantasy Bowling Stats Updated",
      text: "Stats for fantasy bowling have been updated. Check your team and see how you did!",
    };

    for (const user of users) {
      await transporter.sendMail({
        ...mailOptions,
        to: user.email,
      });
    }

    res.status(200).json({ message: `Emails sent to ${users.length} users.` });
  } catch (error) {
    console.error("Error sending stats emails:", error);
    res.status(500).json({ error: "Failed to send stats update emails." });
  }
}

module.exports = {
  clearPlayers, 
  removePlayer, 
  assignPlayerToTeam, 
  changePosition, 
  deleteTeam, 
  adminProcessClaim, 
  deleteTransactions, 
  clearWeekscores, 
  submitLockTimes, 
  generateSchedule, 
  changeRole, 
  sendStatsEmail,
};