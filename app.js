const express = require("express");
const cors = require("cors");
const cron = require('node-cron');
require("dotenv").config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },  // needed when connected to Neon or Render
});

const resolveExpiredClaims = require('./jobs/resolveClaims');
const indexRouter = require("./routes/indexRouter");

const app = express();

app.get("/", (req, res) => res.send("🤖 Backend is online"));

app.get('/health-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error('DB health check failed:', err);
    res.status(500).json({ error: err.message });
  }
});

app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use("/", indexRouter);

cron.schedule('*/5 * * * *', async () => {
  console.log('Checking for expired claims...');
  await resolveExpiredClaims();
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));