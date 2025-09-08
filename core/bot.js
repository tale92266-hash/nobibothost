// file: core/bot.js

const {
getRules, getOwnerRules, getAutomationRules, getWelcomedUsers, getSettings, getIgnoredOverrideUsers,
getOwnerList, setIgnoredOverrideUsers, setWelcomedUsers, getStats, getMessageHistory,
setMessageHistory, setLastReplyTimes, getLastReplyTimes, setStats, getSpecificOverrideUsers,
getIsAutomationEnabled, setIsAutomationEnabled, getWelcomeLog, addWelcomeLogEntry,
ruleCooldowns
} = require('./state');

const { db } = require('../db');
const axios = require('axios');

const {
resolveVariablesRecursively, extractSenderNameAndContext, matchesOverridePattern,
isUserIgnored, matchesTrigger, pick
} = require('./utils');

let ioInstance = null;

const setIOInstance = (io) => {
ioInstance = io;
};

// New function to send replies with delay directly to the autoresponder app's API
const sendDelayedReplies = async (replies, delaySeconds, sessionId, senderName, groupName, isGroup) => {
    // Assuming the autoresponder app has an API endpoint to send messages
    const sendEndpoint = process.env.AUTORESPONDER_API_ENDPOINT; // This needs to be defined in your .env file
    
    for (let i = 0; i < replies.length; i++) {
        await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        
        try {
            const replyMessage = resolveVariablesRecursively(replies[i], senderName, '', 0, groupName, isGroup);
            await axios.post(sendEndpoint, {
                sessionId: sessionId,
                recipient: senderName,
                message: replyMessage
            });
            console.log(`⏰ Delayed reply ${i + 2}/${replies.length + 1} sent successfully to autoresponder.`);
        } catch (error) {
            console.error(`❌ Failed to send delayed reply ${i + 2}/${replies.length + 1}:`, error.message);
        }
    }
};

async function processMessage(msg, sessionId = "default", sender) {
const startTime = process.hrtime();
const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);
const context = isGroup ? groupName : 'DM';
const isOwner = getOwnerList().includes(senderName);

if (getSpecificOverrideUsers().length > 0 && !matchesOverridePattern(senderName, getSpecificOverrideUsers())) {
console.log(`⚠️ User "${senderName}" is not on the specific override list. Ignoring message.`);
return null;
}

if (!getSettings().isBotOnline) {
console.log('🤖 Bot is offline. Skipping message processing.');
return null;
}

if (!getStats()) {
console.error('❌ Stats object is undefined. Cannot process message.');
return null;
}

const settings = getSettings();
const today = new Date().toLocaleDateString();

if (settings.masterStop.enabled && matchesTrigger(msg, settings.masterStop.triggerText, settings.masterStop.matchType)) {
console.log(`⛔ Master stop trigger received from user: ${senderName}`);
if (getIsAutomationEnabled()) {
setIsAutomationEnabled(false);
ruleCooldowns.clear();
console.log('🛑 All automation rules have been stopped.');
}

const reply = pick(settings.masterStop.replyText.split('<#>'));
return { replies: [resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup)] };
}

if (settings.temporaryHide.unhideEnabled && matchesTrigger(msg, settings.temporaryHide.unhideTriggerText, settings.temporaryHide.unhideMatchType)) {
console.log(`✅ Unhide trigger received from user: ${senderName}`);
const updatedIgnoredUsers = getIgnoredOverrideUsers().filter(item => {
const nameMatches = matchesOverridePattern(senderName, [item.name]);
const contextMatches = matchesOverridePattern(context, [item.context]);
return !(nameMatches && contextMatches);
});

if (updatedIgnoredUsers.length < getIgnoredOverrideUsers().length) {
setIgnoredOverrideUsers(updatedIgnoredUsers);
await db.saveIgnoredOverrideUsers();
console.log(`👤 User "${senderName}" has been unhidden in context "${context}".`);
const reply = pick(settings.temporaryHide.unhideReply.split('<#>'));
return { replies: [resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup)] };
} else {
console.log(`⚠️ User "${senderName}" was not in the temporary hide list for context "${context}".`);
return null;
}
}

