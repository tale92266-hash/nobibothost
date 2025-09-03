// file: index.js

require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { Server } = require("socket.io");
const { connectDB, Rule, Variable, User, Stats } = require("./db");
const { convertNewlinesBeforeSave, extractSenderNameAndContext } = require("./utils");
const {
    syncData,
    saveStats,
    saveIgnoredOverrideUsers,
    saveSpecificOverrideUsers,
    saveSettings,
    stats,
    isReady,
    RULES,
    VARIABLES,
    IGNORED_OVERRIDE_USERS,
    SPECIFIC_OVERRIDE_USERS,
    settings,
    loadAllRules,
    loadAllVariables,
    emitStats
} = require("./dataManager");
const { processMessage } = require("./messageProcessor");

const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const server = require("http").createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

let recentChatMessages = [];
const MAX_CHAT_HISTORY = 10;
const today = new Date().toLocaleDateString();

const resetDailyStats = async () => {
    stats.todayUsers = [];
    stats.todayMsgs = 0;
    stats.lastResetDate = new Date().toLocaleDateString();
    await Stats.findByIdAndUpdate(stats._id, stats);
    await saveStats();
};

const scheduleDailyReset = () => {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setDate(now.getDate() + 1);
    midnight.setHours(0, 0, 0, 0);
    const timeUntilMidnight = midnight.getTime() - now.getTime();

    setTimeout(() => {
        resetDailyStats();
        setInterval(resetDailyStats, 24 * 60 * 60 * 1000);
    }, timeUntilMidnight);
};

io.on('connection', (socket) => {
    console.log('⚡ New client connected');
    if (recentChatMessages.length > 0) {
        console.log(`📤 Sending ${recentChatMessages.length} recent messages to new client`);
        socket.emit('chatHistory', recentChatMessages);
    }
    socket.on('disconnect', () => {
        console.log('❌ Client disconnected');
    });
});

(async () => {
    await connectDB();
    const dataDir = path.join(__dirname, "data");
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    await syncData(io);
    
    server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));
    
    scheduleDailyReset();
    
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
})();

