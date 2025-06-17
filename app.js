const express = require("express");
const cors = require("cors");
const cron = require('node-cron');
require("dotenv").config();

const resolveExpiredClaims = require('./jobs/resolveClaims');
const indexRouter = require("./routes/indexRouter"); // Import routes

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Use authentication routes
app.use("/", indexRouter);
 
cron.schedule('*/5 * * * *', async () => {
    console.log('Checking for expired claims...');
    await resolveExpiredClaims();
  });

app.listen(5000, () => console.log("Server running on port 5000"));