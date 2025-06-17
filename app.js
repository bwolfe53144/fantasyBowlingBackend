const express = require("express");
const cors = require("cors");
const cron = require('node-cron');
require("dotenv").config();

const resolveExpiredClaims = require('./jobs/resolveClaims');
const indexRouter = require("./routes/indexRouter");

const app = express();

app.get("/", (req, res) => res.send("🤖 Backend is online"));

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