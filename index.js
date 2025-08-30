require("dotenv").config();

const express = require("express");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const mongoose = require("mongoose");
const app = express();
const PORT = process.env.PORT || 10000;
const SERVER_URL = process.env.SERVER_URL || `http://localhost:${PORT}`;
const MONGODB_URI = process.env.MONGODB_URI;
const server = require("http").createServer(app);
const { Server } = require("socket.io");
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json({ limit: "1mb" }));

// MongoDB Connection & Models
mongoose.connect(MONGODB_URI)
.then(() => console.log("⚡ MongoDB connected successfully!"))
.catch(err => console.error("❌ MongoDB connection error:", err));

const userSchema = new mongoose.Schema({
sessionId: { type: String, required: true, unique: true }
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

// Persistent Stats
const statsFilePath = path.join(__dirname, "data", "stats.json");
const welcomedUsersFilePath = path.join(__dirname, "data", "welcomed_users.json");
const variablesFilePath = path.join(__dirname, "data", "variables.json");
const today = new Date().toLocaleDateString();

let stats;
let welcomedUsers;
let RULES = [];
let VARIABLES = [];

// Helper functions
async function loadAllRules() {
RULES = await Rule.find({}).sort({ RULE_NUMBER: 1 });
console.log(`⚡ Loaded ${RULES.length} rules from MongoDB.`);
}

async function loadAllVariables() {
VARIABLES = await Variable.find({});
console.log(`⚡ Loaded ${VARIABLES.length} variables from MongoDB.`);
}

const syncData = async () => {
try {
stats = await Stats.findOne();
if (!stats) {
stats = await Stats.create({ totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today });
}

fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
const dbWelcomedUsers = await User.find({}, 'sessionId');
welcomedUsers = dbWelcomedUsers.map(u => u.sessionId);
fs.writeFileSync(welcomedUsersFilePath, JSON.stringify(welcomedUsers, null, 2));
await loadAllRules();
await loadAllVariables();

if (stats.lastResetDate !== today) {
stats.todayUsers = [];
stats.todayMsgs = 0;
stats.lastResetDate = today;
await Stats.findByIdAndUpdate(stats._id, stats);
fs.writeFileSync(statsFilePath, JSON.stringify(stats, null, 2));
}

emitStats();
} catch (err) {
console.error("❌ Data sync error:", err);
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

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function emitStats() {
io.emit("statsUpdate", {
totalUsers: stats.totalUsers.length,
totalMsgs: stats.totalMsgs,
todayUsers: stats.todayUsers.length,
todayMsgs: stats.todayMsgs,
nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
});
}

// Random generation logic
const charSets = {
lower: 'abcdefghijklmnopqrstuvwxyz',
upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
num: '0123456789',
grawlix: '#$%&@*!'
};

function generateRandom(type, length, customSet) {
if (type === 'custom' && customSet) {
return pick(customSet);
}

let result = '';
let characters = '';
if (type === 'num') characters = charSets.num;
else if (type === 'lower') characters = charSets.lower;
else if (type === 'upper') characters = charSets.upper;
else if (type === 'abc') characters = charSets.lower + charSets.upper;
else if (type === 'abcnum_lower') characters = charSets.lower + charSets.num;
else if (type === 'abcnum_upper') characters = charSets.upper + charSets.num;
else if (type === 'abcnum') characters = charSets.lower + charSets.upper + charSets.num;
else if (type === 'grawlix') characters = charSets.grawlix;
else if (type === 'ascii') {
for (let i = 0; i < length; i++) {
result += String.fromCharCode(Math.floor(Math.random() * (127 - 33 + 1)) + 33);
}
return result;
}

if (!characters) return '';
for (let i = 0; i < length; i++) {
result += characters.charAt(Math.floor(Math.random() * characters.length));
}
return result;
}

// NEW: Convert literal \n to actual newlines BEFORE saving to DB
function convertNewlinesBeforeSave(text) {
if (!text) return '';
return text.replace(/\\n/g, '\n');
}

// Updated smartSplitTokens logic - REMOVED LOGS
function smartSplitTokens(tokensString) {
const tokens = tokensString.split(/,(?![^%]*%)/g).map(t => t.trim());
return tokens.filter(t => t !== '');
}

function pickNUniqueRandomly(tokens, count) {
const actualCount = Math.min(count, tokens.length);
if (actualCount === 0) return [];
if (actualCount === 1) {
const selected = pick(tokens);
return [selected];
}

const availableTokens = [...tokens];
const selectedTokens = [];
for (let i = 0; i < actualCount; i++) {
if (availableTokens.length === 0) break;
const randomIndex = Math.floor(Math.random() * availableTokens.length);
const selectedToken = availableTokens[randomIndex];
selectedTokens.push(selectedToken);
availableTokens.splice(randomIndex, 1);
}

return selectedTokens;
}

// Updated resolveVariablesRecursively function - REMOVED ALL VARIABLE PROCESSING LOGS
function resolveVariablesRecursively(text, maxIterations = 10) {
let result = text;
let iterationCount = 0;
const placeholderMap = new Map();
let placeholderCounter = 0;

const staticAndRandomRegex = /%(\w+)%/g;
result = result.replace(staticAndRandomRegex, (match) => {
const placeholder = `__VAR_PLACEHOLDER_${placeholderCounter++}__`;
placeholderMap.set(placeholder, match);
return placeholder;
});

while (iterationCount < maxIterations) {
let hasVariables = false;
let previousResult = result;

const customRandomRegex = /%rndm_custom_(\d+)_([^%]+)%/g;
result = result.replace(customRandomRegex, (fullMatch, countStr, tokensString) => {
const count = parseInt(countStr, 10);
const tokens = smartSplitTokens(tokensString);
if (tokens.length === 0) {
return '';
}

const selectedTokens = pickNUniqueRandomly(tokens, count);
let finalResult = selectedTokens.join(' ');
hasVariables = true;
return finalResult;
});

if (result === previousResult) {
break;
}

iterationCount++;
}

for (const [placeholder, originalVariable] of placeholderMap.entries()) {
const varName = originalVariable.replace(/%/g, '');
let varValue = '';

const staticVar = VARIABLES.find(v => v.name === varName);
if (staticVar) {
varValue = staticVar.value;
} else {
const otherRandomRegex = /%rndm_(\w+)_(\w+)(?:_([^%]+))?%/;
const match = originalVariable.match(otherRandomRegex);
if (match) {
const [fullMatch, type, param1, param2] = match;
if (type === 'num') {
const [min, max] = param1.split('_').map(Number);
varValue = Math.floor(Math.random() * (max - min + 1)) + min;
} else {
const length = parseInt(param1);
varValue = generateRandom(type, length);
}
}
}

result = result.split(placeholder).join(varValue);
}

return result;
}

async function processMessage(msg, sessionId = "default") {
console.log(`🔄 PROCESSING MESSAGE START - Session: ${sessionId}, Message: "${msg}"`);

const originalMsg = msg;
msg = msg.toLowerCase();
console.log(`🔄 Message converted to lowercase: "${msg}"`);

// Update Stats
console.log(`📊 Updating stats for session: ${sessionId}`);
if (!stats.totalUsers.includes(sessionId)) {
stats.totalUsers.push(sessionId);
console.log(`➕ New user added: ${sessionId}`);
}
if (!stats.todayUsers.includes(sessionId)) {
stats.todayUsers.push(sessionId);
console.log(`➕ Today's new user: ${sessionId}`);
}
stats.totalMsgs++;
stats.todayMsgs++;
console.log(`📈 Stats updated - Total: ${stats.totalMsgs}, Today: ${stats.todayMsgs}`);

if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) {
stats.nobiPapaHideMeUsers.push(sessionId);
console.log(`🙈 User hidden: ${sessionId}`);
}

const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
stats = updatedStats;
saveStats();
emitStats();

// Match Rules
console.log(`🔍 Checking ${RULES.length} rules for matches`);
let reply = null;

for (let rule of RULES) {
console.log(`🔍 Checking Rule #${rule.RULE_NUMBER}: ${rule.RULE_NAME || 'Unnamed'}`);
console.log(`📋 Rule Type: ${rule.RULE_TYPE}, Keywords: ${rule.KEYWORDS}`);

let userMatch = false;
const targetUsers = rule.TARGET_USERS || "ALL";

if (rule.RULE_TYPE === "IGNORED") {
if (Array.isArray(targetUsers) && !targetUsers.includes(sessionId)) {
userMatch = true;
console.log(`✅ IGNORED rule matched for user: ${sessionId}`);
}
} else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(sessionId))) {
userMatch = true;
console.log(`✅ User permission matched: ${sessionId}`);
}

if (!userMatch) {
console.log(`❌ User permission not matched for Rule #${rule.RULE_NUMBER}`);
continue;
}

let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
let match = false;

if (rule.RULE_TYPE === "WELCOME") {
if (!welcomedUsers.includes(sessionId)) {
match = true;
welcomedUsers.push(sessionId);
saveWelcomedUsers();
await User.create({ sessionId });
console.log(`🎉 WELCOME rule matched for new user: ${sessionId}`);
} else {
console.log(`⏭️ User already welcomed: ${sessionId}`);
}
} else if (rule.RULE_TYPE === "DEFAULT") {
match = true;
console.log(`📝 DEFAULT rule matched`);
} else {
for (let pattern of patterns) {
console.log(`🔍 Testing pattern: "${pattern}" against message: "${msg}"`);

if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg) {
match = true;
console.log(`✅ EXACT match found: "${pattern}" === "${msg}"`);
} else if (rule.RULE_TYPE === "PATTERN") {
let regexStr = pattern.replace(/\*/g, ".*");
if (new RegExp(`^${regexStr}$`, "i").test(msg)) {
match = true;
console.log(`✅ PATTERN match found: regex "${regexStr}" matched "${msg}"`);
}
} else if (rule.RULE_TYPE === "EXPERT") {
try {
if (new RegExp(pattern, "i").test(msg)) {
match = true;
console.log(`✅ EXPERT regex match found: "${pattern}" matched "${msg}"`);
}
} catch (error) {
console.log(`❌ Invalid EXPERT regex: "${pattern}"`);
}
}

if (match) break;
}
}

if (match) {
console.log(`🎯 RULE MATCHED! Rule #${rule.RULE_NUMBER}: ${rule.RULE_NAME || 'Unnamed'}`);
let replies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
console.log(`📝 Available replies: ${replies.length}`);

if (rule.REPLIES_TYPE === "ALL") {
replies = replies.slice(0, 20);
reply = replies.join(" ");
console.log(`📝 Using ALL replies (${replies.length})`);
} else if (rule.REPLIES_TYPE === "ONE") {
reply = replies[0];
console.log(`📝 Using FIRST reply: "${reply}"`);
} else {
reply = pick(replies);
console.log(`📝 Using RANDOM reply: "${reply}"`);
}
break;
} else {
console.log(`❌ No match for Rule #${rule.RULE_NUMBER}`);
}
}

// Process reply with variables (REMOVED DETAILED VARIABLE LOGS)
if (reply) {
reply = resolveVariablesRecursively(reply);
} else {
console.log(`❌ No matching rule found for message: "${originalMsg}"`);
}

console.log(`🔄 PROCESSING MESSAGE END - Final Reply: ${reply || 'null'}`);
return reply || null;
}

