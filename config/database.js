const mongoose = require("mongoose");

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("⚡ MongoDB connected successfully!"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: false },
  senderName: { type: String, required: true, unique: true }
});

// Rule Schema
const ruleSchema = new mongoose.Schema({
  RULE_NUMBER: { type: Number, required: true, unique: true },
  RULE_NAME: { type: String, required: false },
  RULE_TYPE: { type: String, required: true },
  KEYWORDS: { type: String, required: true },
  REPLIES_TYPE: { type: String, required: true },
  REPLY_TEXT: { type: String, required: true },
  TARGET_USERS: { type: mongoose.Schema.Types.Mixed, default: "ALL" }
});

// Stats Schema
const statsSchema = new mongoose.Schema({
  totalUsers: [{ type: String }],
  todayUsers: [{ type: String }],
  totalMsgs: { type: Number, default: 0 },
  todayMsgs: { type: Number, default: 0 },
  nobiPapaHideMeUsers: [{ type: String }],
  lastResetDate: { type: String }
});

// Variable Schema
const variableSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  value: { type: String, required: true }
});

// Settings Schema
const settingsSchema = new mongoose.Schema({
  settings_type: { type: String, required: true, unique: true },
  settings_ mongoose.Schema.Types.Mixed
});

// Message Stats Schema
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

const User = mongoose.model("User", userSchema);
const Rule = mongoose.model("Rule", ruleSchema);
const Stats = mongoose.model("Stats", statsSchema);
const Variable = mongoose.model("Variable", variableSchema);
const Settings = mongoose.model("Settings", settingsSchema);
const MessageStats = mongoose.model("MessageStats", messageStatsSchema);

module.exports = {
  User,
  Rule,
  Stats,
  Variable,
  Settings,
  MessageStats,
  mongoose
};
