// file: dataManager.js

const fs = require("fs");
const path = require("path");
const { Rule, Variable, Settings, Stats, User } = require("./db");
const state = require('./state');

const today = new Date().toLocaleDateString();

const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const ignoredOverrideUsersFile = path.join(__dirname, "data", "ignored_override_users.json");
const specificOverrideUsersFile = path.join(__dirname, "data", "specific_override_users.json");
const settingsFilePath = path.join(__dirname, "data", "settings.json");

let RULES = [];
let VARIABLES = [];
let IGNORED_OVERRIDE_USERS = [];
let SPECIFIC_OVERRIDE_USERS = [];
let stats;
let welcomedUsers;
let settings = {
    preventRepeatingRule: {
        enabled: false,
        cooldown: 2
    },
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
};

function emitStats(io) {
    if (stats) {
        io.emit("statsUpdate", {
            totalUsers: stats.totalUsers.length,
            totalMsgs: stats.totalMsgs,
            todayUsers: stats.todayUsers.length,
            todayMsgs: stats.todayMsgs,
            nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
        });
    }
}

async function loadAllRules() {
    RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

async function loadAllVariables() {
    VARIABLES = await Variable.find({});
    console.log(`⚡ Loaded ${VARIABLES.length} variables from MongoDB.`);
}

async function loadSettingsFromFiles() {
    let loaded = false;
    if (fs.existsSync(ignoredOverrideUsersFile) && fs.existsSync(specificOverrideUsersFile)) {
        IGNORED_OVERRIDE_USERS = JSON.parse(fs.readFileSync(ignoredOverrideUsersFile, 'utf8'));
        SPECIFIC_OVERRIDE_USERS = JSON.parse(fs.readFileSync(specificOverrideUsersFile, 'utf8'));
        console.log(`🔍 Override users loaded from local files.`);
        loaded = true;
    }
    if (fs.existsSync(settingsFilePath)) {
        const fileContent = fs.readFileSync(settingsFilePath, 'utf8');
        try {
            const loadedSettings = JSON.parse(fileContent);
            settings = { ...settings, ...loadedSettings };
            if (!settings.temporaryHide) {
                settings.temporaryHide = {
                    enabled: false, matchType: 'EXACT', triggerText: 'nobi papa hide me',
                    unhideEnabled: true, unhideTriggerText: 'nobi papa start', unhideMatchType: 'EXACT',
                    hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
                    unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
                };
            }
            console.log('⚙️ Settings loaded from local file.');
            loaded = true;
        } catch (e) {
            console.error('❌ Failed to parse settings.json:', e);
        }
    }
    return loaded;
}

async function restoreSettingsFromDb() {
    const overrideSettings = await Settings.findOne({ settings_type: 'override_lists' });
    if (overrideSettings) {
        IGNORED_OVERRIDE_USERS = overrideSettings.settings_data.ignored || [];
        SPECIFIC_OVERRIDE_USERS = overrideSettings.settings_data.specific || [];
        fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
        fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
        console.log('✅ Override lists restored from MongoDB.');
    }

    const globalSettings = await Settings.findOne({ settings_type: 'global_settings' });
    if (globalSettings) {
        settings = { ...settings, ...globalSettings.settings_data };
        if (!settings.temporaryHide) {
            settings.temporaryHide = {
                enabled: false, matchType: 'EXACT', triggerText: 'nobi papa hide me',
                unhideEnabled: true, unhideTriggerText: 'nobi papa start', unhideMatchType: 'EXACT',
                hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
                unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
            };
        }
        fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
        console.log('✅ Global settings restored from MongoDB.');
    }
}

async function saveStats() {
    fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
    await Stats.findByIdAndUpdate(stats._id, stats);
}

async function saveWelcomedUsers() {
    fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

async function saveIgnoredOverrideUsers() {
    fs.writeFileSync(ignoredOverrideUsersFile, JSON.stringify(IGNORED_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}

async function saveSpecificOverrideUsers() {
    fs.writeFileSync(specificOverrideUsersFile, JSON.stringify(SPECIFIC_OVERRIDE_USERS, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'override_lists' },
        { 'settings_data.ignored': IGNORED_OVERRIDE_USERS, 'settings_data.specific': SPECIFIC_OVERRIDE_USERS },
        { upsert: true, new: true }
    );
}

async function saveSettings() {
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    await Settings.findOneAndUpdate(
        { settings_type: 'global_settings' },
        { 'settings_data': settings },
        { upsert: true, new: true }
    );
}

async function syncData(io) {
    try {
        stats = await Stats.findOne();
        if (!stats) {
            stats = await Stats.create({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today });
        }

        fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));

        const dbWelcomedUsers = await User.find({}, 'senderName');
        welcomedUsers = dbWelcomedUsers.map(u => u.senderName);
        fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));

        await loadAllRules();
        await loadAllVariables();

        const settingsLoaded = await loadSettingsFromFiles();
        if (!settingsLoaded) {
            console.log('⚠️ Settings files not found. Restoring from MongoDB...');
            await restoreSettingsFromDb();
        }

        if (stats.lastResetDate !== today) {
            stats.todayUsers = [];
            stats.todayMsgs = 0;
            stats.lastResetDate = today;
            await Stats.findByIdAndUpdate(stats._id, stats);
            fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
        }

        emitStats(io);
        
        state.isReady = true; // <-- Ab state object ko update kiya jaayega
        console.log('✅ Server is ready to handle requests.');
    } catch (err) {
        console.error("❌ Data sync error:", err);
    }
}

module.exports = {
    syncData,
    saveStats,
    saveWelcomedUsers,
    saveIgnoredOverrideUsers,
    saveSpecificOverrideUsers,
    saveSettings,
    stats,
    welcomedUsers,
    RULES,
    VARIABLES,
    IGNORED_OVERRIDE_USERS,
    SPECIFIC_OVERRIDE_USERS,
    settings,
    loadAllRules,
    loadAllVariables,
    emitStats
};