// Initial Load
(async () => {
await mongoose.connection.once('open', async () => {
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
fs.mkdirSync(dataDir, { recursive: true });
}

const files = [
{ path: path.join(dataDir, "stats.json"), content: { totalUsers: [], todayUsers: [], totalMsgs: 0, todayMsgs: 0, nobiPapaHideMeUsers: [], lastResetDate: today } },
{ path: path.join(dataDir, "welcomed_users.json"), content: [] },
{ path: path.join(dataDir, "funrules.json"), content: { rules: [] } },
{ path: path.join(dataDir, "variables.json"), content: [] }
];

files.forEach(file => {
if (!fs.existsSync(file.path)) {
fs.writeFileSync(file.path, JSON.stringify(file.content, null, 2));
}
});

await syncData();
scheduleDailyReset();
});
})();

// Bulk Update Rules API Call with \n conversion
app.post("/api/rules/bulk-update", async (req, res) => {
const session = await mongoose.startSession();
try {
await session.withTransaction(async () => {
const { rules } = req.body;
if (!Array.isArray(rules) || rules.length === 0) {
throw new Error('Invalid rules data - must be an array');
}

const tempBulkOps = rules.map((rule, index) => ({
updateOne: {
filter: { _id: new mongoose.Types.ObjectId(rule._id) },
update: { $set: { RULE_NUMBER: -(index + 1000) } },
upsert: false
}
}));

if (tempBulkOps.length > 0) {
await Rule.bulkWrite(tempBulkOps, { session, ordered: true });
}

const finalBulkOps = rules.map(rule => ({
updateOne: {
filter: { _id: new mongoose.Types.ObjectId(rule._id) },
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
const finalResult = await Rule.bulkWrite(finalBulkOps, { session, ordered: true });
if (finalResult.modifiedCount !== rules.length) {
throw new Error(`Expected ${rules.length} updates, but only ${finalResult.modifiedCount} succeeded`);
}
}
});

await session.endSession();
await loadAllRules();

const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));

res.json({
success: true,
message: `${req.body.rules.length} rules reordered successfully`,
updatedCount: req.body.rules.length,
totalCount: req.body.rules.length
});

io.emit('rulesUpdated', {
action: 'bulk_reorder_atomic',
count: req.body.rules.length,
newOrder: RULES.map(r => ({ id: r._id, number: r.RULE_NUMBER, name: r.RULE_NAME }))
});
} catch (error) {
console.error('❌ Atomic bulk update failed:', error);
if (session.inTransaction()) {
await session.abortTransaction();
}
await session.endSession();
res.json({
success: false,
message: 'Failed to reorder rules atomically: ' + error.message
});
}
});

app.get("/api/rules", async (req, res) => {
try {
const rules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
res.json(rules);
} catch (err) {
res.status(500).json({ error: "Failed to fetch rules" });
}
});

app.post("/api/rules/update", async (req, res) => {
const { type, rule, oldRuleNumber } = req.body;
try {
if (type === "add") {
const existingRule = await Rule.findOne({ RULE_NUMBER: rule.ruleNumber });
if (existingRule) {
await Rule.updateMany(
{ RULE_NUMBER: { $gte: rule.ruleNumber } },
{ $inc: { RULE_NUMBER: 1 } }
);
}

await Rule.create({
RULE_NUMBER: rule.ruleNumber,
RULE_NAME: rule.ruleName,
RULE_TYPE: rule.ruleType,
KEYWORDS: rule.keywords,
REPLIES_TYPE: rule.repliesType,
REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
TARGET_USERS: rule.targetUsers
});
} else if (type === "edit") {
if (rule.ruleNumber !== oldRuleNumber) {
if (rule.ruleNumber < oldRuleNumber) {
await Rule.updateMany(
{ RULE_NUMBER: { $gte: rule.ruleNumber, $lt: oldRuleNumber } },
{ $inc: { RULE_NUMBER: 1 } }
);
} else {
await Rule.updateMany(
{ RULE_NUMBER: { $gt: oldRuleNumber, $lte: rule.ruleNumber } },
{ $inc: { RULE_NUMBER: -1 } }
);
}
}

await Rule.findOneAndUpdate(
{ RULE_NUMBER: oldRuleNumber },
{
RULE_NUMBER: rule.ruleNumber,
RULE_NAME: rule.ruleName,
RULE_TYPE: rule.ruleType,
KEYWORDS: rule.keywords,
REPLIES_TYPE: rule.repliesType,
REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
TARGET_USERS: rule.targetUsers
},
{ new: true }
);
} else if (type === "delete") {
await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber });
await Rule.updateMany(
{ RULE_NUMBER: { $gt: rule.ruleNumber } },
{ $inc: { RULE_NUMBER: -1 } }
);
}

const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
fs.writeFileSync(path.join(__dirname, "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));
await loadAllRules();

res.json({ success: true, message: "Rule updated successfully!" });
io.emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
} catch (err) {
console.error("❌ Failed to update rule:", err);
res.status(500).json({ success: false, message: "Server error" });
}
});

app.get("/api/variables", async (req, res) => {
try {
const variables = await Variable.find({});
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

if (type === "add") {
await Variable.create(processedVariable);
} else if (type === "edit") {
await Variable.findOneAndUpdate({ name: oldName }, processedVariable, { new: true });
} else if (type === "delete") {
await Variable.deleteOne({ name: variable.name });
}

await loadAllVariables();
const variablesFromDB = await Variable.find({});
fs.writeFileSync(variablesFilePath, JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));

res.json({ success: true, message: "Variable updated successfully!" });
io.emit('variablesUpdated', { action: type, variableName: variable.name });
} catch (err) {
console.error("❌ Failed to update variable:", err);
res.status(500).json({ success: false, message: "Server error" });
}
});

