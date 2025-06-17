const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  ssl: { rejectUnauthorized: false },
});

const resolveExpiredClaims = require("./jobs/resolveClaims");
const indexRouter = require("./routes/indexRouter");

const app = express();

// -- DEBUG: Log FRONTEND_URL to ensure it's being loaded --
console.log("🧭 FRONTEND_URL =", process.env.FRONTEND_URL);

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

// -- CORS with debugging --
app.use(cors({
  origin: (origin, callback) => {
    console.log("CORS check, origin =", origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ Allowing CORS for: ${origin}`);
      return callback(null, true);
    }
    console.warn(`❌ Blocking CORS for: ${origin}`);
    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// -- Pre-flight support --
app.options("*", cors());

// -- Basic health & DB -->
app.get("/", (req, res) => res.send("🤖 Backend is online"));
app.get("/health-db", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error("DB health check failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// -- JSON parsing and routes -->
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use("/", indexRouter);

// -- Periodic job -->
cron.schedule("*/5 * * * *", async () => {
  console.log("Checking for expired claims...");
  await resolveExpiredClaims();
});

// -- Start server -->
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));