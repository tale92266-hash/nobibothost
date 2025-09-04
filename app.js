// file: app.js

require("dotenv").config();
const express = require("express");
const path = require("path");
const axios = require("axios");
const { db } = require("./db");
const setupApiRoutes = require('./api');
const { getStats } = require('./core/state');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.env || `http://localhost:${PORT}`;
const server = require("http").createServer(app);

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

let isReady = false;

(async () => {
    await db.mongoose.connection.once('open', async () => {
        const dataDir = path.join(__dirname, "data");
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const files = [
            { path: path.join(dataDir, "stats.json"), content: { totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: new Date().toLocaleDateString() } },
            { path: path.join(dataDir, "welcomed_users.json"), content: [] },
            { path: path.join(dataDir, "funrules.json"), content: { rules: [] } },
            { path: path.join(dataDir, "variables.json"), content: [] },
            { path: path.join(dataDir, "owner_rules.json"), content: { rules: [] } },
            { path: path.join(dataDir, "owner_list.json"), content: [] },
            { path: path.join(dataDir, "ignored_override_users.json"), content: [] },
            { path: path.join(dataDir, "specific_override_users.json"), content: [] },
            { path: path.join(dataDir, "settings.json"), content: {
                preventRepeatingRule: { enabled: false, cooldown: 2 },
                isBotOnline: true,
                temporaryHide: {
                    enabled: false,
                    matchType: 'EXACT',
                    triggerText: 'nobi papa hide me',
                    unhideEnabled: true,
                    unhideTriggerText: 'nobi papa start',
                    unhideMatchType: 'EXACT',
                    hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
                    unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
                }
            }},
        ];

        files.forEach(file => { if (!fs.existsSync(file.path)) { fs.writeFileSync(file.path, JSON.stringify(file.content, null, 2)); } });

        try {
            await db.User.collection.dropIndex('email_1');
            console.log('✅ Old email_1 index dropped successfully.');
        } catch (error) {
            if (error.codeName !== 'IndexNotFound') { console.error('❌ Failed to drop old index:', error); } 
            else { console.log('🔍 Old email_1 index not found, no action needed.'); }
        }

        const settingsLoaded = await db.loadSettingsFromFiles();
        if (!settingsLoaded) {
            console.log('⚠️ Settings files not found. Restoring from MongoDB...');
            await db.restoreSettingsFromDb();
        }
        
        const isSynced = await db.syncData();
        if (isSynced) {
            isReady = true;
            console.log('✅ Server is ready to handle requests.');
        } else {
            console.error('❌ Server failed to sync data and cannot start.');
            process.exit(1);
        }
        db.scheduleDailyReset();
    });
})();

setupApiRoutes(app, server);

app.get("/ping", (req, res) => res.send("🏓 PING OK!"));
app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

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