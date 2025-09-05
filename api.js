// file: api.js

const express = require('express');
const { db } = require('./db');
const { convertNewlinesBeforeSave } = require('./core/utils');
const { 
    getRules, getOwnerRules, getVariables, getSettings, getIgnoredOverrideUsers,
    getSpecificOverrideUsers, getOwnerList, setIgnoredOverrideUsers, setSpecificOverrideUsers,
    setOwnerList, setSettings, getStats, getRecentChatMessages, setRecentChatMessages,
    getMessageHistory, setMessageHistory, getLastReplyTimes, setLastReplyTimes
} = require('./core/state');
const { processMessage } = require('./core/bot');
const { Server } = require("socket.io");
const { Server: HTTPServer } = "http";

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
            console.log(`📤 Sending ${getRecentChatMessages().length} recent messages to new client`);
            socket.emit('chatHistory', getRecentChatMessages());
        }
        socket.on('disconnect', () => {
            console.log('❌ Client disconnected');
        });
    });

    app.get("/api/rules", async (req, res) => {
        try {
            const rules = await db.Rule.find({}).sort({ RULE_NUMBER: 1 });
            res.json(rules);
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch rules" });
        }
    });

    app.post("/api/rules/update", async (req, res) => {
        const { type, rule, oldRuleNumber } = req.body;
        const session = await db.mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                if (type === "add") {
                    await db.Rule.updateMany({ RULE_NUMBER: { $gte: rule.ruleNumber } }, { $inc: { RULE_NUMBER: 1 } }, { session });
                    await db.Rule.create([{
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
                            await db.Rule.updateMany({ RULE_NUMBER: { $gte: startRuleNumber, $lt: endRuleNumber } }, { $inc: { RULE_NUMBER: 1 } }, { session });
                        } else {
                            await db.Rule.updateMany({ RULE_NUMBER: { $gt: startRuleNumber, $lte: endRuleNumber } }, { $inc: { RULE_NUMBER: -1 } }, { session });
                        }
                    }
                    await db.Rule.findOneAndUpdate(
                        { RULE_NUMBER: oldRuleNumber },
                        { $set: { 
                            RULE_NUMBER: rule.ruleNumber,
                            RULE_NAME: rule.ruleName,
                            RULE_TYPE: rule.ruleType,
                            KEYWORDS: rule.keywords,
                            REPLIES_TYPE: rule.repliesType,
                            REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
                            TARGET_USERS: rule.TARGET_USERS
                        }},
                        { new: true, session }
                    );
                } else if (type === "delete") {
                    await db.Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
                    await db.Rule.updateMany({ RULE_NUMBER: { $gt: rule.ruleNumber } }, { $inc: { RULE_NUMBER: -1 } }, { session });
                }
            });
            await session.endSession();
            await db.loadAllRules();
            res.json({ success: true, message: "Rule updated successfully!" });
            io.emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
        } catch (err) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            console.error("❌ Failed to update rule:", err);
            res.status(500).json({ success: false, message: "Server error: " + err.message });
        }
    });

    app.post("/api/rules/bulk-update", async (req, res) => {
        const session = await db.mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const { rules } = req.body;
                if (!Array.isArray(rules) || rules.length === 0) {
                    throw new Error('Invalid rules data - must be an array');
                }

                const tempBulkOps = rules.map((rule, index) => ({
                    updateOne: {
                        filter: { _id: new db.mongoose.Types.ObjectId(rule._id) },
                        update: { $set: { RULE_NUMBER: -(index + 1000) } },
                        upsert: false
                    }
                }));

                if (tempBulkOps.length > 0) { await db.Rule.bulkWrite(tempBulkOps, { session, ordered: true }); }

                const finalBulkOps = rules.map(rule => ({
                    updateOne: {
                        filter: { _id: new db.mongoose.Types.ObjectId(rule._id) },
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
                    const finalResult = await db.Rule.bulkWrite(finalBulkOps, { session, ordered: true });
                    if (finalResult.modifiedCount !== rules.length) {
                        throw new Error(`Expected ${rules.length} updates, but only ${finalResult.modifiedCount} succeeded`);
                    }
                }
            });

            await session.endSession();
            await db.loadAllRules();
            res.json({
                success: true,
                message: `${req.body.rules.length} rules reordered successfully`,
                updatedCount: req.body.rules.length,
                totalCount: req.body.rules.length
            });
            io.emit('rulesUpdated', {
                action: 'bulk_reorder_atomic',
                count: req.body.rules.length,
                newOrder: getRules().map(r => ({ id: r._id, number: r.RULE_NUMBER, name: r.RULE_NAME }))
            });
        } catch (error) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            console.error('❌ Atomic bulk update failed:', error);
            res.status(500).json({ success: false, message: 'Failed to reorder rules atomically: ' + error.message });
        }
    });

    app.get("/api/variables", async (req, res) => {
        try {
            const variables = await db.Variable.find({});
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
            if (type === "add") { await db.Variable.create(processedVariable); } 
            else if (type === "edit") { await db.Variable.findOneAndUpdate({ name: oldName }, processedVariable, { new: true }); } 
            else if (type === "delete") { await db.Variable.deleteOne({ name: variable.name }); }
            await db.loadAllVariables();
            res.json({ success: true, message: "Variable updated successfully!" });
            io.emit('variablesUpdated', { action: type, variableName: variable.name });
        } catch (err) {
            console.error("❌ Failed to update variable:", err);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.post("/api/settings/ignored-override", async (req, res) => {
        try {
            const { users } = req.body;
            const updatedUsers = users.split(',').map(userString => {
                const [name, context] = userString.split(':').map(s => s.trim());
                return { name, context: context || 'DM' };
            }).filter(item => item.name);
            setIgnoredOverrideUsers(updatedUsers);
            await db.saveIgnoredOverrideUsers();
            res.json({ success: true, message: "Ignored override users updated successfully." });
        } catch (error) {
            console.error("❌ Failed to update ignored override users:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.post("/api/settings/specific-override", async (req, res) => {
        try {
            const { users } = req.body;
            const updatedUsers = users.split(',').map(u => u.trim()).filter(Boolean);
            setSpecificOverrideUsers(updatedUsers);
            await db.saveSpecificOverrideUsers();
            res.json({ success: true, message: "Specific override users updated successfully." });
        } catch (error) {
            console.error("❌ Failed to update specific override users:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.get("/api/settings", async (req, res) => {
        try {
            const settingsData = {
                preventRepeatingRule: getSettings().preventRepeatingRule,
                isBotOnline: getSettings().isBotOnline,
                temporaryHide: getSettings().temporaryHide,
                ignoredOverrideUsers: getIgnoredOverrideUsers(),
                specificOverrideUsers: getSpecificOverrideUsers()
            };
            res.json(settingsData);
        } catch (error) {
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.post("/api/settings/prevent-repeating-rule", async (req, res) => {
        try {
            const { enabled, cooldown } = req.body;
            setSettings({ ...getSettings(), preventRepeatingRule: { enabled, cooldown } });
            await db.saveSettings();
            res.json({ success: true, message: "Repeating rule setting updated successfully." });
        } catch (error) {
            console.error("❌ Failed to update repeating rule setting:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.post("/api/settings/temporary-hide", async (req, res) => {
        try {
            const { enabled, matchType, triggerText, unhideEnabled, unhideTriggerText, unhideMatchType, hideReply, unhideReply } = req.body;
            setSettings({ ...getSettings(), temporaryHide: { enabled, matchType, triggerText, unhideEnabled, unhideTriggerText, unhideMatchType, hideReply, unhideReply } });
            await db.saveSettings();
            res.json({ success: true, message: "Temporary hide setting updated successfully." });
        } catch (error) {
            console.error("❌ Failed to update temporary hide setting:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.post("/api/bot/status", async (req, res) => {
        try {
            const { isOnline } = req.body;
            const settings = getSettings();
            settings.isBotOnline = isOnline;
            setSettings(settings);
            await db.saveSettings();
            res.json({ 
                success: true, 
                message: `Bot status updated to ${isOnline ? 'online' : 'offline'}.`,
                settings: getSettings()
            });
            console.log(`🤖 Bot status has been set to ${isOnline ? 'online' : 'offline'}.`);
        } catch (error) {
            console.error("❌ Failed to update bot status:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.get("/api/owners", async (req, res) => {
        const owners = getOwnerList();
        res.json(owners);
    });

    app.post("/api/owners/update", async (req, res) => {
        try {
            const { owners } = req.body;
            setOwnerList(owners);
            await db.saveOwnersList();
            res.json({ success: true, message: "Owners list updated successfully." });
        } catch (error) {
            console.error("❌ Failed to update owners list:", error);
            res.status(500).json({ success: false, message: "Server error" });
        }
    });

    app.get("/api/owner-rules", async (req, res) => {
        try {
            const rules = await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
            res.json(rules);
        } catch (err) {
            res.status(500).json({ error: "Failed to fetch owner rules" });
        }
    });

    app.post("/api/owner-rules/update", async (req, res) => {
        const { type, rule, oldRuleNumber } = req.body;
        const session = await db.mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                if (type === "add") {
                    await db.OwnerRule.updateMany({ RULE_NUMBER: { $gte: rule.ruleNumber } }, { $inc: { RULE_NUMBER: 1 } }, { session });
                    await db.OwnerRule.create([{
                        RULE_NUMBER: rule.ruleNumber, RULE_NAME: rule.ruleName, RULE_TYPE: rule.ruleType,
                        KEYWORDS: rule.keywords, REPLIES_TYPE: rule.repliesType, REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText)
                    }], { session });
                } else if (type === "edit") {
                    if (rule.ruleNumber !== oldRuleNumber) {
                        const startRuleNumber = Math.min(rule.ruleNumber, oldRuleNumber);
                        const endRuleNumber = Math.max(rule.ruleNumber, oldRuleNumber);
                        if (rule.ruleNumber < oldRuleNumber) { await db.OwnerRule.updateMany({ RULE_NUMBER: { $gte: startRuleNumber, $lt: endRuleNumber } }, { $inc: { RULE_NUMBER: 1 } }, { session }); } 
                        else { await db.OwnerRule.updateMany({ RULE_NUMBER: { $gt: startRuleNumber, $lte: endRuleNumber } }, { $inc: { RULE_NUMBER: -1 } }, { session }); }
                    }
                    await db.OwnerRule.findOneAndUpdate(
                        { RULE_NUMBER: oldRuleNumber },
                        { $set: {
                            RULE_NUMBER: rule.ruleNumber, RULE_NAME: rule.ruleName, RULE_TYPE: rule.ruleType,
                            KEYWORDS: rule.keywords, REPLIES_TYPE: rule.repliesType, REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText)
                        }},
                        { new: true, session }
                    );
                } else if (type === "delete") {
                    await db.OwnerRule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
                    await db.OwnerRule.updateMany({ RULE_NUMBER: { $gt: rule.ruleNumber } }, { $inc: { RULE_NUMBER: -1 } }, { session });
                }
            });
            await session.endSession();
            await db.loadAllOwnerRules();
            await db.saveOwnerRules();
            res.json({ success: true, message: "Owner rule updated successfully!" });
            io.emit('ownerRulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
        } catch (err) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            console.error("❌ Failed to update owner rule:", err);
            res.status(500).json({ success: false, message: "Server error: " + err.message });
        }
    });

    app.post("/webhook", async (req, res) => {
        const { extractSenderNameAndContext } = require('./core/utils');

        if (!getIsReady()) {
            console.warn('⚠️ Server not ready. Rejecting incoming webhook.');
            return res.status(503).send('Server is initializing. Please try again in a moment.');
        }

        const sessionId = req.body.session_id || "default_session";
        const msg = req.body.query?.message || "";
        const sender = req.body.query?.sender || "";
        
        const { senderName: parsedSenderName, isGroup, groupName } = extractSenderNameAndContext(sender);

        if (!getSettings().isBotOnline) {
            console.log('🤖 Bot is offline. Skipping message processing.');
            return res.json({ replies: [] });
        }

        const isOwner = getOwnerList().includes(parsedSenderName);

        if (isOwner) {
            const replyText = await processMessage(msg, sessionId, sender);
            if (!replyText) return res.json({ replies: [] });
            return res.json({ replies: [{ message: replyText }] });
        }

        const replyText = await processMessage(msg, sessionId, sender);

        const messageData = {
            sessionId: sessionId,
            senderName: parsedSenderName,
            groupName: isGroup ? groupName : null,
            userMessage: msg,
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
