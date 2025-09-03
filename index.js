require("dotenv").config();

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

// Import services and routes
const socketService = require("./services/socketService");
const { syncData, scheduleDailyReset } = require("./services/dataService");
const apiRoutes = require("./routes/api");
const statsRoutes = require("./routes/stats");
const { router: webhookRoutes, setReady } = require("./routes/webhook");

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const server = require("http").createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

// Initialize Socket Service
const { emitStats, addChatMessage } = socketService(io);

// Store socket functions in app for access in routes
app.set('io', io);
app.set('emitStats', emitStats);
app.set('addChatMessage', addChatMessage);

// Routes
app.use("/api", apiRoutes);
app.use("/stats", statsRoutes);
app.use("/", webhookRoutes);

// Static files
app.use(express.static("public"));

// Basic routes
app.get("/ping", (req, res) => res.send("🏓 PING OK!"));
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

// Initialize server
(async () => {
  try {
    // Wait for MongoDB connection
    await require("./config/database").mongoose.connection.once('open', async () => {
      const { User } = require("./config/database");
      
      // Drop old email index if exists
      try {
        await User.collection.dropIndex('email_1');
        console.log('✅ Old email_1 index dropped successfully.');
      } catch (error) {
        if (error.codeName !== 'IndexNotFound') {
          console.error('❌ Failed to drop old index:', error);
        } else {
          console.log('🔍 Old email_1 index not found, no action needed.');
        }
      }

      // Create data directory if not exists
      const dataDir = path.join(__dirname, "data");
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Create default files if they don't exist
      const today = new Date().toLocaleDateString();
      const files = [
        { 
          path: path.join(dataDir, "stats.json"), 
          content: { totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today } 
        },
        { 
          path: path.join(dataDir, "welcomed_users.json"), 
          content: [] 
        },
        { 
          path: path.join(dataDir, "funrules.json"), 
          content: { rules: [] } 
        },
        { 
          path: path.join(dataDir, "variables.json"), 
          content: [] 
        }
      ];

      files.forEach(file => {
        if (!fs.existsSync(file.path)) {
          fs.writeFileSync(file.path, JSON.stringify(file.content, null, 2));
        }
      });

      // Sync data and setup
      const success = await syncData(emitStats);
      if (success) {
        setReady(true);
        scheduleDailyReset();
        console.log('✅ Server initialized and ready to handle requests.');
      }
    });
  } catch (error) {
    console.error('❌ Server initialization failed:', error);
  }
})();

// Start server
server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

// Self-ping functionality
let pinging = false;
setInterval(async () => {
  if (pinging) return;
  pinging = true;
  try {
    await axios.get(`${SERVER_URL}/ping`);
    console.log("🔁 Self-ping sent!");
  } catch (err) {
    console.log("❌ Ping failed:", err.message);
  }
  pinging = false;
}, 5 * 60 * 1000);
