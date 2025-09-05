// file: db.js

const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const { 
    FILE_PATHS, setStats, setWelcomedUsers, setRules, setOwnerRules,
    setVariables, setIgnoredOverrideUsers, setSpecificOverrideUsers, setOwnerList,
    setSettings, getStats, getSettings, getWelcomedUsers, getIgnoredOverrideUsers, getSpecificOverrideUsers, getOwnerList, setAutomationRules, getAutomationRules
} = require('./core/state');

mongoose.connect(process.env.MONGODB_URI)
.then(() => console.log("⚡ MongoDB connected successfully!"))
.catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: false },
    senderName: { type: String, required: true, unique: true }
});
const User = mongoose.model("User", userSchema);

const ruleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true },
    TARGET_USERS: { type: mongoose.Schema.Types.Mixed, default: "ALL" }
});
const Rule = mongoose.model("Rule", ruleSchema);

const ownerRuleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true }
});
const OwnerRule = mongoose.model("OwnerRule", ownerRuleSchema);

const automationRuleSchema = new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true },
    USER_ACCESS_TYPE: { type: String, required: true, default: 'ALL' },
    DEFINED_USERS: { type: mongoose.Schema.Types.Mixed, default: [] },
    MIN_DELAY: { type: Number, default: 0 },
    MAX_DELAY: { type: Number, default: 0 },
    COOLDOWN: { type: Number, default: 0 }
});
const AutomationRule = mongoose.model("AutomationRule", automationRuleSchema);

const statsSchema = new mongoose.Schema({
    totalUsers: [{ type: String }],
    todayUsers: [{ type: String }],
    totalMsgs: { type: Number, default: 0 },
    todayMsgs: { type: Number, default: 0 },
    nobiPapaHideMeUsers: [{ type: String }],
    lastResetDate: { type: String }
});
const Stats = mongoose.model("Stats", statsSchema);

const variableSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: String, required: true }
});
const Variable = mongoose.model("Variable", variableSchema);

const settingsSchema = new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true },
    settings_data: mongoose.Schema.Types.Mixed
});
const Settings = mongoose.model("Settings", settingsSchema);

const messageStatsSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: true },
    senderName: { type: String, required: true },
    isGroup: { type: Boolean, required: true },
    groupName: { type: String },
    receivedCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    ruleReplyCounts: {
        type: Map,
        of: Number,
        default: {}
    },
    lastActiveDate: { type: String }
});
const MessageStats = mongoose.model("MessageStats", messageStatsSchema);

const loadAllRules = async () => {
    const rules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    setRules(rules);
    console.log(`⚡ Loaded ${rules.length} rules from MongoDB.`);
};

const loadAllOwnerRules = async () => {
    const ownerRules = await OwnerRule.find({}).sort({ RULE_NUMBER: 1 });
    setOwnerRules(ownerRules);
    console.log(`⚡ Loaded ${ownerRules.length} owner rules from MongoDB.`);
};

const loadAllAutomationRules = async () => {
    const automationRules = await AutomationRule.find({}).sort({ RULE_NUMBER: 1 });
    setAutomationRules(automationRules);
    console.log(`⚡ Loaded ${automationRules.length} automation rules from MongoDB.`);
};

const loadAllVariables = async () => {
    const variables = await Variable.find({});
    setVariables(variables);
    console.log(`⚡ Loaded ${variables.length} variables from MongoDB.`);
};

const loadSettingsFromFiles = async () => {
    let loaded = false;
    if (fs.existsSync(FILE_PATHS.ignoredOverrideUsersFile) && fs.existsSync(FILE_PATHS.specificOverrideUsersFile)) {
        setIgnoredOverrideUsers(JSON.parse(fs.readFileSync(FILE_PATHS.ignoredOverrideUsersFile, 'utf8')));
        setSpecificOverrideUsers(JSON.parse(fs.readFileSync(FILE_PATHS.specificOverrideUsersFile, 'utf8')));
        console.log(`🔍 Override users loaded from local files.`);
        loaded = true;
    }
    if (fs.existsSync(FILE_PATHS.ownersListFile)) {
        setOwnerList(JSON.parse(fs.readFileSync(FILE_PATHS.ownersListFile, 'utf8')));
        console.log(`👑 Owner list loaded from local file.`);
        loaded = true;
    }
    if (fs.existsSync(FILE_PATHS.settingsFilePath)) {
        const fileContent = fs.readFileSync(FILE_PATHS.settingsFilePath, 'utf8');
        try {
            const loadedSettings = JSON.parse(fileContent);
            setSettings({ ...getSettings(), ...loadedSettings });
            console.log('⚙️ Settings loaded from local file.');
            loaded = true;
        } catch (e) {
            console.error('❌ Failed to parse settings.json:', e);
        }
    }
    return loaded;
};

const restoreSettingsFromDb = async () => {
    const overrideSettings = await Settings.findOne({ settings_type: 'override_lists' });
    if (overrideSettings) {
        setIgnoredOverrideUsers(overrideSettings.settings_data.ignored || []);
        setSpecificOverrideUsers(overrideSettings.settings_data.specific || []);
        setOwnerList(overrideSettings.settings_data.owners || []);
        fs.writeFileSync(FILE_PATHS.ignoredOverrideUsersFile, JSON.stringify(getIgnoredOverrideUsers(), null, 2));
        fs.writeFileSync(FILE_PATHS.specificOverrideUsersFile, JSON.stringify(getSpecificOverrideUsers(), null, 2));
        fs.writeFileSync(FILE_PATHS.ownersListFile, JSON.stringify(getOwnerList(), null, 2));
        console.log('✅ Override lists restored from MongoDB.');
    }

    const globalSettings = await Settings.findOne({ settings_type: 'global_settings' });
    if (globalSettings) {
        setSettings({ ...getSettings(), ...globalSettings.settings_data });
        fs.writeFileSync(FILE_PATHS.settingsFilePath, JSON.stringify(getSettings(), null, 2));
        console.log('✅ Global settings restored from MongoDB.');
    }
};

