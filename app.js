const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();
const { Pool } = require("pg");
const http = require("http");
const setupDraftServer = require("./draftServer"); 

const pool = new Pool({
  ssl: { rejectUnauthorized: false },
});

const lockSurvivorLineups = require("./jobs/lockSurvivorLineups.js");
const resolveExpiredClaims = require("./jobs/resolveClaims");
const indexRouter = require("./routes/indexRouter");

const app = express();

// --------------------- CORS SETUP ---------------------
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

app.options("*", cors());

// --------------------- EXPRESS SETUP ---------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/", indexRouter);

app.get("/", (req, res) => res.send("🤖 Backend is online"));

// --------------------- HTTP SERVER & SOCKET.IO ---------------------
const server = http.createServer(app);

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Make `io` accessible in controllers
app.set("io", io);

// Optional: log connections
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Pass `io` into draft server instead of creating another instance
setupDraftServer(server, app, io);

// --------------------- CRON JOBS ---------------------
cron.schedule("1 7 * * *", async () => {
  await resolveExpiredClaims();
});
cron.schedule("1 18 * * *", async () => {
  await lockSurvivorLineups();
});
cron.schedule("1 9 * * *", async () => {
  await lockSurvivorLineups();
});
cron.schedule("1 19 * * *", async () => {
  await lockSurvivorLineups();
});

// --------------------- START SERVER ---------------------
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));