if (settings.temporaryHide.enabled && matchesTrigger(msg, settings.temporaryHide.triggerText, settings.temporaryHide.unhideMatchType)) {
console.log(`✅ Hide trigger received from user: ${senderName}`);
const reply = pick(settings.temporaryHide.hideReply.split('<#>'));
const hideEntry = { name: senderName, context: context };
const isAlreadyIgnoredInContext = getIgnoredOverrideUsers().some(item => item.name === hideEntry.name && item.context === hideEntry.context);

if (!isAlreadyIgnoredInContext) {
const currentIgnoredUsers = getIgnoredOverrideUsers();
currentIgnoredUsers.push(hideEntry);
setIgnoredOverrideUsers(currentIgnoredUsers);
await db.saveIgnoredOverrideUsers();
console.log(`👤 User "${senderName}" has been temporarily hidden in context "${context}".`);
}

return { replies: [resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup)] };
}

const isSenderIgnored = isUserIgnored(senderName, context, getIgnoredOverrideUsers());
if (isSenderIgnored) {
console.log(`🚫 User "${senderName}" is ignored in context "${context}". Skipping reply.`);
return null;
}

console.log(`🔍 Processing message from: ${senderName} (Context: ${context})`);

let stats = getStats();
let messageStats = await db.MessageStats.findOne({ sessionId });
if (!messageStats) {
messageStats = new db.MessageStats({
sessionId,
senderName,
isGroup,
groupName: isGroup ? groupName : null,
lastActiveDate: today
});
} else {
if (messageStats.lastActiveDate !== today) {
messageStats.lastActiveDate = today;
messageStats.receivedCount = 0;
}
}

messageStats.receivedCount++;
await messageStats.save();

if (!stats.todayUsers.includes(senderName)) { stats.todayUsers.push(senderName); }
stats.totalMsgs++;
stats.todayMsgs++;
if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

const updatedStats = await db.Stats.findByIdAndUpdate(stats._id, stats, { new: true });
setStats(updatedStats);
await db.saveStats();

let replies = null;
let regexMatch = null;
let matchedRuleId = null;
let replyDelay = 0;
let enableDelay = false;

const automationRules = getAutomationRules();
if (getIsAutomationEnabled() && msg.startsWith('/') && automationRules.length > 0) {
for (const rule of automationRules) {
const cooldownKey = `${sessionId}-${rule.RULE_NUMBER}`;
if (ruleCooldowns.has(cooldownKey) && Date.now() < ruleCooldowns.get(cooldownKey)) {
console.log(`🚫 Automation rule "${rule.RULE_NAME}" is on cooldown for this user.`);
continue;
}

let userCanRun = false;
switch (rule.USER_ACCESS_TYPE) {
case 'ALL':
userCanRun = true;
break;
case 'OWNER':
userCanRun = isOwner;
break;
case 'OWNER_IGNORED':
userCanRun = isOwner || isSenderIgnored;
break;
case 'OWNER_DEFINED':
userCanRun = isOwner || rule.DEFINED_USERS.includes(senderName);
break;
case 'IGNORED':
userCanRun = isSenderIgnored;
break;
case 'DEFINED':
userCanRun = rule.DEFINED_USERS.includes(senderName);
break;
}

if (userCanRun && matchesTrigger(msg, rule.KEYWORDS, rule.RULE_TYPE)) {
let ruleReplies = rule.REPLY_TEXT.split('<#>').map(r => r.trim()).filter(Boolean);
const resolvedReplies = ruleReplies.map(r => resolveVariablesRecursively(r, senderName, msg, 0, groupName, isGroup, regexMatch, rule.RULE_NUMBER, stats.totalMsgs, messageStats));

if (rule.REPLIES_TYPE === 'ALL') {
replies = resolvedReplies;
enableDelay = rule.ENABLE_DELAY;
replyDelay = rule.REPLY_DELAY;
} else if (rule.REPLIES_TYPE === 'ONE') { replies = [resolvedReplies[0]]; }
else { replies = [pick(resolvedReplies)]; }

if (rule.MIN_DELAY > 0) {
let delay = rule.MIN_DELAY;
if (rule.MAX_DELAY && rule.MAX_DELAY > rule.MIN_DELAY) {
delay = Math.floor(Math.random() * (rule.MAX_DELAY - rule.MIN_DELAY + 1)) + rule.MIN_DELAY;
}

console.log(`⏰ Applying a delay of ${delay} seconds for automation rule.`);
await new Promise(res => setTimeout(res, delay * 1000));
}

if (rule.COOLDOWN > 0) {
const cooldownTime = Date.now() + (rule.COOLDOWN * 1000);
ruleCooldowns.set(cooldownKey, cooldownTime);
console.log(`⏱️ Automation rule "${rule.RULE_NAME}" put on cooldown for ${rule.COOLDOWN} seconds.`);
}

matchedRuleId = rule.RULE_NUMBER;
break;
}
}
}

