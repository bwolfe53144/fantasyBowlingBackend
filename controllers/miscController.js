const db = require("../db/miscQueries");
const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const axios = require('axios');
const { format } = require("date-fns");
const dateFnsTz = require("date-fns-tz");
const utcToZonedTime = dateFnsTz.utcToZonedTime;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAX_UPLOADS = 5;
const WINDOW_MINUTES = 30;
const userUploadTimestamps = {};

// User / Team Settings
async function updateColor(req, res) {
  const { userId, color } = req.body;
  if (!userId || !color) {
    return res.status(400).json({ message: "Missing userId or color" });
  }
  try {
    const updatedUser = await db.updateUserColor(userId, color);
    res.status(200).json({ message: "Color updated successfully", user: updatedUser });
  } catch (error) {
    console.error("Error updating color:", error);
    res.status(500).json({ message: "Failed to update color" });
  }
}

async function changeTeamName(req, res) {
  const { userId, newTeamName } = req.body;
  if (!userId || !newTeamName) {
    return res.status(400).json({ message: "Missing userId or newTeamName." });
  }
  try {
    const nameTaken = await db.isTeamNameTaken(newTeamName.trim(), userId);
    if (nameTaken) {
      return res.status(409).json({ message: "Team name already taken." });
    }
    const updatedTeam = await db.updateTeamName(userId, newTeamName.trim());
    if (!updatedTeam) {
      return res.status(404).json({ message: "Team not found for this user." });
    }
    res.status(200).json({
      message: "Team name updated successfully.",
      teamName: updatedTeam.name,
    });
  } catch (error) {
    console.error("Error updating team name:", error);
    res.status(500).json({ message: "Server error updating team name." });
  }
}

