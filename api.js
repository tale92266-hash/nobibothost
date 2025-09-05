// file: api.js

const express = require('express');
const { db } = require('./db');
const { convertNewlinesBeforeSave } = require('./core/utils');
const { 
    getRules, getOwnerRules, getVariables, getSettings, getIgnoredOverrideUsers,
    getSpecificOverrideUsers, getOwnerList, setIgnoredOverrideUsers, setSpecificOverrideUsers,
    setOwnerList, setSettings, getStats, getRecentChatMessages, setRecentChatMessages,
    getMessageHistory, setMessageHistory, getLastReplyTimes, setLastReplyTimes,
    getAutomationRules, setAutomationRules
} = require('./core/state');
const { processMessage } = require('./core/bot');
const { Server } = require("socket.io");
const { Server: HTTPServer } = require("http");

module.exports = (app, server, getIsReady) => {
    const io = new Server(server, { cors: { origin: "*" } });

    const MAX_CHAT_HISTORY = 10;
    
    const emitStats = () => {
        const stats = getStats();
        if (stats) {
            io.emit("statsUpdate", {
                totalUsers: stats.totalUsers.length,
                totalMsgs: stats.totalMsgs,
                todayUsers: stats.todayUsers.length,
                todayMsgs: stats.todayMsgs,
                nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
            });
        }
    };

    io.on('connection', (socket) => {
        console.log('⚡ New client connected');
        if (getRecentChatMessages().length > 0) {
            console.log(`📤 Sending ${getRecentChatMessages().length} chat messages to new client.`);
            socket.emit('chatHistory', getRecentChatMessages());
        }
    });

    app.get("/api/rules", async (req, res) => {
        try {
            const rules = await db.Rule.find({}).sort({ RULE_NUMBER: 1 });
            setRules(rules);
            res.json({ rules });
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch rules" });
        }
    });

    app.post("/api/rules/update", async (req, res) => {
        const { type, rule } = req.body;
        try {
            if (type === 'add' || type === 'edit') {
                const { RULE_NUMBER, ...ruleData } = rule;
                const newRule = await db.Rule.findOneAndUpdate(
                    { RULE_NUMBER },
                    { $set: ruleData },
                    { upsert: true, new: true }
                );
                await db.loadAllRules();
                res.json({ message: `Rule ${RULE_NUMBER} saved successfully!` });
            } else if (type === 'delete') {
                const { RULE_NUMBER } = rule;
                await db.Rule.deleteOne({ RULE_NUMBER });
                await db.Rule.updateMany({ RULE_NUMBER: { $gt: RULE_NUMBER } }, { $inc: { RULE_NUMBER: -1 } });
                await db.loadAllRules();
                res.json({ message: `Rule ${RULE_NUMBER} deleted successfully!` });
            } else {
                res.status(400).json({ error: "Invalid update type" });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || "Failed to save rule" });
        }
    });

    app.post('/api/rules/bulk-update', async (req, res) => {
        const updates = req.body;
        try {
            const operations = updates.map(update => ({
                updateOne: {
                    filter: { RULE_NUMBER: update.oldNumber },
                    update: { $set: { RULE_NUMBER: update.newNumber } }
                }
            }));
            await db.Rule.bulkWrite(operations);
            await db.loadAllRules();
            res.json({ message: "Rules reordered successfully!" });
        } catch (err) {
            console.error('Bulk update failed:', err);
            res.status(500).json({ error: 'Failed to reorder rules.' });
        }
    });

    // Owner Rules API Routes
    app.get("/api/owner-rules", async (req, res) => {
        try {
            const ownerRules = await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
            setOwnerRules(ownerRules);
            res.json({ rules: ownerRules });
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch owner rules" });
        }
    });

    app.post("/api/owner-rules/update", async (req, res) => {
        const { type, rule } = req.body;
        try {
            if (type === 'add' || type === 'edit') {
                const { RULE_NUMBER, ...ruleData } = rule;
                const newRule = await db.OwnerRule.findOneAndUpdate(
                    { RULE_NUMBER },
                    { $set: ruleData },
                    { upsert: true, new: true }
                );
                await db.loadAllOwnerRules();
                res.json({ message: `Owner Rule ${RULE_NUMBER} saved successfully!` });
            } else if (type === 'delete') {
                const { RULE_NUMBER } = rule;
                await db.OwnerRule.deleteOne({ RULE_NUMBER });
                await db.OwnerRule.updateMany({ RULE_NUMBER: { $gt: RULE_NUMBER } }, { $inc: { RULE_NUMBER: -1 } });
                await db.loadAllOwnerRules();
                res.json({ message: `Owner Rule ${RULE_NUMBER} deleted successfully!` });
            } else {
                res.status(400).json({ error: "Invalid update type" });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || "Failed to save owner rule" });
        }
    });

    // NEW: Automation Rules API Routes
    app.get("/api/automation-rules", async (req, res) => {
        try {
            const automationRules = await db.AutomationRule.find({}).sort({ RULE_NUMBER: 1 });
            setAutomationRules(automationRules);
            res.json({ rules: automationRules });
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch automation rules" });
        }
    });

    app.post("/api/automation-rules/update", async (req, res) => {
        const { type, rule } = req.body;
        try {
            if (type === 'add' || type === 'edit') {
                const { RULE_NUMBER, ...ruleData } = rule;
                const newRule = await db.AutomationRule.findOneAndUpdate(
                    { RULE_NUMBER },
                    { $set: ruleData },
                    { upsert: true, new: true }
                );
                await db.loadAllAutomationRules();
                res.json({ message: `Automation Rule ${RULE_NUMBER} saved successfully!` });
            } else if (type === 'delete') {
                const { RULE_NUMBER } = rule;
                await db.AutomationRule.deleteOne({ RULE_NUMBER });
                await db.AutomationRule.updateMany({ RULE_NUMBER: { $gt: RULE_NUMBER } }, { $inc: { RULE_NUMBER: -1 } });
                await db.loadAllAutomationRules();
                res.json({ message: `Automation Rule ${RULE_NUMBER} deleted successfully!` });
            } else {
                res.status(400).json({ error: "Invalid update type" });
            }
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || "Failed to save automation rule" });
        }
    });

    // Variables API Routes
    app.get("/api/variables", async (req, res) => {
        try {
            const variables = await db.Variable.find({});
            res.json({ variables });
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch variables" });
        }
    });

    app.post("/api/variables/update", async (req, res) => {
        const { type, variable, oldName } = req.body;
        try {
            if (type === 'add') {
                const newVar = new db.Variable(variable);
                await newVar.save();
                res.json({ message: "Variable added successfully!" });
            } else if (type === 'edit') {
                await db.Variable.findOneAndUpdate({ name: oldName }, { $set: { name: variable.name, value: variable.value } });
                res.json({ message: "Variable updated successfully!" });
            } else if (type === 'delete') {
                await db.Variable.findOneAndDelete({ name: variable.name });
                res.json({ message: "Variable deleted successfully!" });
            }
            await db.loadAllVariables();
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message || "Failed to update variable" });
        }
    });

    // Settings API Routes
    app.get("/api/settings", (req, res) => {
        res.json({ settings: getSettings() });
    });

    app.post('/api/bot/status', async (req, res) => {
        const { isOnline } = req.body;
        try {
            setSettings({ ...getSettings(), isBotOnline: isOnline });
            await db.saveSettings();
            res.json({ message: `Bot status updated to ${isOnline ? 'Online' : 'Offline'}` });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Failed to update bot status.' });
        }
    });

    app.post("/api/settings/ignored-override", async (req, res) => {
        const { users } = req.body;
        setIgnoredOverrideUsers(users);
        await db.saveIgnoredOverrideUsers();
        res.json({ message: "Ignored override list updated." });
    });

    app.post("/api/settings/specific-override", async (req, res) => {
        const { users } = req.body;
        setSpecificOverrideUsers(users);
        await db.saveSpecificOverrideUsers();
        res.json({ message: "Specific override list updated." });
    });

    app.post("/api/settings/prevent-repeating-rule", async (req, res) => {
        const { enabled, cooldown } = req.body;
        try {
            setSettings({ ...getSettings(), preventRepeatingRule: { enabled, cooldown } });
            await db.saveSettings();
            res.json({ message: "Repeating rule prevention settings saved successfully!" });
        } catch (err) {
            res.status(500).json({ error: 'Failed to save settings.' });
        }
    });

    app.post("/api/settings/temporary-hide", async (req, res) => {
        try {
            const payload = req.body;
            setSettings({ ...getSettings(), temporaryHide: payload });
            await db.saveSettings();
            res.json({ message: "Temporary hide settings updated successfully!" });
        } catch (err) {
            console.error('Failed to save temporary hide settings:', err);
            res.status(500).json({ error: 'Failed to save settings.' });
        }
    });

    app.get("/api/owners", async (req, res) => {
        try {
            res.json({ owners: getOwnerList() });
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch owners list." });
        }
    });

    app.post("/api/owners/update", async (req, res) => {
        const { owners } = req.body;
        try {
            setOwnerList(owners);
            await db.saveOwnersList();
            res.json({ message: "Owners list updated successfully!" });
        } catch (err) {
            res.status(500).json({ error: "Failed to update owners list." });
        }
    });

    app.post("/message", async (req, res) => {
        const isReady = getIsReady();
        if (!isReady) {
            console.log("⚠️ Server not ready. Rejecting message.");
            return res.status(503).json({ message: "Server is not ready yet. Please wait a moment." });
        }

        const { sessionId, sender, message, groupName, isGroup } = req.body;
        const { parsedSenderName, parsedGroupName, parsedGroup, parsedSender } = extractSenderNameAndContext(sender, groupName);

        const replyText = await processMessage(message, sessionId, sender, parsedSenderName, parsedGroupName, parsedGroup, parsedSender);
        
        const messageData = {
            sessionId: sessionId,
            senderName: parsedSenderName,
            groupName: isGroup ? groupName : null,
            userMessage: message,
            botReply: replyText,
            timestamp: new Date().toISOString()
        };

        let recentChatMessages = getRecentChatMessages();
        recentChatMessages.unshift(messageData);
        if (recentChatMessages.length > MAX_CHAT_HISTORY) { recentChatMessages = recentChatMessages.slice(0, MAX_CHAT_HISTORY); }
        setRecentChatMessages(recentChatMessages);

        console.log(`💬 Chat history updated. Total messages: ${getRecentChatMessages().length}`);

        io.emit('newMessage', messageData);
        emitStats();

        if (!replyText) return res.json({ replies: [] });
        res.json({ replies: [{ message: replyText }] });
    });

    app.get("/stats", async (req, res) => {
        try {
            const totalUsersCount = await db.User.countDocuments();
            res.json({
                totalUsers: totalUsersCount,
                totalMsgs: getStats().totalMsgs,
                todayUsers: getStats().todayUsers.length,
                todayMsgs: getStats().todayMsgs,
                nobiPapaHideMeCount: getStats().nobiPapaHideMeUsers.length
            });
        } catch (err) {
            console.error('Failed to fetch stats:', err);
            res.status(500).json({ error: "Failed to fetch stats" });
        }
    });
};
