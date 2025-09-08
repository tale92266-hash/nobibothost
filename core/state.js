// file: core/state.js

const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "data");
const statsFilePath = path.join(dataDir, "stats.json");
const welcomedUsersFilePath = path.join(dataDir, "welcomed_users.json");
const variablesFilePath = path.join(dataDir, "variables.json");
const ignoredOverrideUsersFile = path.join(dataDir, "ignored_override_users.json");
const specificOverrideUsersFile = path.join(dataDir, "specific_override_users.json");
const ownersListFile = path.join(dataDir, "owner_list.json");
const settingsFilePath = path.join(dataDir, "settings.json");
const ownerRulesFilePath = path.join(dataDir, "owner_rules.json");
const automationRulesFilePath = path.join(dataDir, "automation_rules.json");

let state = {
    stats: null,
    welcomedUsers: [],
    rules: [],
    ownerRules: [],
    automationRules: [],
    variables: [],
    ignoredOverrideUsers: [],
    specificOverrideUsers: [],
    ownerList: [],
    settings: {
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
        },
        masterStop: {
            enabled: false,
            matchType: 'EXACT',
            triggerText: 'stop all automation',
            replyText: 'Sare automation rules band kar diye gaye hain.'
        },
        delayOverride: {
            minDelay: 0,
            maxDelay: 0
        }
    },
    isAutomationEnabled: true,
    recentChatMessages: [],
    messageHistory: [],
    lastReplyTimes: {},
    welcomeLogs: new Map()
};

// Getter functions
exports.getStats = () => state.stats;
exports.getWelcomedUsers = () => state.welcomedUsers;
exports.getRules = () => state.rules;
exports.getOwnerRules = () => state.ownerRules;
exports.getAutomationRules = () => state.automationRules;
exports.getVariables = () => state.variables;
exports.getIgnoredOverrideUsers = () => state.ignoredOverrideUsers;
exports.getSpecificOverrideUsers = () => state.specificOverrideUsers;
exports.getOwnerList = () => state.ownerList;
exports.getSettings = () => state.settings;
exports.getRecentChatMessages = () => state.recentChatMessages;
exports.getMessageHistory = () => state.messageHistory;
exports.getLastReplyTimes = () => state.lastReplyTimes;
exports.getIsAutomationEnabled = () => state.isAutomationEnabled;
exports.getWelcomeLog = () => state.welcomeLogs;

// Setter functions
exports.setStats = (stats) => { state.stats = stats; };
exports.setWelcomedUsers = (users) => { state.welcomedUsers = users; };
exports.setRules = (rules) => { state.rules = rules; };
exports.setOwnerRules = (rules) => { state.ownerRules = rules; };
exports.setAutomationRules = (rules) => { state.automationRules = rules; };
exports.setVariables = (vars) => { state.variables = vars; };
exports.setIgnoredOverrideUsers = (users) => { state.ignoredOverrideUsers = users; };
exports.setSpecificOverrideUsers = (users) => { state.specificOverrideUsers = users; };
exports.setOwnerList = (list) => { state.ownerList = list; };
exports.setSettings = (settings) => { state.settings = settings; };
exports.setRecentChatMessages = (messages) => { state.recentChatMessages = messages; };
exports.setMessageHistory = (history) => { state.messageHistory = history; };
exports.setLastReplyTimes = (times) => { state.lastReplyTimes = times; };
exports.setIsAutomationEnabled = (bool) => { state.isAutomationEnabled = bool; };
exports.addWelcomeLogEntry = (ruleId, ownerName, context) => {
    state.welcomeLogs.set(`${ownerName}-${ruleId}-${context}`, true);
};
exports.setWelcomeLogs = (logs) => { state.welcomeLogs = logs; };


// File path constants
exports.FILE_PATHS = {
    statsFilePath,
    welcomedUsersFilePath,
    variablesFilePath,
    ignoredOverrideUsersFile,
    specificOverrideUsersFile,
    ownersListFile,
    settingsFilePath,
    ownerRulesFilePath,
    automationRulesFilePath
};

const ruleCooldowns = new Map();
exports.ruleCooldowns = ruleCooldowns;