// User Info 
async function getUsers(req, res) {
  try {
    const users = await db.getAllUsers();
    const formattedUsers = users.map((user) => ({
      id: user.id,
      name: `${user.firstname} ${user.lastname}`,
      role: user.role,
    }));
    res.status(200).json(formattedUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

// Transactions
async function getTransactions(req, res) {
  const { page = 1, limit = 10 } = req.query;
  const pageNumber = parseInt(page, 10);
  const pageSize = parseInt(limit, 10);
  const skip = (pageNumber - 1) * pageSize;

  try {
    const { totalCount, transactions } = await db.getPaginatedTransactions(skip, pageSize);
    const totalPages = Math.ceil(totalCount / pageSize);

    const timeZone = "America/Chicago";

    const formatted = transactions.map((tx) => {
      const chicagoTime = tx.timestamp
        ? utcToZonedTime(tx.timestamp, "America/Chicago")
        : null;
    
      return {
        id: tx.id,
        playerName: tx.player?.name || "Unknown Player",
        teamName: tx.team?.name || "Unknown Team",
        action: tx.action,
        timestamp: tx.timestamp, // keep original UTC if needed
        timestampStr: chicagoTime ? format(chicagoTime, "yyyy-MM-dd h:mm a") : null,
      };
    });

    res.status(200).json({
      transactions: formatted,
      currentPage: pageNumber,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching paginated transactions:", error);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
}

// Matchups
async function getMatchups(req, res) {
  const { id } = req.params;
  try {
    const matchup = await db.getMatchupById(id);
    if (!matchup) {
      return res.status(404).json({ error: "Matchup not found" });
    }
    res.status(200).json(matchup);
  } catch (err) {
    console.error("Failed to fetch matchup:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Avatar Upload & Moderation
function isUserRateLimited(userId) {
  const now = Date.now();
  const windowStart = now - WINDOW_MINUTES * 60 * 1000;
  if (!userUploadTimestamps[userId]) {
    userUploadTimestamps[userId] = [];
  }
  userUploadTimestamps[userId] = userUploadTimestamps[userId].filter(ts => ts > windowStart);
  if (userUploadTimestamps[userId].length >= MAX_UPLOADS) {
    return true;
  }
  userUploadTimestamps[userId].push(now);
  return false;
}

async function uploadAvatar(req, res) {
  const userId = req.body.userId;
  const isPerson = req.body.isPerson === "true";

  if (!req.file || !req.file.path) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  if (isUserRateLimited(userId)) {
    return res.status(429).json({ message: "Upload limit reached. Try again later." });
  }

  try {
    const user = await db.getUserAvatar(userId);
    await db.deleteOldAvatarIfNeeded(user?.avatarUrl);

    const uploadedUrl = await db.uploadToCloudinary(req.file.path, userId, isPerson);

    const moderationResponse = await axios.get("https://api.sightengine.com/1.0/check.json", {
      params: {
        url: uploadedUrl,
        models: "nudity-2.1,weapon,recreational_drug,medical,offensive-2.0,scam,text-content,face-attributes,gore-2.0,text,qr-content,tobacco,genai,violence,self-harm",
        api_user: process.env.SIGHTENGINE_USER,
        api_secret: process.env.SIGHTENGINE_SECRET,
      },
    });

    const data = moderationResponse.data;
    const nudity = data?.nudity || {};
    const isSafe =
      (nudity.raw || 0) <= 0.2 &&
      (nudity.partial || 0) <= 0.2 &&
      (data?.offensive?.prob || 0) <= 0.2 &&
      (data?.weapon?.prob || 0) <= 0.2 &&
      (data?.gore?.prob || 0) <= 0.2 &&
      (data?.["self-harm"]?.prob || 0) <= 0.2;

    if (!isSafe) {
      await cloudinary.uploader.destroy(`avatars/user-${userId}`);
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: "Image rejected due to inappropriate content" });
    }

    await db.saveUserAvatar(userId, uploadedUrl);
    fs.unlink(req.file.path, () => {});
    return res.status(200).json({ avatarUrl: uploadedUrl });

  } catch (error) {
    console.error("Upload error:", error.response?.data || error.message);
    fs.unlink(req.file?.path || "", () => {});
    return res.status(500).json({
      message: "Error uploading avatar",
      error: error.message,
    });
  }
}

// Schedule & Lock Status 
async function getSchedule(req, res) {
  try {
    const { schedule, playoffWeek } = await db.getScheduleWithPlayoffWeek();
    res.json({ schedule, playoffWeek });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    res.status(500).json({ error: "Failed to load schedule" });
  }
}

async function getAllLockStatuses(req, res) {
  try {
    const lockStatuses = await db.getAllWeekLocks();
    res.json(lockStatuses);
  } catch (error) {
    console.error('Error fetching lock statuses:', error);
    res.status(500).json({ error: 'Failed to fetch lock statuses' });
  }
}

async function getAllLeagues(req, res) {
  try {
    const totalLeagues = await db.getTotalLeagues();
    res.json({ totalLeagues });
  } catch (err) {
    console.error("Error fetching leagues:", err);
    res.status(500).json({ error: "Failed to fetch all leagues" });
  }
}

const getRecentMatches = async (req, res) => {
  const { teamName, week } = req.params;
  try {
    const recentMatches = await db.getRecentMatchesForTeam(teamName, Number(week));
    res.status(200).json(recentMatches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch recent matches' });
  }
};

async function handleEmail(req, res) {
  try {
    const { userId, email, subscribe } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Validate email format if email is provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }

    // Fetch user by ID
    const user = await db.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update user email and subscription status
    const updatedUser = await db.updateUserEmailSubscription(userId, email, subscribe);

    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('handleEmail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

async function getOwner(req, res) {
  try {
    const { ownerName } = req.params;

    if (!ownerName) {
      return res.status(400).json({ error: "Missing owner name" });
    }

    const [firstname, ...lastParts] = ownerName.split(" ");
    const lastname = lastParts.join(" ");
    if (!firstname || !lastname) {
      return res.status(400).json({ error: "Invalid owner name format" });
    }

    const fullName = `${firstname} ${lastname}`;
    const user = await db.getUserByFullName(firstname, lastname);

    let team = null;
    let priorYearStandings = [];

    if (user) {
      team = await db.getTeamByOwnerId(user.id);
      priorYearStandings = await db.getPriorYearStandingsByCaptain(user.id, fullName);
    } else {
      // Only get standings that match captainName
      priorYearStandings = await db.getPriorYearStandingsByCaptain(null, fullName);
    }

    if (!team && priorYearStandings.length === 0) {
      return res.status(404).json({ error: "Owner not found" });
    }

    return res.json({
      user: {
        firstname,
        lastname,
        username: user?.username || null,
        avatarUrl: user?.avatarUrl || null,
        color: user?.color || null,
      },
      team,
      priorYearStandings,
    });

  } catch (error) {
    console.error("Error in getOwner:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

async function getAllOwners(req, res) {
  try {
    // 1. Load all users (for mapping to captainName)
    const users = await db.getAllUsersWithFullNames();

    // 2. Load all prior year standings
    const allStandings = await db.getAllPriorYearStandings(); // see function below

    // 3. Group prior year standings by captainName
    const standingsByCaptain = {};
    for (const s of allStandings) {
      if (!standingsByCaptain[s.captainName]) {
        standingsByCaptain[s.captainName] = [];
      }
      standingsByCaptain[s.captainName].push(s);
    }

    // 4. Build combined list
    const owners = await Promise.all(
      Object.entries(standingsByCaptain).map(async ([captainName, standings]) => {
        const [firstname, ...lastParts] = captainName.split(" ");
        const lastname = lastParts.join(" ");

        const user = users.find(
          (u) => u.firstname === firstname && u.lastname === lastname
        );

        const team = user ? await db.getTeamByOwnerId(user.id) : null;

        return {
          firstname,
          lastname,
          username: user?.username || null,
          avatarUrl: user?.avatarUrl || null,
          color: user?.color || null,
          team,
          priorYearStandings: standings,
        };
      })
    );

    // 5. Include current-year users who don't appear in prior years
    const missingCurrentUsers = await Promise.all(
      users.map(async (user) => {
        const fullName = `${user.firstname} ${user.lastname}`;
        const isIncluded = owners.some(
          (o) => `${o.firstname} ${o.lastname}` === fullName
        );
        if (isIncluded) return null;

        const team = await db.getTeamByOwnerId(user.id);
        if (!team) return null;

        return {
          firstname: user.firstname,
          lastname: user.lastname,
          username: user.username,
          avatarUrl: user.avatarUrl,
          color: user.color,
          team,
          priorYearStandings: [],
        };
      })
    );

    const finalOwners = [...owners, ...missingCurrentUsers.filter(Boolean)];

    return res.json(finalOwners);
  } catch (error) {
    console.error("Error in getAllOwners:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}

module.exports = {
  updateColor, 
  changeTeamName, 
  getUsers, 
  getTransactions, 
  getMatchups, 
  uploadAvatar, 
  getSchedule, 
  getAllLockStatuses, 
  getAllLeagues, 
  getRecentMatches, 
  handleEmail,
  getOwner,
  getAllOwners,
};