// UPDATED WEBHOOK WITH DETAILED LOGGING
app.post("/webhook", async (req, res) => {
console.log("📨 INCOMING WEBHOOK REQUEST:", JSON.stringify(req.body, null, 2));
console.log("🕐 Request Timestamp:", new Date().toISOString());

const sessionId = req.body.session_id || "default_session";
const msg = req.body.query?.message || "";

console.log("🔑 Session ID:", sessionId);
console.log("💬 Raw Message:", msg);
console.log("📏 Message Length:", msg.length);

const replyText = await processMessage(msg, sessionId);

if (!replyText) {
console.log("❌ NO REPLY GENERATED");
const emptyResponse = { replies: [] };
console.log("📤 SENDING EMPTY RESPONSE:", JSON.stringify(emptyResponse, null, 2));
console.log("🕐 Response Timestamp:", new Date().toISOString());
console.log("➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖");
return res.json(emptyResponse);
}

console.log("✅ REPLY GENERATED:", replyText);
console.log("📏 Reply Length:", replyText.length);

const responsePayload = { replies: [{ message: replyText }] };
console.log("📤 SENDING RESPONSE:", JSON.stringify(responsePayload, null, 2));
console.log("🕐 Response Timestamp:", new Date().toISOString());
console.log("➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖➖");

res.json(responsePayload);
});

app.get("/stats", (req, res) => {
res.json({
totalUsers: stats.totalUsers.length,
totalMsgs: stats.totalMsgs,
todayUsers: stats.todayUsers.length,
todayMsgs: stats.todayMsgs,
nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
});
});

app.use(express.static("public"));

app.get("/ping", (req, res) => res.send("🏓 PING OK!"));

app.get("/", (req, res) => res.send("🤖 FRIENDLY CHAT BOT IS LIVE!"));

server.listen(PORT, () => console.log(`🤖 CHAT BOT RUNNING ON PORT ${PORT}`));

let pinging = false;
setInterval(async () => {
if (pinging) return;
pinging = true;
try {
await axios.get(`${SERVER_URL}/ping`);
console.log("🔁 Self-ping sent!");
} catch (err) {
console.log("❌ Ping failed:", err.message);
}
pinging = false;
}, 5 * 60 * 1000);
