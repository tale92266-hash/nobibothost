// file: core/bot.js

const {
    getRules, getOwnerRules, getAutomationRules, getWelcomedUsers, getSettings, getIgnoredOverrideUsers,
    getOwnerList, setIgnoredOverrideUsers, setWelcomedUsers, getStats, getMessageHistory,
    setMessageHistory, setLastReplyTimes, getLastReplyTimes, setStats, getSpecificOverrideUsers,
    ruleCooldowns
} = require('./state');
const { db } = require('../db');
const {
    resolveVariablesRecursively, extractSenderNameAndContext, matchesOverridePattern,
    isUserIgnored, matchesTrigger, pick
} = require('./utils');


async function processOwnerMessage(msg, sessionId, sender, senderName) {
    const startTime = process.hrtime();
    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    // START: New logic for Master Stop
    const masterStopSettings = getSettings().masterStop;
    if (masterStopSettings.enabled && matchesTrigger(msg, masterStopSettings.triggerText, masterStopSettings.matchType)) {
        console.log(`⚠️ Owner "${senderName}" requested to stop all automation rules.`);
        db.clearAutomationRuleCooldowns();
        const replyText = pick(masterStopSettings.replyText.split('<#>'));
        return resolveVariablesRecursively(replyText, senderName, msg, 0);
    }
    // END: New logic for Master Stop

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
    const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);

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
        const hideEntry = { name: senderName, context: context };
        const isAlreadyIgnoredInContext = getIgnoredOverrideUsers().some(item => item.name === hideEntry.name && item.context === hideEntry.context);
        if (!isAlreadyIgnoredInContext) {
            const currentIgnoredUsers = getIgnoredOverrideUsers();
            currentIgnoredUsers.push(hideEntry);
            setIgnoredOverrideUsers(currentIgnoredUsers);
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

    if (!welcomedUsers.includes(senderName)) {
        const newWelcomedUsers = [...welcomedUsers, senderName];
        setWelcomedUsers(newWelcomedUsers);
        await db.User.create({ senderName, sessionId });
    }

    if (!stats.todayUsers.includes(senderName)) { stats.todayUsers.push(senderName); }

    stats.totalMsgs++;
    stats.todayMsgs++;
    if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) stats.nobiPapaHideMeUsers.push(sessionId);
    const updatedStats = await db.Stats.findByIdAndUpdate(stats._id, stats, { new: true });
    setStats(updatedStats);
    await db.saveStats();

    let reply = null;
    let regexMatch = null;
    let matchedRuleId = null;

    for (let rule of getRules()) {
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

    const automationRules = getAutomationRules();
    if (!reply && msg.startsWith('/') && automationRules.length > 0) {
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
                let replies = rule.REPLY_TEXT.split('<#>').map(r => r.trim()).filter(Boolean);
                if (rule.REPLIES_TYPE === 'ALL') {
                    reply = replies.join('\n');
                } else if (rule.REPLIES_TYPE === 'ONE') {
                    reply = replies[0];
                } else { // RANDOM
                    reply = pick(replies);
                }

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
                break; // Found an automation rule, stop checking
            }
        }
    }


    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);

    if (reply) {
        reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);
        
        const lastReplyTimes = getLastReplyTimes();
        lastReplyTimes[senderName] = Date.now();
        setLastReplyTimes(lastReplyTimes);

        messageStats.replyCount++;
        if (matchedRuleId) {
            const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
            messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
        }
        await messageStats.save();
    }
    
    let messageHistory = getMessageHistory();
    messageHistory.unshift({
        userMessage: msg,
        botReply: reply,
        ruleId: matchedRuleId,
        timestamp: new Date().toISOString()
    });
    const MAX_HISTORY = 50;
    if (messageHistory.length > MAX_HISTORY) { messageHistory.pop(); }
    setMessageHistory(messageHistory);

    return reply || null;
}

exports.processMessage = processMessage;

