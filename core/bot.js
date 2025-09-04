// file: core/bot.js

const {
    getRules,
    getOwnerRules,
    getWelcomedUsers,
    getSettings,
    getIgnoredOverrideUsers,
    getOwnerList,
    setIgnoredOverrideUsers,
    setWelcomedUsers,
    getStats,
    getMessageHistory,
    setLastReplyTimes,
    setStats,
    getLastReplyTimes
} = require('./state');
const {
    db
} = require('../db');
const {
    resolveVariablesRecursively,
    extractSenderNameAndContext,
    matchesOverridePattern,
    isUserIgnored,
    matchesTrigger,
    pick
} = require('./utils');

const messageHistory = getMessageHistory();

async function processOwnerMessage(msg, sessionId, sender, senderName) {
    const startTime = process.hrtime();
    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of getOwnerRules()) {
        let patterns = rule.KEYWORDS.split("//").map(p => p.trim()).filter(Boolean);
        let match = false;

        if (rule.RULE_TYPE === "EXACT" && patterns.some(p => p.toLowerCase() === msg.toLowerCase())) {
            match = true;
        } else if (rule.RULE_TYPE === "PATTERN" && patterns.some(p => new RegExp(`^${p.replace(/\*/g, ".*")}$`, "i").test(msg))) {
            match = true;
        } else if (rule.RULE_TYPE === "EXPERT") {
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
        } else if (rule.RULE_TYPE === "WELCOME") {
            if (senderName && !getWelcomedUsers().includes(senderName)) {
                match = true;
            }
        } else if (rule.RULE_TYPE === "DEFAULT") {
            match = true;
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
            matchedRuleId = rule.RULE_NUMBER;
            break;
        }
    }
    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);
    
    if (reply) {
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, null, false, regexMatch, matchedRuleId, getStats().totalMsgs);
    }
    
    return reply || null;
}

async function processMessage(msg, sessionId = "default", sender) {
    const startTime = process.hrtime();
    const {
        senderName,
        isGroup,
        groupName
    } = extractSenderNameAndContext(sender);

    const isOwner = getOwnerList().includes(senderName);

    if (isOwner) {
        console.log(`👑 Owner message detected from: ${senderName}. Processing with owner rules.`);
        return await processOwnerMessage(msg, sessionId, sender, senderName);
    }

    if (getSpecificOverrideUsers().length > 0 && !matchesOverridePattern(senderName, getSpecificOverrideUsers())) {
        console.log(`⚠️ User "${senderName}" is not on the specific override list. Ignoring message.`);
        return null;
    }

    if (!getStats()) {
        console.error('❌ Stats object is undefined. Cannot process message.');
        return null;
    }

    if (!getSettings().isBotOnline) {
        console.log('🤖 Bot is offline. Skipping message processing.');
        return null;
    }

    const context = isGroup ? groupName : 'DM';

    console.log(`🔍 Processing message from: ${senderName} (Context: ${context})`);

    const isUserHidden = getIgnoredOverrideUsers().some(user => user.name === senderName && user.context === context);
    const settings = getSettings();
    const today = new Date().toLocaleDateString();

    let unhideTriggered = false;
    if (settings.temporaryHide.unhideEnabled) {
        if (matchesTrigger(msg, settings.temporaryHide.unhideTriggerText, settings.temporaryHide.unhideMatchType)) {
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

    const isSenderIgnored = isUserIgnored(senderName, context, getIgnoredOverrideUsers());

    if (temporaryHideTriggered) {
        const reply = pick(settings.temporaryHide.hideReply.split('<#>'));
        const hideEntry = {
            name: senderName,
            context: context
        };
        const isAlreadyIgnoredInContext = getIgnoredOverrideUsers().some(item => item.name === hideEntry.name && item.context === hideEntry.context);
        if (!isAlreadyIgnoredInContext) {
            getIgnoredOverrideUsers().push(hideEntry);
            await db.saveIgnoredOverrideUsers();
            console.log(`👤 User "${senderName}" has been temporarily hidden in context "${context}".`);
        }
        return resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup);
    }

    if (unhideTriggered) {
        const reply = pick(settings.temporaryHide.unhideReply.split('<#>'));
        return resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup);
    }

    if (isSenderIgnored) {
        console.log(`🚫 User "${senderName}" is ignored in context "${context}". Skipping reply.`);
        return null;
    }

    const welcomedUsers = getWelcomedUsers();
    let stats = getStats();

    let messageStats = await db.MessageStats.findOne({
        sessionId: sessionId
    });

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

    if (!welcomedUsers.includes(senderName)) {
        welcomedUsers.push(senderName);
        await db.User.create({
            senderName,
            sessionId
        });
    }

    if (!stats.todayUsers.includes(senderName)) {
        stats.todayUsers.push(senderName);
    }

    stats.totalMsgs++;
    stats.todayMsgs++;

    if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);

    const updatedStats = await db.Stats.findByIdAndUpdate(stats._id, stats, {
        new: true
    });
    setStats(updatedStats);
    await db.saveStats();

    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of getRules()) {
        let userMatch = false;
        const targetUsers = rule.TARGET_USERS || "ALL";

        if (rule.RULE_TYPE === "IGNORED") {
            if (Array.isArray(targetUsers) && !targetUsers.includes(senderName)) {
                userMatch = true;
            }
        } else if (targetUsers === "ALL" || (Array.isArray(targetUsers) && targetUsers.includes(senderName))) {
            if (isSenderIgnored) {
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
                await db.User.create({
                    senderName,
                    sessionId
                });
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
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);

        setLastReplyTimes({ ...getLastReplyTimes(),
            [senderName]: Date.now()
        });

        messageStats.replyCount++;
        if (matchedRuleId) {
            const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
            messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
        }
        await messageStats.save();
    }

    return reply || null;
}

exports.processMessage = processMessage;
