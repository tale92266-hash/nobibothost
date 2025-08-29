// server.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 10000;

// Paths
const dataFolder = path.join(__dirname, "data");
const statsFile = path.join(dataFolder, "stats.json");

// Ensure data folder exists
if (!fs.existsSync(dataFolder)) fs.mkdirSync(dataFolder);

// Load or init stats
let stats = { totalUsers: 0, todayUsers: 0, totalMsgs: 0, todayMsgs: 0, nobiPapaCount: 0, users: {} };
if (fs.existsSync(statsFile)) {
  try {
    stats = JSON.parse(fs.readFileSync(statsFile, "utf-8"));
  } catch {
    console.log("⚠️ Failed to parse stats file, initializing new stats");
  }
}

// Function to save stats
function saveStats() {
  fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
}

// Ping function
async function selfPing() {
  if (!process.env.SERVER_URL) return;
  try {
    await axios.get(process.env.SERVER_URL + "/ping");
    console.log("🔁 Self-ping sent!");
  } catch (err) {
    if (err.response && err.response.status === 429) {
      console.log("⚠️ Ping rate limit hit. Waiting for next interval.");
    } else {
      console.log("❌ Ping failed:", err.message);
    }
  }
}

// Ping every 15 minutes
setInterval(selfPing, 15 * 60 * 1000);

// Express routes
app.get("/ping", (req, res) => res.send("pong"));

app.get("/stats", (req, res) => {
  res.json(stats);
});

// Example message endpoint
app.get("/message", (req, res) => {
  const user = req.query.user || "unknown";
  const msg = req.query.msg || "";

  if (!stats.users[user]) {
    stats.users[user] = true;
    stats.totalUsers++;
    stats.todayUsers++;
  }

  stats.totalMsgs++;
  stats.todayMsgs++;

  if (msg.toLowerCase().includes("nobi papa hide me")) stats.nobiPapaCount++;

  saveStats();

  res.json({ reply: "Message received!" });
});

app.listen(PORT, () => {
  console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`);
  console.log(`⚡ Loaded stats from file`);
});