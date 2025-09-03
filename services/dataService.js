const fs = require("fs");
const path = require("path");
const { User, Rule, Variable, Settings, Stats } = require("../config/database");

// Global variables
let stats;
let welcomedUsers;
let RULES = [];
let VARIABLES = [];
let IGNORED_OVERRIDE_USERS = [];
let SPECIFIC_OVERRIDE_USERS = [];
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

// File paths
const dataDir = path.join(__dirname, "..", "data");
const statsFilePath = path.join(dataDir, "stats.json");
const welcomedUsersFilePath = path.join(dataDir, "welcomed_users.json");
const variablesFilePath = path.join(dataDir, "variables.json");
const ignoredOverrideUsersFile = path.join(dataDir, "ignored_override_users.json");
const specificOverrideUsersFile = path.join(dataDir, "specific_override_users.json");
const settingsFilePath = path.join(dataDir, "settings.json");

const today = new Date().toLocaleDateString();

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
          enabled: false,
          matchType: 'EXACT',
          triggerText: 'nobi papa hide me',
          unhideEnabled: true,
          unhideTriggerText: 'nobi papa start',
          unhideMatchType: 'EXACT',
          hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
          unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe te? Abhi reply milega.'
        };
      }
      
      if (settings.temporaryHide.unhideEnabled === undefined) {
        settings.temporaryHide.unhideEnabled = true;
      }
      if (settings.temporaryHide.unhideTriggerText === undefined) {
        settings.temporaryHide.unhideTriggerText = 'nobi papa start';
      }
      if (settings.temporaryHide.unhideMatchType === undefined) {
        settings.temporaryHide.unhideMatchType = 'EXACT';
      }
      if (settings.temporaryHide.hideReply === undefined) {
        settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.';
      }
      if (settings.temporaryHide.unhideReply === undefined) {
        settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.';
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
        enabled: false,
        matchType: 'EXACT',
        triggerText: 'nobi papa hide me',
        unhideEnabled: true,
        unhideTriggerText: 'nobi papa start',
        unhideMatchType: 'EXACT',
        hideReply: 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.',
        unhideReply: 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.'
      };
    }
    
    if (settings.temporaryHide.unhideEnabled === undefined) {
      settings.temporaryHide.unhideEnabled = true;
    }
    if (settings.temporaryHide.unhideTriggerText === undefined) {
      settings.temporaryHide.unhideTriggerText = 'nobi papa start';
    }
    if (settings.temporaryHide.unhideMatchType === undefined) {
      settings.temporaryHide.unhideMatchType = 'EXACT';
    }
    if (settings.temporaryHide.hideReply === undefined) {
      settings.temporaryHide.hideReply = 'Aapko ab chup kar diya gaya hai, mai koi message nahi bhejunga ab.<#>Main ab online nahi hoon. Dobara try mat karna.';
    }
    if (settings.temporaryHide.unhideReply === undefined) {
      settings.temporaryHide.unhideReply = 'Mai wapas aa gaya, abhi aapko reply karunga.<#>Wapis aane ka intezar kar rahe the? Abhi reply milega.';
    }
    
    fs.writeFileSync(settingsFilePath, JSON.stringify(settings, null, 2));
    console.log('✅ Global settings restored from MongoDB.');
  }
}

const migrateOldSettings = async () => {
  if (fs.existsSync(ignoredOverrideUsersFile) || fs.existsSync(specificOverrideUsersFile)) {
    const ignored = fs.existsSync(ignoredOverrideUsersFile) ? JSON.parse(fs.readFileSync(ignoredOverrideUsersFile, 'utf8')) : [];
    const specific = fs.existsSync(specificOverrideUsersFile) ? JSON.parse(fs.readFileSync(specificOverrideUsersFile, 'utf8')) : [];
    
    await Settings.findOneAndUpdate(
      { settings_type: 'override_lists' },
      { settings_ { ignored, specific } },
      { upsert: true, new: true }
    );
    console.log('✅ Old override lists migrated to MongoDB.');
    
    if (fs.existsSync(ignoredOverrideUsersFile)) fs.unlinkSync(ignoredOverrideUsersFile);
    if (fs.existsSync(specificOverrideUsersFile)) fs.unlinkSync(specificOverrideUsersFile);
  }

  if (fs.existsSync(settingsFilePath)) {
    const oldSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
    await Settings.findOneAndUpdate(
      { settings_type: 'global_settings' },
      { settings_ oldSettings },
      { upsert: true, new: true }
    );
    console.log('✅ Old global settings migrated to MongoDB.');
    fs.unlinkSync(settingsFilePath);
  }
};

const syncData = async (emitStats) => {
  try {
    stats = await Stats.findOne();
    if (!stats) {
      stats = await Stats.create({ 
        totalUsers: [], 
        todayUsers: [], 
        totalMsgs: 0, 
        todayMsgs: 0, 
        nobiPapaHideMeUsers: [], 
        lastResetDate: today 
      });
    }

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
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

    if (emitStats) emitStats();
    
    console.log('✅ Server is ready to handle requests.');
    return true;
  } catch (err) {
    console.error("❌ Data sync error:", err);
    return false;
  }
};

function saveStats() {
  fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

function saveWelcomedUsers() {
  fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
}

function saveVariables() {
  fs.writeFileSync(variablesFilePath, JSON.stringify(VARIABLES, null, 2));
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

const resetDailyStats = async () => {
  stats.todayUsers = [];
  stats.todayMsgs = 0;
  stats.lastResetDate = new Date().toLocaleDateString();
  await Stats.findByIdAndUpdate(stats._id, stats);
  saveStats();
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

// Getter functions for data access
function getStats() { return stats; }
function getWelcomedUsers() { return welcomedUsers; }
function getRules() { return RULES; }
function getVariables() { return VARIABLES; }
function getIgnoredOverrideUsers() { return IGNORED_OVERRIDE_USERS; }
function getSpecificOverrideUsers() { return SPECIFIC_OVERRIDE_USERS; }
function getSettings() { return settings; }

// Setter functions for data modification
function setStats(newStats) { stats = newStats; }
function setWelcomedUsers(newWelcomedUsers) { welcomedUsers = newWelcomedUsers; }
function setRules(newRules) { RULES = newRules; }
function setVariables(newVariables) { VARIABLES = newVariables; }
function setIgnoredOverrideUsers(newUsers) { IGNORED_OVERRIDE_USERS = newUsers; }
function setSpecificOverrideUsers(newUsers) { SPECIFIC_OVERRIDE_USERS = newUsers; }
function setSettings(newSettings) { settings = newSettings; }

module.exports = {
  loadAllRules,
  loadAllVariables,
  loadSettingsFromFiles,
  restoreSettingsFromDb,
  migrateOldSettings,
  syncData,
  saveStats,
  saveWelcomedUsers,
  saveVariables,
  saveIgnoredOverrideUsers,
  saveSpecificOverrideUsers,
  saveSettings,
  resetDailyStats,
  scheduleDailyReset,
  getStats,
  getWelcomedUsers,
  getRules,
  getVariables,
  getIgnoredOverrideUsers,
  getSpecificOverrideUsers,
  getSettings,
  setStats,
  setWelcomedUsers,
  setRules,
  setVariables,
  setIgnoredOverrideUsers,
  setSpecificOverrideUsers,
  setSettings
};