app.post("/api/settings/ignored-override", async (req, res) => {
    try {
        const { users } = req.body;
        IGNORED_OVERRIDE_USERS = users.split(',').map(userString => {
            const [name, context] = userString.split(':').map(s => s.trim());
            return { name, context: context || 'DM' };
        }).filter(item => item.name);
        await saveIgnoredOverrideUsers();
        res.json({ success: true, message: "Ignored override users updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update ignored override users:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/settings/specific-override", async (req, res) => {
    try {
        const { users } = req.body;
        SPECIFIC_OVERRIDE_USERS = users.split(',').map(u => u.trim()).filter(Boolean);
        await saveSpecificOverrideUsers();
        res.json({ success: true, message: "Specific override users updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update specific override users:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/api/settings", async (req, res) => {
    try {
        const settingsData = {
            preventRepeatingRule: settings.preventRepeatingRule,
            isBotOnline: settings.isBotOnline,
            temporaryHide: settings.temporaryHide,
            ignoredOverrideUsers: IGNORED_OVERRIDE_USERS,
            specificOverrideUsers: SPECIFIC_OVERRIDE_USERS
        };
        res.json(settingsData);
    } catch (error) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/settings/prevent-repeating-rule", async (req, res) => {
    try {
        const { enabled, cooldown } = req.body;
        settings.preventRepeatingRule.enabled = enabled;
        settings.preventRepeatingRule.cooldown = cooldown;
        await saveSettings();
        res.json({ success: true, message: "Repeating rule setting updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update repeating rule setting:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/settings/temporary-hide", async (req, res) => {
    try {
        const { enabled, matchType, triggerText, unhideEnabled, unhideTriggerText, unhideMatchType, hideReply, unhideReply } = req.body;
        settings.temporaryHide.enabled = enabled;
        settings.temporaryHide.matchType = matchType;
        settings.temporaryHide.triggerText = triggerText;
        settings.temporaryHide.unhideEnabled = unhideEnabled;
        settings.temporaryHide.unhideTriggerText = unhideTriggerText;
        settings.temporaryHide.unhideMatchType = unhideMatchType;
        settings.temporaryHide.hideReply = hideReply;
        settings.temporaryHide.unhideReply = unhideReply;
        await saveSettings();
        res.json({ success: true, message: "Temporary hide setting updated successfully." });
    } catch (error) {
        console.error("❌ Failed to update temporary hide setting:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/bot/status", async (req, res) => {
    try {
        const { isOnline } = req.body;
        settings.isBotOnline = isOnline;
        await saveSettings();
        res.json({ success: true, message: `Bot status updated to ${isOnline ? 'online' : 'offline'}.` });
        console.log(`🤖 Bot status has been set to ${isOnline ? 'online' : 'offline'}.`);
    } catch (error) {
        console.error("❌ Failed to update bot status:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/api/rules/bulk-update", async (req, res) => {
    const session = await mongoose.startSession();
    try {
        await session.withTransaction(async () => {
            const { rules } = req.body;
            if (!Array.isArray(rules) || rules.length === 0) {
                throw new Error('Invalid rules data - must be an array');
            }
            const tempBulkOps = rules.map((rule, index) => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(rule._id) },
                    update: { $set: { RULE_NUMBER: -(index + 1000) } },
                    upsert: false
                }
            }));
            if (tempBulkOps.length > 0) {
                await Rule.bulkWrite(tempBulkOps, { session, ordered: true });
            }
            const finalBulkOps = rules.map(rule => ({
                updateOne: {
                    filter: { _id: new mongoose.Types.ObjectId(rule._id) },
                    update: {
                        $set: {
                            RULE_NUMBER: rule.RULE_NUMBER,
                            RULE_NAME: rule.RULE_NAME || '',
                            RULE_TYPE: rule.RULE_TYPE,
                            KEYWORDS: rule.KEYWORDS || '',
                            REPLIES_TYPE: rule.REPLIES_TYPE,
                            REPLY_TEXT: convertNewlinesBeforeSave(rule.REPLY_TEXT || ''),
                            TARGET_USERS: rule.TARGET_USERS || 'ALL'
                        }
                    },
                    upsert: false
                }
            }));
            if (finalBulkOps.length > 0) {
                const finalResult = await Rule.bulkWrite(finalBulkOps, { session, ordered: true });
                if (finalResult.modifiedCount !== rules.length) {
                    throw new Error(`Expected ${rules.length} updates, but only ${finalResult.modifiedCount} succeeded`);
                }
            }
        });
        await session.endSession();
        await loadAllRules();
        const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
        const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
        fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
        res.json({
            success: true,
            message: `${req.body.rules.length} rules reordered successfully`,
            updatedCount: req.body.rules.length,
            totalCount: req.body.rules.length
        });
        io.emit('rulesUpdated', {
            action: 'bulk_reorder_atomic',
            count: req.body.rules.length,
            newOrder: RULES.map(r => ({ id: r._id, number: r.RULE_NUMBER, name: r.RULE_NAME }))
        });
    } catch (error) {
        console.error('❌ Atomic bulk update failed:', error);
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        await session.endSession();
        res.json({
            success: false,
            message: 'Failed to reorder rules atomically: ' + error.message
        });
    }
});

app.get("/api/rules", async (req, res) => {
    try {
        const rules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
        res.json(rules);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch rules" });
    }
});

app.post("/api/rules/update", async (req, res) => {
    const { type, rule, oldRuleNumber } = req.body;
    try {
        const session = await mongoose.startSession();
        await session.startTransaction();
        try {
            if (type === "add") {
                await Rule.updateMany(
                    { RULE_NUMBER: { $gte: rule.ruleNumber } },
                    { $inc: { RULE_NUMBER: 1 } },
                    { session }
                );
                await Rule.create([{
                    RULE_NUMBER: rule.ruleNumber,
                    RULE_NAME: rule.ruleName,
                    RULE_TYPE: rule.ruleType,
                    KEYWORDS: rule.keywords,
                    REPLIES_TYPE: rule.repliesType,
                    REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
                    TARGET_USERS: rule.targetUsers
                }], { session });
            } else if (type === "edit") {
                if (rule.ruleNumber !== oldRuleNumber) {
                    const startRuleNumber = Math.min(rule.ruleNumber, oldRuleNumber);
                    const endRuleNumber = Math.max(rule.ruleNumber, oldRuleNumber);
                    if (rule.ruleNumber < oldRuleNumber) {
                        await Rule.updateMany(
                            { RULE_NUMBER: { $gte: startRuleNumber, $lt: endRuleNumber } },
                            { $inc: { RULE_NUMBER: 1 } },
                            { session }
                        );
                    } else {
                        await Rule.updateMany(
                            { RULE_NUMBER: { $gt: startRuleNumber, $lte: endRuleNumber } },
                            { $inc: { RULE_NUMBER: -1 } },
                            { session }
                        );
                    }
                    await Rule.findOneAndUpdate(
                        { RULE_NUMBER: oldRuleNumber },
                        { $set: { RULE_NUMBER: rule.ruleNumber } },
                        { session }
                    );
                }
                await Rule.findOneAndUpdate(
                    { RULE_NUMBER: rule.ruleNumber },
                    {
                        $set: {
                            RULE_NAME: rule.ruleName,
                            RULE_TYPE: rule.ruleType,
                            KEYWORDS: rule.keywords,
                            REPLIES_TYPE: rule.repliesType,
                            REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
                            TARGET_USERS: rule.TARGET_USERS
                        }
                    },
                    { new: true, session }
                );
            } else if (type === "delete") {
                await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
                await Rule.updateMany(
                    { RULE_NUMBER: { $gt: rule.ruleNumber } },
                    { $inc: { RULE_NUMBER: -1 } },
                    { session }
                );
            }
            await session.commitTransaction();
            session.endSession();
            const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
            const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
            fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
            await loadAllRules();
            res.json({ success: true, message: "Rule updated successfully!" });
            io.emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
        } catch (err) {
            await session.abortTransaction();
            session.endSession();
            console.error("❌ Failed to update rule:", err);
            res.status(500).json({ success: false, message: "Server error: " + err.message });
        }
    } catch (err) {
        console.error("❌ Failed to start session or transaction:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.get("/api/variables", async (req, res) => {
    try {
        const variables = await Variable.find({});
        res.json(variables);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch variables" });
    }
});

app.post("/api/variables/update", async (req, res) => {
    const { type, variable, oldName } = req.body;
    try {
        const processedVariable = {
            name: variable.name,
            value: convertNewlinesBeforeSave(variable.value)
        };
        if (type === "add") {
            await Variable.create(processedVariable);
        } else if (type === "edit") {
            await Variable.findOneAndUpdate({ name: oldName }, processedVariable, { new: true });
        } else if (type === "delete") {
            await Variable.deleteOne({ name: variable.name });
        }
        await loadAllVariables();
        const variablesFromDB = await Variable.find({});
        fs.writeFileSync(path.join(__dirname, "data", "variables.json"), JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));
        res.json({ success: true, message: "Variable updated successfully!" });
        io.emit('variablesUpdated', { action: type, variableName: variable.name });
    } catch (err) {
        console.error("❌ Failed to update variable:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

app.post("/webhook", async (req, res) => {
    if (!isReady) {
        console.warn('⚠️ Server not ready. Rejecting incoming webhook.');
        return res.status(503).send('Server is initializing. Please try again in a moment.');
    }
    const sessionId = req.body.session_id || "default_session";
    const msg = req.body.query?.message || "";
    const sender = req.body.query?.sender || "";
    const replyText = await processMessage(msg, sessionId, sender);

    const messageData = {
        sessionId: sessionId,
        senderName: extractSenderNameAndContext(sender).senderName,
        groupName: extractSenderNameAndContext(sender).isGroup ? extractSenderNameAndContext(sender).groupName : null,
        userMessage: msg,
        botReply: replyText,
        timestamp: new Date().toISOString()
    };
    recentChatMessages.unshift(messageData);
    if (recentChatMessages.length > MAX_CHAT_HISTORY) {
        recentChatMessages = recentChatMessages.slice(0, MAX_CHAT_HISTORY);
    }
    console.log(`💬 Chat history updated. Total messages: ${recentChatMessages.length}`);
    io.emit('newMessage', messageData);
    if (!replyText) return res.json({ replies: [] });
    res.json({ replies: [{ message: replyText }] });
});

app.get("/stats", async (req, res) => {
    try {
        const totalUsersCount = await User.countDocuments();
        res.json({
            totalUsers: totalUsersCount,
            totalMsgs: stats.totalMsgs,
            todayUsers: stats.todayUsers.length,
            todayMsgs: stats.todayMsgs,
            nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
        });
    } catch (err) {
        console.error('Failed to fetch stats:', err);
        res.status(500).json({ error: "Failed to fetch stats" });
    }
});

app.use(express.static("public"));

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