const loadOwnersList = async () => {
    try {
        let owners = await Settings.findOne({ settings_type: 'override_lists' });
        if (owners && owners.settings_data && owners.settings_data.owners) {
            setOwnerList(owners.settings_data.owners);
            fs.writeFileSync(FILE_PATHS.ownersListFile, JSON.stringify(getOwnerList(), null, 2));
            console.log(`👑 Loaded ${getOwnerList().length} owners from MongoDB.`);
        } else {
            setOwnerList([]);
            fs.writeFileSync(FILE_PATHS.ownersListFile, JSON.stringify([], null, 2));
            console.log('🔍 No owners list found in MongoDB, resetting.');
        }
    } catch (err) {
        console.error("❌ Failed to load owner list from DB:", err);
    }
};

const syncData = async () => {
    try {
        const today = new Date().toLocaleDateString();
        let stats = await Stats.findOne();
        if (!stats) {
            stats = await Stats.create({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today });
        }
        setStats(stats);
        fs.writeFileSync(FILE_PATHS.statsFilePath, JSON.stringify(stats, null, 2));

        const dbWelcomedUsers = await User.find({}, 'senderName');
        setWelcomedUsers(dbWelcomedUsers.map(u => u.senderName));
        fs.writeFileSync(FILE_PATHS.welcomedUsersFilePath, JSON.stringify(getWelcomedUsers(), null, 2));

        await loadAllRules();
        await loadAllOwnerRules();
        await loadAllAutomationRules();
        await loadAllVariables();

        await loadSettingsFromFiles();
        await restoreSettingsFromDb();

        if (getStats().lastResetDate !== today) {
            await resetDailyStats();
        }

        return true;
    } catch (err) {
        console.error("❌ Data sync error:", err);
        return false;
    }
};

const saveStats = async () => {
    const stats = getStats();
    await Stats.findByIdAndUpdate(stats._id, stats);
    fs.writeFileSync(FILE_PATHS.statsFilePath, JSON.stringify(stats, null, 2));
};

const saveWelcomedUsers = async () => {
    fs.writeFileSync(FILE_PATHS.welcomedUsersFilePath, JSON.stringify(getWelcomedUsers(), null, 2));
};

const saveVariables = async () => {
    const variablesFromDB = await Variable.find({});
    fs.writeFileSync(FILE_PATHS.variablesFilePath, JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));
};

const saveOwnerRules = async () => {
    const ownerRulesFromDB = await OwnerRule.find({});
    fs.writeFileSync(FILE_PATHS.ownerRulesFilePath, JSON.stringify({ rules: ownerRulesFromDB.map(r => r.toObject()) }, null, 2));
};

const saveAutomationRules = async () => {
    const automationRulesFromDB = await AutomationRule.find({});
    fs.writeFileSync(FILE_PATHS.automationRulesFilePath, JSON.stringify({ rules: automationRulesFromDB.map(r => r.toObject()) }, null, 2));
};

const saveIgnoredOverrideUsers = async () => {
    fs.writeFileSync(FILE_PATHS.ignoredOverrideUsersFile, JSON.stringify(getIgnoredOverrideUsers(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': getIgnoredOverrideUsers(), 'settings_data.specific': getSpecificOverrideUsers(), 'settings_data.owners': getOwnerList() },
        { upsert: true, new: true }
    );
};

const saveSpecificOverrideUsers = async () => {
    fs.writeFileSync(FILE_PATHS.specificOverrideUsersFile, JSON.stringify(getSpecificOverrideUsers(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': getIgnoredOverrideUsers(), 'settings_data.specific': getSpecificOverrideUsers(), 'settings_data.owners': getOwnerList() },
        { upsert: true, new: true }
    );
};

const saveOwnersList = async () => {
    fs.writeFileSync(FILE_PATHS.ownersListFile, JSON.stringify(getOwnerList(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': getIgnoredOverrideUsers(), 'settings_data.specific': getSpecificOverrideUsers(), 'settings_data.owners': getOwnerList() },
        { upsert: true, new: true }
    );
};

const saveSettings = async () => {
    fs.writeFileSync(FILE_PATHS.settingsFilePath, JSON.stringify(getSettings(), null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data': getSettings() },
        { upsert: true, new: true }
    );
};

const resetDailyStats = async () => {
    const stats = getStats();
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

exports.db = {
    Rule, OwnerRule, Stats, Variable, Settings, User, MessageStats, AutomationRule, mongoose,
    syncData, loadAllRules, loadAllOwnerRules, loadAllVariables, loadAllAutomationRules, loadSettingsFromFiles, restoreSettingsFromDb,
    saveStats, saveWelcomedUsers, saveVariables, saveOwnerRules, saveAutomationRules,
    saveIgnoredOverrideUsers, saveSpecificOverrideUsers, saveOwnersList,
    saveSettings, resetDailyStats, scheduleDailyReset
};
