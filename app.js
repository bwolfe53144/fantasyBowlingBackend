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

// Define allowed origins
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL, // Production domain from environment variable
].filter(Boolean); // Remove any falsy values

// CORS configuration
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
}));

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Main API routes
app.use("/", indexRouter);

// Periodic background job
cron.schedule("*/5 * * * *", async () => {
  console.log("Checking for expired claims...");
  await resolveExpiredClaims();
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));