if (!replies && isOwner) {
console.log(`👑 Owner message detected from: ${senderName}. Checking owner rules.`);
for (let rule of getOwnerRules()) {
const cooldownKey = `${sessionId}-${rule.RULE_NUMBER}`;
if (rule.COOLDOWN > 0 && ruleCooldowns.has(cooldownKey) && Date.now() < ruleCooldowns.get(cooldownKey)) {
console.log(`🚫 Owner rule "${rule.RULE_NAME}" is on cooldown for this user.`);
continue;
}

let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
let match = false;

if (rule.RULE_TYPE === "WELCOME") {
const hasBeenWelcomed = getWelcomeLog().has(`${senderName}-${rule.RULE_NUMBER}-${context}`);
if (!hasBeenWelcomed) { match = true; }
} else if (rule.RULE_TYPE === "EXACT" && patterns.some(p => p.toLowerCase() === msg.toLowerCase())) { match = true; }
else if (rule.RULE_TYPE === "PATTERN" && patterns.some(p => new RegExp(`^${p.replace(/\*/g, ".*")}$`, "i").test(msg))) { match = true; }
else if (rule.RULE_TYPE === "EXPERT") {
for (let pattern of patterns) {
try {
const regex = new RegExp(pattern, "i");
const execResult = regex.exec(msg);
if (execResult) {
match = true;
regexMatch = execResult;
break;
}
} catch {}
}
} else if (rule.RULE_TYPE === "DEFAULT") { match = true; }

if (match) {
let ruleReplies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
const resolvedReplies = ruleReplies.map(r => resolveVariablesRecursively(r, senderName, msg, 0, groupName, isGroup, regexMatch, rule.RULE_NUMBER, stats.totalMsgs, messageStats));

if (rule.MIN_DELAY > 0 || rule.MAX_DELAY > 0) {
let delay = rule.MIN_DELAY;
if (rule.MAX_DELAY > rule.MIN_DELAY) {
delay = Math.floor(Math.random() * (rule.MAX_DELAY - rule.MIN_DELAY + 1)) + rule.MIN_DELAY;
}
console.log(`⏰ Applying a delay of ${delay} seconds for owner rule.`);
await new Promise(res => setTimeout(res, delay * 1000));
}

if (rule.REPLIES_TYPE === 'ALL') {
replies = resolvedReplies;
enableDelay = true;
replyDelay = 0; // The per-reply delay is handled by the initial delay setting, not a separate field here.
} else if (rule.REPLIES_TYPE === 'ONE') { replies = [resolvedReplies[0]]; }
else { replies = [pick(resolvedReplies)]; }

if (rule.COOLDOWN > 0) {
const cooldownTime = Date.now() + (rule.COOLDOWN * 1000);
ruleCooldowns.set(cooldownKey, cooldownTime);
console.log(`⏱️ Owner rule "${rule.RULE_NAME}" put on cooldown for ${rule.COOLDOWN} seconds.`);
}

matchedRuleId = rule.RULE_NUMBER;

if (rule.RULE_TYPE === "WELCOME") {
addWelcomeLogEntry(rule.RULE_NUMBER, senderName, context);
await db.saveWelcomeLog();
console.log(`✅ Owner "${senderName}" welcomed with rule #${rule.RULE_NUMBER} in context "${context}".`);
}

break;
}
}
}

if (!replies && !isOwner) {
console.log(`🔍 Checking normal rules.`);
const welcomedUsers = getWelcomedUsers();

for (let rule of getRules()) {
const cooldownKey = `${sessionId}-${rule.RULE_NUMBER}`;
if (rule.COOLDOWN > 0 && ruleCooldowns.has(cooldownKey) && Date.now() < ruleCooldowns.get(cooldownKey)) {
console.log(`🚫 Normal rule "${rule.RULE_NAME}" is on cooldown for this user.`);
continue;
}

let userMatch = false;
const targetUsers = rule.TARGET_USERS || "ALL";

if (rule.RULE_TYPE === "IGNORED") {
if (Array.isArray(targetUsers) && !targetUsers.includes(senderName)) { userMatch = true; }
} else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(senderName))) {
if (isSenderIgnored) { userMatch = false; }
else { userMatch = true; }
}

if (!userMatch) { continue; }

let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
let match = false;

