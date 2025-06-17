const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const cloudinary = require('cloudinary').v2;

const prisma = new PrismaClient();

// User-related functions
async function updateUserColor(userId, color) {
  return await prisma.user.update({
    where: { id: userId },
    data: { color },
  });
}

async function getAllUsers() {
  return await prisma.user.findMany({
    select: {
      id: true,
      firstname: true,
      lastname: true,
      role: true,
    },
  });
}

async function getUserAvatar(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
}

async function saveUserAvatar(userId, avatarUrl) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
}

// Team-related functions
async function isTeamNameTaken(name, userId) {
  const existing = await prisma.team.findFirst({
    where: {
      name,
      NOT: { ownerId: userId },
    },
  });
  return !!existing;
}

async function updateTeamName(userId, newName) {
  const team = await prisma.team.findUnique({
    where: { ownerId: userId },
  });

  if (!team) return null;

  return await prisma.team.update({
    where: { id: team.id },
    data: { name: newName },
  });
}

// Transactions
async function getPaginatedTransactions(skip, take) {
  const [totalCount, transactions] = await Promise.all([
    prisma.playerTransaction.count(),
    prisma.playerTransaction.findMany({
      skip,
      take,
      orderBy: { timestamp: "desc" },
      include: {
        player: { select: { name: true } },
        team: { select: { name: true } },
      },
    }),
  ]);
  return { totalCount, transactions };
}

// Matchup-related
async function getMatchupById(id) {
  const matchup = await prisma.match.findUnique({
    where: { id },
    include: {
      team1: {
        include: {
          owner: {
            select: {
              avatarUrl: true,
              firstname: true,
              lastname: true,
              username: true,
            },
          },
          players: {
            include: {
              weekScores: true,
            },
          },
        },
      },
      team2: {
        include: {
          owner: {
            select: {
              avatarUrl: true,
              firstname: true,
              lastname: true,
              username: true,
            },
          },
          players: {
            include: {
              weekScores: true,
            },
          },
        },
      },
    },
  });

  return matchup;
}

// Avatar upload & Cloudinary
async function deleteOldAvatarIfNeeded(avatarUrl) {
  if (!avatarUrl || !avatarUrl.includes("cloudinary.com")) return;

  const matches = avatarUrl.match(/\/([^/]+)\/([^/.]+)\.(jpg|png|jpeg|webp)$/);
  if (matches) {
    const folder = matches[1];
    const filename = matches[2];
    return cloudinary.uploader.destroy(`${folder}/${filename}`);
  }
}

async function uploadToCloudinary(path, userId, isPerson) {
  const baseTransform = isPerson
    ? { crop: "thumb", gravity: "face", width: 100, height: 100, zoom: 0.8 }
    : { crop: "fill", width: 100, height: 100 };

  const result = await cloudinary.uploader.upload(path, {
    folder: "avatars",
    public_id: `user-${userId}`,
    transformation: [
      baseTransform,
      { quality: "auto", fetch_format: "auto" },
      { effect: "auto_color" },
    ],
  });

  return result.secure_url;
}

// Schedule & Lock statuses
async function getAllWeekLocks() {
  return await prisma.weekLock.findMany({
    orderBy: [
      { league: 'asc' },
      { week: 'asc' }
    ]
  });
}

async function getScheduleWithPlayoffWeek() {
  const schedule = await prisma.match.findMany({
    orderBy: [{ week: 'asc' }],
    include: {
      team1: true,
      team2: true,
    },
  });

  const matchesByWeek = schedule.reduce((acc, match) => {
    if (!acc[match.week]) acc[match.week] = [];
    acc[match.week].push(match);
    return acc;
  }, {});

  const playoffEntry = Object.entries(matchesByWeek).find(
    ([, matches]) => matches.length < 3
  );

  let playoffWeek;
  if (playoffEntry) {
    playoffWeek = parseInt(playoffEntry[0]);
  } else {
    const allWeeks = Object.keys(matchesByWeek).map(Number);
    const maxWeek = Math.max(...allWeeks);
    playoffWeek = maxWeek + 1;
  }

  return { schedule, playoffWeek };
}

async function getAllLockStatuses() {
  return await prisma.weekLock.findMany();
}

// Leagues
async function getAllLeaguesWithWeek10() {
  return await prisma.weekLock.findMany({
    where: { week: 10 },
    distinct: ['league'],
    select: { league: true },
  });
}

async function getTotalLeagues() {
  return await prisma.weekLock.findMany({
    distinct: ['league'],
    select: { league: true },
  });
}

// Recent matches for a team
async function getRecentMatchesForTeam(teamName, week) {
  const matches = await prisma.match.findMany({
    where: {
      OR: [
        { team1: { name: teamName } },
        { team2: { name: teamName } }
      ],
    },
    include: {
      team1: { select: { id: true, name: true } },
      team2: { select: { id: true, name: true } },
    },
  });

  const sortedMatches = matches.sort((a, b) => a.week - b.week);
  const targetIndex = sortedMatches.findIndex(m => m.week === Number(week));

  let start = Math.max(0, targetIndex - 2);
  let end = start + 5;
  if (end > sortedMatches.length) {
    end = sortedMatches.length;
    start = Math.max(0, end - 5);
  }

  return sortedMatches.slice(start, end);
}

async function getUserById(userId) {
  return prisma.user.findUnique({ where: { id: userId } });
}

async function updateUserEmailSubscription(userId, email, subscribe) {
  const data = {};

    if (email !== undefined) data.email = email;
    if (subscribe !== undefined) data.emailSubscribed = subscribe;

    return await prisma.user.update({
      where: { id: userId },
      data,
    });
  }

module.exports = {
  updateUserColor,
  getAllUsers,
  getUserAvatar,
  saveUserAvatar,
  isTeamNameTaken,
  updateTeamName,
  getPaginatedTransactions,
  getMatchupById,
  deleteOldAvatarIfNeeded,
  uploadToCloudinary,
  getAllWeekLocks,
  getScheduleWithPlayoffWeek,
  getAllLockStatuses,
  getAllLeaguesWithWeek10,
  getTotalLeagues,
  getRecentMatchesForTeam,
  getUserById, 
  updateUserEmailSubscription,
};