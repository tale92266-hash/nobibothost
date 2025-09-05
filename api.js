// file: api.js

const { getRules, getOwnerRules, getAutomationRules, getVariables, getSettings, getIgnoredOverrideUsers, getSpecificOverrideUsers, getOwnerList } = require('./core/state');
const { db } = require('./db');
const { convertNewlinesBeforeSave } = require('./core/utils');
const { getStats } = require('./core/state');

module.exports = function setupApiRoutes(app, server, isReady) {
    const io = require('socket.io')(server, { cors: { origin: "*" } });

    app.get("/api/rules", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        const rules = getRules();
        res.status(200).json(rules);
    });

    app.post("/api/rules/update", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { type, rule, oldRuleNumber } = req.body;
            let result;
            if (type === 'add') {
                await db.Rule.deleteMany({ RULE_NUMBER: rule.ruleNumber });
                result = await db.Rule.create(rule);
                console.log(`✅ Rule ${rule.ruleNumber} added.`);
            } else if (type === 'edit') {
                if (rule.ruleNumber !== oldRuleNumber) {
                    await db.Rule.deleteOne({ RULE_NUMBER: oldRuleNumber });
                    await db.Rule.create(rule);
                    console.log(`✅ Rule ${oldRuleNumber} updated to ${rule.ruleNumber}.`);
                } else {
                    result = await db.Rule.findOneAndUpdate({ RULE_NUMBER: rule.ruleNumber }, rule, { new: true, upsert: true });
                    console.log(`✅ Rule ${rule.ruleNumber} updated.`);
                }
            } else if (type === 'delete') {
                await db.Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
                console.log(`❌ Rule ${rule.ruleNumber} deleted.`);
            }
            await db.loadAllRules();
            res.status(200).json({ success: true, message: `Rule ${rule.ruleNumber} has been ${type === 'delete' ? 'deleted' : 'saved'}.`, rule: result });
        } catch (error) {
            console.error('❌ Failed to save rule:', error);
            res.status(500).json({ success: false, message: "Failed to save rule: " + error.message });
        }
    });

    app.post("/api/rules/bulk-update", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const rules = req.body;
            await db.Rule.deleteMany({});
            await db.Rule.insertMany(rules);
            await db.loadAllRules();
            res.status(200).json({ success: true, message: "Rules bulk updated successfully." });
        } catch (error) {
            console.error('❌ Failed to bulk update rules:', error);
            res.status(500).json({ success: false, message: "Failed to bulk update rules: " + error.message });
        }
    });

    app.get("/api/variables", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        const variables = getVariables();
        res.status(200).json(variables);
    });

    app.post("/api/variables/update", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { type, variable, oldName } = req.body;
            let result;
            if (type === 'add') {
                result = await db.Variable.create(variable);
                console.log(`✅ Variable '${variable.name}' added.`);
            } else if (type === 'edit') {
                if (variable.name !== oldName) {
                    await db.Variable.deleteOne({ name: oldName });
                    await db.Variable.create(variable);
                    console.log(`✅ Variable '${oldName}' updated to '${variable.name}'.`);
                } else {
                    result = await db.Variable.findOneAndUpdate({ name: variable.name }, variable, { new: true, upsert: true });
                    console.log(`✅ Variable '${variable.name}' updated.`);
                }
            } else if (type === 'delete') {
                await db.Variable.deleteOne({ name: variable.name });
                console.log(`❌ Variable '${variable.name}' deleted.`);
            }
            await db.loadAllVariables();
            res.status(200).json({ success: true, message: `Variable '${variable.name}' has been ${type === 'delete' ? 'deleted' : 'saved'}.`, variable: result });
        } catch (error) {
            console.error('❌ Failed to save variable:', error);
            res.status(500).json({ success: false, message: "Failed to save variable: " + error.message });
        }
    });

    app.get('/api/settings', (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        res.status(200).json({
            isBotOnline: getSettings().isBotOnline,
            ignoredOverrideUsers: getIgnoredOverrideUsers(),
            specificOverrideUsers: getSpecificOverrideUsers(),
            preventRepeatingRule: getSettings().preventRepeatingRule,
            temporaryHide: getSettings().temporaryHide
        });
    });

    app.post('/api/bot/status', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        const { isOnline } = req.body;
        const settings = getSettings();
        settings.isBotOnline = isOnline;
        try {
            await db.saveSettings();
            res.status(200).json({ success: true, message: `Bot is now ${isOnline ? 'Online' : 'Offline'}.`, settings: getSettings() });
        } catch (error) {
            console.error('❌ Failed to update bot status:', error);
            res.status(500).json({ success: false, message: 'Failed to update bot status.' });
        }
    });

    app.post('/api/settings/ignored-override', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { users } = req.body;
            const userList = users.split(',').map(userString => {
                const [name, context] = userString.split(':').map(s => s.trim());
                return { name, context: context || 'ALL' };
            }).filter(item => item.name);
            getSettings().ignoredOverrideUsers = userList;
            await db.saveIgnoredOverrideUsers();
            res.status(200).json({ success: true, message: 'Ignored users updated successfully.' });
        } catch (error) {
            console.error('❌ Failed to update ignored users:', error);
            res.status(500).json({ success: false, message: 'Failed to update ignored users.' });
        }
    });

    app.post('/api/settings/specific-override', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { users } = req.body;
            const userList = users.split(',').map(u => u.trim()).filter(Boolean);
            getSettings().specificOverrideUsers = userList;
            await db.saveSpecificOverrideUsers();
            res.status(200).json({ success: true, message: 'Specific users updated successfully.' });
        } catch (error) {
            console.error('❌ Failed to update specific users:', error);
            res.status(500).json({ success: false, message: 'Failed to update specific users.' });
        }
    });

    app.post('/api/settings/prevent-repeating-rule', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { enabled, cooldown } = req.body;
            const settings = getSettings();
            settings.preventRepeatingRule.enabled = enabled;
            settings.preventRepeatingRule.cooldown = cooldown;
            await db.saveSettings();
            res.status(200).json({ success: true, message: 'Prevent repeating rule setting updated.', settings: getSettings() });
        } catch (error) {
            console.error('❌ Failed to update setting:', error);
            res.status(500).json({ success: false, message: 'Failed to update setting.' });
        }
    });

    app.post('/api/settings/temporary-hide', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const payload = req.body;
            const settings = getSettings();
            settings.temporaryHide = {
                ...settings.temporaryHide,
                ...payload,
                hideReply: convertNewlinesBeforeSave(payload.hideReply),
                unhideReply: convertNewlinesBeforeSave(payload.unhideReply)
            };
            await db.saveSettings();
            res.status(200).json({ success: true, message: 'Temporary hide settings updated.', settings: getSettings() });
        } catch (error) {
            console.error('❌ Failed to update temporary hide setting:', error);
            res.status(500).json({ success: false, message: 'Failed to update temporary hide setting.' });
        }
    });

    app.get('/api/owner-rules', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        res.status(200).json(getOwnerRules());
    });

    app.post('/api/owner-rules/update', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { type, rule, oldRuleNumber } = req.body;
            if (type === 'add') {
                await db.OwnerRule.deleteMany({ RULE_NUMBER: rule.ruleNumber });
                await db.OwnerRule.create(rule);
                console.log(`✅ Owner Rule ${rule.ruleNumber} added.`);
            } else if (type === 'edit') {
                if (rule.ruleNumber !== oldRuleNumber) {
                    await db.OwnerRule.deleteOne({ RULE_NUMBER: oldRuleNumber });
                    await db.OwnerRule.create(rule);
                    console.log(`✅ Owner Rule ${oldRuleNumber} updated to ${rule.ruleNumber}.`);
                } else {
                    await db.OwnerRule.findOneAndUpdate({ RULE_NUMBER: rule.ruleNumber }, rule, { new: true, upsert: true });
                    console.log(`✅ Owner Rule ${rule.ruleNumber} updated.`);
                }
            } else if (type === 'delete') {
                await db.OwnerRule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
                console.log(`❌ Owner Rule ${rule.ruleNumber} deleted.`);
            }
            await db.loadAllOwnerRules();
            res.status(200).json({ success: true, message: `Owner rule ${rule.ruleNumber} has been ${type === 'delete' ? 'deleted' : 'saved'}.` });
        } catch (error) {
            console.error('❌ Failed to save owner rule:', error);
            res.status(500).json({ success: false, message: "Failed to save owner rule: " + error.message });
        }
    });

    app.get('/api/owners', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        res.status(200).json(getOwnerList());
    });

    app.post('/api/owners/update', async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { owners } = req.body;
            getSettings().ownersList = owners;
            await db.saveOwnersList();
            res.status(200).json({ success: true, message: "Owners list updated successfully." });
        } catch (error) {
            console.error('❌ Failed to update owners:', error);
            res.status(500).json({ success: false, message: "Failed to update owners list: " + error.message });
        }
    });

    app.get("/api/automation-rules", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        res.status(200).json(getAutomationRules());
    });

    app.post("/api/automation-rules/update", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        try {
            const { type, rule, oldRuleNumber } = req.body;
            let result;
            if (type === 'add') {
                await db.AutomationRule.deleteMany({ RULE_NUMBER: rule.ruleNumber });
                result = await db.AutomationRule.create(rule);
                console.log(`✅ Automation Rule ${rule.ruleNumber} added.`);
            } else if (type === 'edit') {
                if (rule.ruleNumber !== oldRuleNumber) {
                    await db.AutomationRule.deleteOne({ RULE_NUMBER: oldRuleNumber });
                    await db.AutomationRule.create(rule);
                    console.log(`✅ Automation Rule ${oldRuleNumber} updated to ${rule.ruleNumber}.`);
                } else {
                    result = await db.AutomationRule.findOneAndUpdate({ RULE_NUMBER: rule.ruleNumber }, rule, { new: true, upsert: true });
                    console.log(`✅ Automation Rule ${rule.ruleNumber} updated.`);
                }
            } else if (type === 'delete') {
                await db.AutomationRule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
                console.log(`❌ Automation Rule ${rule.ruleNumber} deleted.`);
            }
            await db.loadAllAutomationRules();
            res.status(200).json({ success: true, message: `Automation Rule ${rule.ruleNumber} has been ${type === 'delete' ? 'deleted' : 'saved'}.`, rule: result });
        } catch (error) {
            console.error('❌ Failed to save automation rule:', error);
            res.status(500).json({ success: false, message: "Failed to save automation rule: " + error.message });
        }
    });
    
    app.get("/stats", async (req, res) => {
        if (!isReady()) return res.status(503).json({ message: "Server is not ready yet." });
        const stats = getStats();
        res.status(200).json({
            totalUsers: stats.totalUsers.length,
            todayUsers: stats.todayUsers.length,
            totalMsgs: stats.totalMsgs,
            todayMsgs: stats.todayMsgs
        });
    });

    io.on('connection', (socket) => {
        console.log('⚡ User connected:', socket.id);
        socket.emit('chatHistory', getMessageHistory());

        socket.on('disconnect', () => {
            console.log('🔌 User disconnected:', socket.id);
        });
    });
};
