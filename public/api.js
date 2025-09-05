// file: public/api.js

const { Router } = require("express");
const { getRules, setRules, getOwnerRules, setOwnerRules, getAutomationRules, setAutomationRules } = require('./core/state');
const { db } = require('./db');

const setupApiRoutes = (app, server, isReady) => {
    const router = Router();

    router.use((req, res, next) => {
        if (!isReady()) {
            return res.status(503).json({ message: 'Server is not ready yet.' });
        }
        next();
    });

    router.get('/rules', async (req, res) => {
        try {
            const rules = await db.Rule.find({}).sort({ RULE_NUMBER: 1 });
            res.json(rules);
        } catch (error) {
            console.error('Failed to fetch rules:', error);
            res.status(500).json({ message: 'Failed to fetch rules.' });
        }
    });

    router.post('/rules/update', async (req, res) => {
        const { type, rule, oldRuleNumber } = req.body;
        try {
            if (type === 'add') {
                const newRule = new db.Rule(rule);
                await newRule.save();
                setRules(await db.Rule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Rule added successfully!' });
            } else if (type === 'edit') {
                await db.Rule.findOneAndUpdate({ RULE_NUMBER: oldRuleNumber }, rule);
                setRules(await db.Rule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Rule updated successfully!' });
            } else if (type === 'delete') {
                await db.Rule.findOneAndDelete({ RULE_NUMBER: rule.ruleNumber });
                setRules(await db.Rule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Rule deleted successfully!' });
            } else {
                res.status(400).json({ message: 'Invalid update type.' });
            }
        } catch (error) {
            console.error('Failed to update rule:', error);
            res.status(500).json({ message: 'Failed to update rule.' });
        }
    });

    router.post('/rules/bulk-update', async (req, res) => {
        const rules = req.body;
        if (!Array.isArray(rules)) {
            return res.status(400).json({ message: "Invalid data format." });
        }

        const session = await db.mongoose.startSession();
        try {
            session.startTransaction();
            await db.Rule.deleteMany({}, { session });
            if (rules.length > 0) {
                await db.Rule.insertMany(rules, { session });
            }
            await session.commitTransaction();
            setRules(rules);
            res.json({ message: "Rules updated successfully!" });
        } catch (error) {
            await session.abortTransaction();
            console.error('Failed to bulk update rules:', error);
            res.status(500).json({ message: "Failed to update rules." });
        } finally {
            session.endSession();
        }
    });

    router.get('/variables', async (req, res) => {
        try {
            const variables = await db.Variable.find({});
            res.json(variables);
        } catch (error) {
            console.error('Failed to fetch variables:', error);
            res.status(500).json({ message: 'Failed to fetch variables.' });
        }
    });

    router.post('/variables/update', async (req, res) => {
        const { type, variable, oldName } = req.body;
        try {
            if (type === 'add') {
                const newVar = new db.Variable(variable);
                await newVar.save();
                res.json({ message: 'Variable added successfully!' });
            } else if (type === 'edit') {
                await db.Variable.findOneAndUpdate({ name: oldName }, { name: variable.name, value: variable.value });
                res.json({ message: 'Variable updated successfully!' });
            } else if (type === 'delete') {
                await db.Variable.findOneAndDelete({ name: variable.name });
                res.json({ message: 'Variable deleted successfully!' });
            } else {
                res.status(400).json({ message: 'Invalid update type.' });
            }
            await db.loadAllVariables();
        } catch (error) {
            console.error('Failed to update variable:', error);
            res.status(500).json({ message: 'Failed to update variable.' });
        }
    });

    router.post('/bot/status', async (req, res) => {
        const { isOnline } = req.body;
        const currentSettings = getSettings();
        currentSettings.isBotOnline = isOnline;
        await db.saveSettings();
        res.json({ message: `Bot status set to ${isOnline ? 'Online' : 'Offline'}`, settings: currentSettings });
    });

    router.get('/settings', (req, res) => {
        const settings = getSettings();
        const { ignoredOverrideUsers, specificOverrideUsers } = getIgnoredOverrideUsers(), getSpecificOverrideUsers();
        res.json({ ...settings, ignoredOverrideUsers, specificOverrideUsers });
    });

    router.post('/settings/prevent-repeating-rule', async (req, res) => {
        const { enabled, cooldown } = req.body;
        const currentSettings = getSettings();
        currentSettings.preventRepeatingRule.enabled = enabled;
        currentSettings.preventRepeatingRule.cooldown = cooldown;
        await db.saveSettings();
        res.json({ message: 'Prevent repeating rule settings saved.', settings: currentSettings });
    });

    router.post('/settings/temporary-hide', async (req, res) => {
        const { enabled, matchType, triggerText, unhideEnabled, unhideMatchType, unhideTriggerText, hideReply, unhideReply } = req.body;
        const currentSettings = getSettings();
        currentSettings.temporaryHide = { enabled, matchType, triggerText, unhideEnabled, unhideMatchType, unhideTriggerText, hideReply, unhideReply };
        await db.saveSettings();
        res.json({ message: 'Temporary hide settings saved.', settings: currentSettings });
    });

    router.get('/owners', (req, res) => {
        res.json(getOwnerList());
    });

    router.post('/owners/update', async (req, res) => {
        const { owners } = req.body;
        setOwnerList(owners);
        await db.saveOwnersList();
        res.json({ message: 'Owners list updated successfully!' });
    });

    router.get('/owner-rules', async (req, res) => {
        try {
            const rules = await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
            res.json(rules);
        } catch (error) {
            console.error('Failed to fetch owner rules:', error);
            res.status(500).json({ message: 'Failed to fetch owner rules.' });
        }
    });

    router.post('/owner-rules/update', async (req, res) => {
        const { type, rule, oldRuleNumber } = req.body;
        try {
            if (type === 'add') {
                const newRule = new db.OwnerRule(rule);
                await newRule.save();
                setOwnerRules(await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Owner rule added successfully!' });
            } else if (type === 'edit') {
                await db.OwnerRule.findOneAndUpdate({ RULE_NUMBER: oldRuleNumber }, rule);
                setOwnerRules(await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Owner rule updated successfully!' });
            } else if (type === 'delete') {
                await db.OwnerRule.findOneAndDelete({ RULE_NUMBER: rule.ruleNumber });
                setOwnerRules(await db.OwnerRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Owner rule deleted successfully!' });
            } else {
                res.status(400).json({ message: 'Invalid update type.' });
            }
        } catch (error) {
            console.error('Failed to update owner rule:', error);
            res.status(500).json({ message: 'Failed to update owner rule.' });
        }
    });
    
    // New Automation Rules Routes
    router.get('/automation-rules', async (req, res) => {
        try {
            const rules = await db.AutomationRule.find({}).sort({ RULE_NUMBER: 1 });
            res.json(rules);
        } catch (error) {
            console.error('Failed to fetch automation rules:', error);
            res.status(500).json({ message: 'Failed to fetch automation rules.' });
        }
    });

    router.post('/automation-rules/update', async (req, res) => {
        const { type, rule, oldRuleNumber } = req.body;
        try {
            if (type === 'add') {
                const newRule = new db.AutomationRule(rule);
                await newRule.save();
                setAutomationRules(await db.AutomationRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Automation rule added successfully!' });
            } else if (type === 'edit') {
                await db.AutomationRule.findOneAndUpdate({ RULE_NUMBER: oldRuleNumber }, rule);
                setAutomationRules(await db.AutomationRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Automation rule updated successfully!' });
            } else if (type === 'delete') {
                await db.AutomationRule.findOneAndDelete({ RULE_NUMBER: rule.ruleNumber });
                setAutomationRules(await db.AutomationRule.find({}).sort({ RULE_NUMBER: 1 }));
                res.json({ message: 'Automation rule deleted successfully!' });
            } else {
                res.status(400).json({ message: 'Invalid update type.' });
            }
        } catch (error) {
            console.error('Failed to update automation rule:', error);
            res.status(500).json({ message: 'Failed to update automation rule.' });
        }
    });


    app.use('/api', router);
};

module.exports = setupApiRoutes;