// file: config/database.js

const mongoose = require("mongoose");
const today = new Date().toLocaleDateString();

// Models ko define aur export karein
const User = mongoose.model('User', new mongoose.Schema({
    sessionId: { type: String, required: true, unique: false },
    senderName: { type: String, required: true, unique: true }
}));

const Rule = mongoose.model('Rule', new mongoose.Schema({
    RULE_NUMBER: { type: Number, required: true, unique: true },
    RULE_NAME: { type: String, required: false },
    RULE_TYPE: { type: String, required: true },
    KEYWORDS: { type: String, required: true },
    REPLIES_TYPE: { type: String, required: true },
    REPLY_TEXT: { type: String, required: true },
    TARGET_USERS: { type: mongoose.Schema.Types.Mixed, default: "ALL" }
}));

const Stats = mongoose.model('Stats', new mongoose.Schema({
    totalUsers: [{ type: String }],
    todayUsers: [{ type: String }],
    totalMsgs: { type: Number, default: 0 },
    todayMsgs: { type: Number, default: 0 },
    nobiPapaHideMeUsers: [{ type: String }],
    lastResetDate: { type: String }
}));

const Variable = mongoose.model('Variable', new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    value: { type: String, required: true }
}));

const Settings = mongoose.model('Settings', new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true },
    settings_data: mongoose.Schema.Types.Mixed
}));

const MessageStats = mongoose.model('MessageStats', new mongoose.Schema({
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
}));

module.exports = {
    User,
    Rule,
    Stats,
    Variable,
    Settings,
    MessageStats,
    today,
};