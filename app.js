const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  ssl: { rejectUnauthorized: false },
});

const lockSurvivorLineups = require("./jobs/lockSurvivorLineups.js");
const resolveExpiredClaims = require("./jobs/resolveClaims");
const indexRouter = require("./routes/indexRouter");

const app = express();

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

app.get("/", (req, res) => res.send("🤖 Backend is online"));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/", indexRouter);

cron.schedule("*/5 * * * *", async () => {
  await resolveExpiredClaims();
});

cron.schedule('1 18 * * *', async () => {
  await lockSurvivorLineups();
});

cron.schedule('1 19 * * *', async () => {
  await lockSurvivorLineups();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(` Server running on port ${PORT}`));