if (rule.RULE_TYPE === "WELCOME") {
if (senderName && !welcomedUsers.includes(senderName)) {
match = true;
const newWelcomedUsers = [...welcomedUsers, senderName];
setWelcomedUsers(newWelcomedUsers);
await db.User.create({ senderName, sessionId });
}
} else if (rule.RULE_TYPE === "DEFAULT") {
match = true;
} else {
for (let pattern of patterns) {
if (pattern.toUpperCase() === 'DM_ONLY' && isGroup) { continue; }
else if (pattern.toUpperCase() === 'GROUP_ONLY' && !isGroup) { continue; }

if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg.toLowerCase()) match = true;
else if (rule.RULE_TYPE === "PATTERN") {
let regexStr = pattern.replace(/\*/g, ".*");
if (new RegExp(`^${regexStr}$`, "i").test(msg)) match = true;
} else if (rule.RULE_TYPE === "EXPERT") {
try {
const regex = new RegExp(pattern, "i");
const execResult = regex.exec(msg);
if (execResult) {
match = true;
regexMatch = execResult;
}
} catch {}
}

if (match) {
matchedRuleId = rule.RULE_NUMBER;
break;
}
}
}

if (match) {
let ruleReplies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
const resolvedReplies = ruleReplies.map(r => resolveVariablesRecursively(r, senderName, msg, 0, groupName, isGroup, regexMatch, rule.RULE_NUMBER, stats.totalMsgs, messageStats));

if (rule.MIN_DELAY > 0 || rule.MAX_DELAY > 0) {
let delay = rule.MIN_DELAY;
if (rule.MAX_DELAY > rule.MIN_DELAY) {
delay = Math.floor(Math.random() * (rule.MAX_DELAY - rule.MIN_DELAY + 1)) + rule.MIN_DELAY;
}
console.log(`⏰ Applying a delay of ${delay} seconds for normal rule.`);
await new Promise(res => setTimeout(res, delay * 1000));
}

if (rule.REPLIES_TYPE === 'ALL') {
replies = resolvedReplies;
enableDelay = true;
replyDelay = 0; // The per-reply delay is handled by the initial delay setting, not a separate field here.
} else if (rule.REPLIES_TYPE === 'ONE') { replies = [resolvedReplies[0]]; }
else { replies = [pick(resolvedReplies)]; }

if (rule.COOLDOWN > 0) {
const cooldownTime = Date.now() + (rule.COOLDOWN * 1000);
ruleCooldowns.set(cooldownKey, cooldownTime);
console.log(`⏱️ Normal rule "${rule.RULE_NAME}" put on cooldown for ${rule.COOLDOWN} seconds.`);
}

break;
}
}
}

const endTime = process.hrtime(startTime);
const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);

let replyToReturn = null;

if (replies) {
    if (replies.replies && replies.enableDelay && replies.replyDelay > 0) {
        // Separate first reply and remaining replies
        const firstReply = replies.replies[0];
        const remainingReplies = replies.replies.slice(1);
        
        if (remainingReplies.length > 0) {
            // Schedule remaining replies to be sent in the background
            sendDelayedReplies(remainingReplies, replies.replyDelay, sessionId, senderName, groupName, isGroup);
        }
        
        replyToReturn = [firstReply]; // Return an array with the first reply for immediate webhook response
    } else {
        replyToReturn = replies.replies || replies; // Return all replies at once
    }
}

// Map the replies to resolve variables for the final return
if (replyToReturn) {
    const replyArray = Array.isArray(replyToReturn) ? replyToReturn : [replyToReturn];
    const resolvedRepliesForHistory = replyArray.map(r => {
        if (typeof r === 'string') {
            return resolveVariablesRecursively(r, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);
        }
        return r;
    });

    const lastReplyTimes = getLastReplyTimes();
    lastReplyTimes[senderName] = Date.now();
    setLastReplyTimes(lastReplyTimes);

    messageStats.replyCount++;
    if (matchedRuleId) {
        const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
        messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
    }
    await messageStats.save();

    let messageHistory = getMessageHistory();
    messageHistory.unshift({
        userMessage: msg,
        botReply: resolvedRepliesForHistory,
        ruleId: matchedRuleId,
        timestamp: new Date().toISOString()
    });

    const MAX_HISTORY = 50;
    if (messageHistory.length > MAX_HISTORY) { messageHistory.pop(); }
    setMessageHistory(messageHistory);

    // This is the messageData for the live chat
    const messageData = {
        sessionId: sessionId,
        senderName: senderName,
        groupName: isGroup ? groupName : null,
        userMessage: msg,
        botReply: resolvedRepliesForHistory,
        timestamp: new Date().toISOString()
    };
    if (ioInstance) {
        ioInstance.emit('newMessage', messageData);
    }
}

return replyToReturn || null;
}

exports.processMessage = processMessage;
exports.setIOInstance = setIOInstance;