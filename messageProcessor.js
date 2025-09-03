// file: messageProcessor.js

const {
    pick,
    resolveVariablesRecursively,
    extractSenderNameAndContext,
    matchesOverridePattern,
    isUserIgnored,
    matchesTrigger,
    pickRandomReply
} = require("./utils");
const { User, Stats, MessageStats } = require("./db");
const {
    stats,
    welcomedUsers,
    RULES,
    VARIABLES,
    IGNORED_OVERRIDE_USERS,
    SPECIFIC_OVERRIDE_USERS,
    settings,
    saveStats,
    saveIgnoredOverrideUsers,
} = require("./dataManager");

const messageHistory = [];
const MAX_HISTORY = 50;
let lastReplyTimes = {};

async function processMessage(msg, sessionId = "default", sender) {
    const startTime = process.hrtime();
    const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);

    if (SPECIFIC_OVERRIDE_USERS.length > 0 && !matchesOverridePattern(senderName, SPECIFIC_OVERRIDE_USERS)) {
        console.log(`⚠️ User "${senderName}" is not on the specific override list. Ignoring message.`);
        return null;
    }

    if (!stats) {
        console.error('❌ Stats object is undefined. Cannot process message.');
        return null;
    }

    if (!settings.isBotOnline) {
        console.log('🤖 Bot is offline. Skipping message processing.');
        return null;
    }

    const context = isGroup ? groupName : 'DM';
    console.log(`🔍 Processing message from: ${senderName} (Context: ${context})`);

    let unhideTriggered = false;
    if (settings.temporaryHide.unhideEnabled) {
        if (matchesTrigger(msg, settings.temporaryHide.unhideTriggerText, settings.temporaryHide.unhideMatchType)) {
            console.log(`✅ Unhide trigger received from user: ${senderName}`);
            const initialIgnoredCount = IGNORED_OVERRIDE_USERS.length;
            IGNORED_OVERRIDE_USERS = IGNORED_OVERRIDE_USERS.filter(item => {
                const nameMatches = matchesOverridePattern(senderName, [item.name]);
                const contextMatches = matchesOverridePattern(context, [item.context]);
                return !(nameMatches && contextMatches);
            });
            if (IGNORED_OVERRIDE_USERS.length < initialIgnoredCount) {
                await saveIgnoredOverrideUsers();
                console.log(`👤 User "${senderName}" has been unhidden in context "${context}".`);
                unhideTriggered = true;
            } else {
                console.log(`⚠️ User "${senderName}" was not in the temporary hide list for context "${context}".`);
            }
        }
    }

    let temporaryHideTriggered = false;
    if (settings.temporaryHide.enabled) {
        if (matchesTrigger(msg, settings.temporaryHide.triggerText, settings.temporaryHide.matchType)) {
            temporaryHideTriggered = true;
            console.log(`✅ Hide trigger received from user: ${senderName}`);
        }
    }

    const isSenderIgnored = isUserIgnored(senderName, context, IGNORED_OVERRIDE_USERS);

    if (temporaryHideTriggered) {
        const reply = pickRandomReply(settings.temporaryHide.hideReply, senderName, msg, 0, groupName, isGroup, VARIABLES, messageHistory);
        const hideEntry = { name: senderName, context: context };
        const isAlreadyIgnoredInContext = IGNORED_OVERRIDE_USERS.some(item => item.name === hideEntry.name && item.context === hideEntry.context);
        if (!isAlreadyIgnoredInContext) {
            IGNORED_OVERRIDE_USERS.push(hideEntry);
            await saveIgnoredOverrideUsers();
            console.log(`👤 User "${senderName}" has been temporarily hidden in context "${context}".`);
        }
        return reply;
    }

    if (unhideTriggered) {
        const reply = pickRandomReply(settings.temporaryHide.unhideReply, senderName, msg, 0, groupName, isGroup, VARIABLES, messageHistory);
        return reply;
    }

    if (isSenderIgnored && !unhideTriggered) {
        console.log(`🚫 User "${senderName}" is ignored in context "${context}". Skipping reply.`);
        return null;
    }

    let messageStats = await MessageStats.findOne({ sessionId: sessionId });
    const today = new Date().toLocaleDateString();

    if (!messageStats) {
        messageStats = new MessageStats({
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

    if (!welcomedUsers.includes(senderName)) {
        welcomedUsers.push(senderName);
        await User.create({ senderName, sessionId });
    }

    if (!stats.todayUsers.includes(senderName)) {
        stats.todayUsers.push(senderName);
    }

    stats.totalMsgs++;
    stats.todayMsgs++;

    if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

    const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
    Object.assign(stats, updatedStats.toObject());
    saveStats();

    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of RULES) {
        let userMatch = false;
        const targetUsers = rule.TARGET_USERS || "ALL";

        if (rule.RULE_TYPE === "IGNORED") {
            if (Array.isArray(targetUsers) && !targetUsers.includes(senderName)) {
                userMatch = true;
            }
        } else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(senderName))) {
            if (isSenderIgnored && !unhideTriggered) {
                userMatch = false;
            } else {
                userMatch = true;
            }
        }

        if (!userMatch) {
            continue;
        }

        let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
        let match = false;

        if (rule.RULE_TYPE === "WELCOME") {
            if (senderName && !welcomedUsers.includes(senderName)) {
                match = true;
                welcomedUsers.push(senderName);
                await User.create({ senderName, sessionId });
            }
        } else if (rule.RULE_TYPE === "DEFAULT") {
            match = true;
        } else {
            for (let pattern of patterns) {
                if (pattern.toUpperCase() === 'DM_ONLY' && isGroup) {
                    continue;
                } else if (pattern.toUpperCase() === 'GROUP_ONLY' && !isGroup) {
                    continue;
                }
                if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg.toLowerCase()) match = true;
                else if (rule.RULE_TYPE === "PATTERN") {
                    let regexStr = pattern.replace(/\*/g, ".*");
                    if (new RegExp(`^${regexStr}$`, "i").test(message)) match = true;
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
            let replies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
            if (rule.REPLIES_TYPE === "ALL") {
                replies = replies.slice(0, 20);
                reply = replies.join(" ");
            } else if (rule.REPLIES_TYPE === "ONE") {
                reply = replies[0];
            } else {
                reply = pick(replies);
            }
            break;
        }
    }

    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);

    if (reply) {
        console.log(`🔧 Processing reply with correct variable resolution order`);
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, groupName, isGroup, VARIABLES, messageHistory, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);
        lastReplyTimes[senderName] = Date.now();
        messageStats.replyCount++;
        if (matchedRuleId) {
            const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
            messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
        }
        await messageStats.save();
    }

    messageHistory.unshift({
        userMessage: msg,
        botReply: reply,
        ruleId: matchedRuleId,
        timestamp: new Date().toISOString()
    });
    if (messageHistory.length > MAX_HISTORY) {
        messageHistory.pop();
    }
    
    return reply || null;
}

module.exports = {
    processMessage,
    messageHistory
};