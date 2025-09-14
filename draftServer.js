const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function setupDraftServer(server, app, io) {
  const DEFAULT_TIMER = 5;
  const INACTIVE_TIMER = 2;

  const draftOrderBase = [
    { name: "Spare No One", skipRounds: [{ round: 15, position: "4", name: "Tina Beltran" }] },
    { name: "Bowling Stones", skipRounds: [{ round: 15, position: "1", name: "Jenn Jacoby" }] },
    { name: "Hell’s Kitchen", skipRounds: [{ round: 15, position: "2", name: "Ethan Najarro" }] },
    { name: "Training Wheels & Strikes", skipRounds: [{ round: 15, position: "1", name: "Yahaira Beltran" }] },
    /*{ name: "Lisa's Team", skipRounds: [{ round: 15, position: "5", name: "Lisa Brenneman" }] },*/
    { name: "Go Packers Go", skipRounds: [{ round: 15, position: "1", name: "Josh Clark" }] },
    { name: "Gutter Control", skipRounds: [] },
    { name: "The Rican Rollers", skipRounds: [] },
    { name: "Team Thomas", skipRounds: [{ round: 12, position: "2", name: "Thomas Bryant" }] },
    /*{ name: "Bergernation", skipRounds: [{ round: 11, position: "5", name: "Brad Berger" }] },*/
    { name: "Da Bears", skipRounds: [{ round: 11, position: "1", name: "Joel Oechler Jr" }] },
    { name: "Down And Dirty", skipRounds: [{ round: 9, position: "2", name: "Tyrone Wade" }] },
    { name: "The Wolf Pack", skipRounds: [{ round: 6, position: "2", name: "Brian Wolfe" }, { round: 7, position: "5", name: "Brian Wolfe" }] },
    /*{ name: "Scott's Team", skipRounds: [{ round: 6, position: "5", name: "Scott Stine" }] },*/
    { name: "Strikes Away", skipRounds: [{ round: 5, position: "5", name: "Darrell Sennholz" }] },
    { name: "Iconic Ink", skipRounds: [{ round: 4, position: "5", name: "William Dillon" }, { round: 6, position: "3", name: "William Dillon" }] },
    { name: "Rainmaker Fishing", skipRounds: [{ round: 5, position: "5", name: "Greg Sternbach" }] },
    { name: "My Drinking Team Has A Bowling Problem", skipRounds: [{ round: 4, position: "4", name: "Kevin Arriaga" }] },
    { name: "Dewbertz", skipRounds: [{ round: 4, position: "3", name: "Dustin Jacoby" }] },
    { name: "Pinsanity", skipRounds: [{ round: 3, position: "5", name: "Ben Barhyte" }] },
    /*{ name: "Shirts Off", skipRounds: [{ round: 3, position: "4", name: "Chris Graham" }] },*/
    { name: "My Imaginary Friends", skipRounds: [{ round: 1, position: "1", name: "Mike Tumeo" }, { round: 2, position: "5", name: "Mike Tumeo" }] },
    /*{ name: "Erik B's Team", skipRounds: [{ round: 2, position: "1", name: "Eric Brenneman" }] },*/
    { name: "Waddle You Doing Step Burrow", skipRounds: [{ round: 2, position: "5", name: "Zak Eidsor" }] },
    { name: "Poblo", skipRounds: [{ round: 1, position: "1", name: "Poblo" }, { round: 2, position: "4", name: "Poblo" }] },
  ];

  const EXCLUDED_AUTODRAFT_PLAYERS = ["Ty Wade", "Kendall Logan"];

  const totalRounds = 15;
  const draftOrder = [];

  for (let round = 1; round <= totalRounds; round++) {
    const roundTeams = round % 2 === 1 ? draftOrderBase : [...draftOrderBase].reverse();
    draftOrder.push(
      ...roundTeams.map(team => {
        const skipPick = team.skipRounds.find(s => s.round === round);
        return { ...team, round, skipPick: skipPick || null };
      })
    );
  }

  const fantasyLeagues = ["Andys Classic","Beavers Latestarters","Cheris Night Out","Ren Faire","Inner City","Sunday AM"];
  const MIN_GAMES_LAST_YEAR = 45;
  const MIN_GAMES_THIS_YEAR = 3;

  let draftState = {
    currentPickIndex: 0,
    draftedPlayers: [],
    inactiveTeams: new Set(),
    timer: DEFAULT_TIMER,
    allPlayers: [],
    teamCyclePositions: {},
    teamStatus: {}
  };

  // Initialize teamCyclePositions for skipped picks
  for (const pick of draftOrder) {
    if (pick.skipPick) {
      const teamName = pick.name;
      const cycle = Math.floor((pick.round - 1) / 5);
      if (!draftState.teamCyclePositions[teamName]) draftState.teamCyclePositions[teamName] = {};
      if (!draftState.teamCyclePositions[teamName][cycle]) draftState.teamCyclePositions[teamName][cycle] = new Set();
      draftState.teamCyclePositions[teamName][cycle].add(pick.skipPick.position);
    }
  }

  let draftStarted = false;
  let timerExpiresAt;

  // Set initial timer
  const firstPick = draftOrder[draftState.currentPickIndex];
  draftState.timer = firstPick && draftState.inactiveTeams.has(firstPick.name) ? INACTIVE_TIMER : DEFAULT_TIMER;
  timerExpiresAt = Date.now() + draftState.timer * 1000;

  function resetTimer() {
    const currentPick = draftOrder[draftState.currentPickIndex];
    if (!currentPick) return;
    draftState.timer = currentPick.skipPick
      ? 1
      : draftState.inactiveTeams.has(currentPick.name)
      ? INACTIVE_TIMER
      : DEFAULT_TIMER;

    timerExpiresAt = Date.now() + draftState.timer * 1000;
    io.emit("timerUpdate", draftState.timer);
  }

  function emitDraftUpdate() {
    io.emit("draftUpdate", { ...draftState, inactiveTeams: Array.from(draftState.inactiveTeams) });
  }

  function getPositionsDraftedThisCycle(teamName, round) {
    const cycle = Math.floor((round - 1) / 5);
    return Array.from(draftState.teamCyclePositions[teamName]?.[cycle] || []);
  }

  function markPositionDrafted(teamName, round, position) {
    const cycle = Math.floor((round - 1) / 5);
    if (!draftState.teamCyclePositions[teamName]) draftState.teamCyclePositions[teamName] = {};
    if (!draftState.teamCyclePositions[teamName][cycle]) draftState.teamCyclePositions[teamName][cycle] = new Set();
    draftState.teamCyclePositions[teamName][cycle].add(position);
  }

  // --------------------- REST ENDPOINTS ---------------------
  app.get("/api/draft", (req, res) => {
    res.json({
      currentPickIndex: draftState.currentPickIndex,
      draftedPlayers: draftState.draftedPlayers,
      inactiveTeams: Array.from(draftState.inactiveTeams),
      timer: draftState.timer,
      draftOrder,
    });
  });

  app.post("/api/draft/pick", (req, res) => {
    const { playerId, teamName, playerData } = req.body;
    const currentPick = draftOrder[draftState.currentPickIndex];
    if (!currentPick || draftState.currentPickIndex >= draftOrder.length) return res.status(400).json({ error: "Draft complete." });
    if (currentPick.name !== teamName) return res.status(400).json({ error: "Not your turn" });
    if (currentPick.skipPick) return res.status(400).json({ error: "This team skips this round." });
    if (draftState.draftedPlayers.some(p => p.playerId === playerId)) return res.status(400).json({ error: "Player already drafted" });

    draftState.draftedPlayers.push({ playerId, teamName, playerData, round: currentPick.round });
    markPositionDrafted(teamName, currentPick.round, playerData.position);
    draftState.currentPickIndex += 1;

    if (draftState.currentPickIndex >= draftOrder.length) io.emit("draftComplete", { message: "Draft finished." });

    resetTimer();
    emitDraftUpdate();
    res.json({ success: true });
  });

  // --------------------- SOCKET.IO ---------------------
  io.on("connection", (socket) => {
    // Send initial draft state
    socket.emit("draftUpdate", { ...draftState, inactiveTeams: Array.from(draftState.inactiveTeams) });
    socket.emit("timerUpdate", Math.max(0, Math.round((timerExpiresAt - Date.now()) / 1000)));

    socket.on("assignDraftedPlayersToTeams", async () => {
      try {
        for (const draft of draftState.draftedPlayers) {
          if (!draft.playerId) continue;
          const team = await prisma.team.findUnique({ where: { name: draft.teamName } });
          if (!team) continue;
          await prisma.player.update({ where: { id: draft.playerId }, data: { teamId: team.id } });
        }
        io.emit("draftAssigned", { message: "All drafted players assigned to their teams." });
      } catch (err) {
        console.error("Failed to assign drafted players:", err);
        socket.emit("error", { message: "Failed to assign drafted players." });
      }
    });

    socket.on("setAllPlayers", (players, ack) => {
      if (!Array.isArray(players)) players = [];
      draftState.allPlayers = players.map(p => ({
        id: p.id,
        name: p.name,
        league: p.league,
        position: p.position,
        lyAverage: Number(p.lyAverage ?? p.average ?? 0),
        lyGames: Number(p.lyGames ?? 0),
        games: Number(p.games ?? 0),
        teamId: p.teamId ?? null
      }));
      if (ack) ack({ ok: true, count: draftState.allPlayers.length });
    });

    socket.on("registerTeam", (teamName) => {
      socket.teamName = teamName;
      draftState.teamStatus[teamName] = true;
      io.emit("teamStatusUpdate", draftState.teamStatus);
    });

    socket.on("disconnect", () => {
      if (socket.teamName) {
        draftState.teamStatus[socket.teamName] = false;
        io.emit("teamStatusUpdate", draftState.teamStatus);
      }
    });

    socket.on("pickPlayer", ({ playerId, teamName, playerData }) => {
      manualPick(playerId, teamName, playerData);
    });

    socket.on("removeInactivity", ({ teamName }) => {
      if (!teamName) return;
      draftState.inactiveTeams.delete(teamName);
      resetTimer();
      emitDraftUpdate();
    });

    socket.on("requestAutoPick", () => autoPick());

    socket.on("startDraft", () => {
      draftState.currentPickIndex = 0;
      draftState.draftedPlayers = [];
      draftState.teamCyclePositions = {};
      draftStarted = true;

      // rebuild teamCyclePositions
      for (const pick of draftOrder) {
        if (pick.skipPick) {
          const teamName = pick.name;
          const cycle = Math.floor((pick.round - 1) / 5);
          if (!draftState.teamCyclePositions[teamName]) draftState.teamCyclePositions[teamName] = {};
          if (!draftState.teamCyclePositions[teamName][cycle]) draftState.teamCyclePositions[teamName][cycle] = new Set();
          draftState.teamCyclePositions[teamName][cycle].add(pick.skipPick.position);
        }
      }

      // Set initial timer
      const firstPick = draftOrder[draftState.currentPickIndex];
      draftState.timer = firstPick && draftState.inactiveTeams.has(firstPick.name) ? INACTIVE_TIMER : DEFAULT_TIMER;
      timerExpiresAt = Date.now() + draftState.timer * 1000;

      emitDraftUpdate();
      io.emit("draftStarted", { ...draftState, inactiveTeams: Array.from(draftState.inactiveTeams) });
    });
  });

  function manualPick(playerId, teamName, playerData) {
    const currentPick = draftOrder[draftState.currentPickIndex];
    if (!currentPick || draftState.currentPickIndex >= draftOrder.length) return;
    if (currentPick.name !== teamName) return;
    if (currentPick.skipPick) return;
    if (draftState.draftedPlayers.some(p => p.playerId === playerId)) return;

    draftState.draftedPlayers.push({ playerId, teamName, playerData, round: currentPick.round });
    markPositionDrafted(teamName, currentPick.round, playerData.position);
    draftState.currentPickIndex += 1;

    if (draftState.currentPickIndex >= draftOrder.length) io.emit("draftComplete", { message: "Draft finished." });

    resetTimer();
    emitDraftUpdate();
  }

  function autoPick() {
    if (!draftStarted || draftState.currentPickIndex >= draftOrder.length) return;

    const currentPick = draftOrder[draftState.currentPickIndex];

    if (currentPick.skipPick) {
      draftState.draftedPlayers.push({
        playerId: null,
        teamName: currentPick.name,
        playerData: { name: currentPick.skipPick.name, position: currentPick.skipPick.position },
        round: currentPick.round,
      });
      markPositionDrafted(currentPick.name, currentPick.round, currentPick.skipPick.position);
      draftState.currentPickIndex += 1;
      emitDraftUpdate();
      resetTimer();
      return;
    }

    const remaining = Math.round((timerExpiresAt - Date.now()) / 1000);
    if (remaining <= 0) draftState.inactiveTeams.add(currentPick.name);

    if (draftState.inactiveTeams.has(currentPick.name)) {
      const positionsDrafted = getPositionsDraftedThisCycle(currentPick.name, currentPick.round);
      const playerToPick = draftState.allPlayers
      .filter(p =>
        !draftState.draftedPlayers.some(d => d.playerId === p.id) &&
        !p.teamId &&
        fantasyLeagues.includes(p.league) &&
        p.position !== "flex" &&
        (p.lyGames >= MIN_GAMES_LAST_YEAR && (p.games ?? 0) >= MIN_GAMES_THIS_YEAR) &&
        !positionsDrafted.includes(p.position) &&
        !EXCLUDED_AUTODRAFT_PLAYERS.includes(p.name)   // 🚫 exclude these only in autodraft
      )
      .sort((a, b) => b.lyAverage - a.lyAverage)[0];

      if (playerToPick) {
        draftState.draftedPlayers.push({
          playerId: playerToPick.id,
          teamName: currentPick.name,
          playerData: playerToPick,
          round: currentPick.round,
        });
        markPositionDrafted(currentPick.name, currentPick.round, playerToPick.position);
      }
      draftState.currentPickIndex += 1;
    }

    if (draftState.currentPickIndex >= draftOrder.length) io.emit("draftComplete", { message: "Draft finished." });

    resetTimer();
    emitDraftUpdate();
  }

  setInterval(() => {
    if (!draftStarted || draftState.currentPickIndex >= draftOrder.length) return;
    const remaining = Math.round((timerExpiresAt - Date.now()) / 1000);
    if (remaining > 0) {
      io.emit("timerUpdate", remaining);
      return;
    }
    autoPick();
  }, 1000);

  return io;
}

module.exports = setupDraftServer;