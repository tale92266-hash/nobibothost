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
const sendDelayedReplies = (replies, delaySeconds, sessionId, senderName, groupName, isGroup) => {
    // Assuming the autoresponder app has an API endpoint to send messages
    const sendEndpoint = process.env.AUTORESPONDER_API_ENDPOINT; // This needs to be defined in your .env file

    replies.forEach((reply, index) => {
        setTimeout(() => {
            try {
                const replyMessage = resolveVariablesRecursively(reply, senderName, '', 0, groupName, isGroup);
                axios.post(sendEndpoint, {
                    sessionId: sessionId,
                    recipient: senderName,
                    message: replyMessage
                }).catch(error => {
                    console.error(`❌ Failed to send delayed reply ${index + 2}:`, error.message);
                });
                console.log(`⏰ Delayed reply ${index + 2}/${replies.length + 1} sent successfully in background.`);
            } catch (error) {
                console.error(`❌ Failed to process delayed reply ${index + 2}:`, error.message);
            }
        }, delaySeconds * 1000);
    });
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
            db.saveIgnoredOverrideUsers().catch(e => console.error("Error saving ignored users:", e)); // Non-blocking
            console.log(`👤 User "${senderName}" has been unhidden in context "${context}".`);
            const reply = pick(settings.temporaryHide.unhideReply.split('<#>'));
            return { replies: [resolveVariablesRecursively(reply, senderName, msg, 0, groupName, isGroup)] };
        } else {
            console.log(`⚠️ User "${senderName}" was not in the temporary hide list for context "${context}".`);
            return null;
        }
    }

    if (settings.temporaryHide.enabled && matchesTrigger(msg, settings.temporaryHide.triggerText, settings.temporaryHide.matchType)) {
        console.log(`✅ Hide trigger received from user: ${senderName}`);
        const reply = pick(settings.temporaryHide.hideReply.split('<#>'));
        const hideEntry = { name: senderName, context: context };
        const isAlreadyIgnoredInContext = getIgnoredOverrideUsers().some(item => item.name === hideEntry.name && item.context === hideEntry.context);

        if (!isAlreadyIgnoredInContext) {
            const currentIgnoredUsers = getIgnoredOverrideUsers();
            currentIgnoredUsers.push(hideEntry);
            setIgnoredOverrideUsers(currentIgnoredUsers);
            db.saveIgnoredOverrideUsers().catch(e => console.error("Error saving ignored users:", e)); // Non-blocking
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
    messageStats.save().catch(e => console.error("Error saving message stats:", e)); // Non-blocking

    if (!stats.todayUsers.includes(senderName)) { stats.todayUsers.push(senderName); }
    stats.totalMsgs++;
    stats.todayMsgs++;

    db.Stats.findByIdAndUpdate(stats._id, stats).catch(e => console.error("Error updating stats:", e)); // Non-blocking
    db.saveStats().catch(e => console.error("Error saving stats:", e)); // Non-blocking

    let replies = null;
    let regexMatch = null;
    let matchedRuleId = null;

    const findBestMatch = async (rulesToProcess) => {
        const matchPromises = rulesToProcess.map(rule => {
            const cooldownKey = `${sessionId}-${rule.RULE_NUMBER}`;
            if (rule.COOLDOWN > 0 && ruleCooldowns.has(cooldownKey) && Date.now() < ruleCooldowns.get(cooldownKey)) {
                console.log(`🚫 Rule "${rule.RULE_NAME}" is on cooldown.`);
                return null;
            }

            const ruleReplies = rule.REPLY_TEXT.split("<#>").map(r => r.trim()).filter(Boolean);
            let finalRegexMatch = null;
            const matchResult = matchesTrigger(msg, rule.KEYWORDS, rule.RULE_TYPE, finalRegexMatch);

            if (matchResult) {
                if (rule.RULE_TYPE === 'WELCOME') {
                    if (senderName && getWelcomedUsers().includes(senderName)) {
                        return null; // Already welcomed
                    }
                    const newWelcomedUsers = [...getWelcomedUsers(), senderName];
                    setWelcomedUsers(newWelcomedUsers);
                    db.User.create({ senderName, sessionId }).catch(e => console.error("Error saving new user:", e));
                }
                
                if (rule.RULE_TYPE === 'OWNER_RULE' && rule.RULE_TYPE === 'WELCOME') {
                    if (getWelcomeLog().has(`${senderName}-${rule.RULE_NUMBER}-${context}`)) {
                        return null; // Owner already welcomed with this rule
                    }
                    addWelcomeLogEntry(rule.RULE_NUMBER, senderName, context);
                    db.saveWelcomeLog().catch(e => console.error("Error saving welcome log:", e));
                }

                if (rule.COOLDOWN > 0) {
                    const cooldownTime = Date.now() + (rule.COOLDOWN * 1000);
                    ruleCooldowns.set(cooldownKey, cooldownTime);
                    console.log(`⏱️ Rule "${rule.RULE_NAME}" put on cooldown for ${rule.COOLDOWN} seconds.`);
                }
                
                let delay = 0;
                if (rule.MIN_DELAY > 0 || rule.MAX_DELAY > 0) {
                    const min = rule.MIN_DELAY;
                    const max = rule.MAX_DELAY;
                    delay = min === max ? min : Math.floor(Math.random() * (max - min + 1)) + min;
                }

                // Non-blocking delay
                if (delay > 0) {
                    console.log(`⏰ Applying a non-blocking delay of ${delay} seconds for rule.`);
                    return new Promise(resolve => setTimeout(() => resolve({
                        replies: ruleReplies,
                        matchedRuleId: rule.RULE_NUMBER,
                        enableDelay: rule.ENABLE_DELAY || false,
                        replyDelay: rule.REPLY_DELAY || 0
                    }), delay * 1000));
                } else {
                    return Promise.resolve({
                        replies: ruleReplies,
                        matchedRuleId: rule.RULE_NUMBER,
                        enableDelay: rule.ENABLE_DELAY || false,
                        replyDelay: rule.REPLY_DELAY || 0
                    });
                }
            }
            return null;
        });

        // Use Promise.race to get the fastest match, but Promise.all for thorough checks
        const results = await Promise.all(matchPromises);
        return results.find(r => r !== null) || null;
    };
    
    // Automation Rules check (highest priority, blocking)
    if (getIsAutomationEnabled() && msg.startsWith('/')) {
        const automationRules = getAutomationRules().filter(r => matchesTrigger(msg, r.KEYWORDS, r.RULE_TYPE));
        for (const rule of automationRules) {
            const result = await findBestMatch([rule]);
            if(result) {
                replies = result.replies;
                matchedRuleId = result.matchedRuleId;
                break;
            }
        }
    }

    // Owner Rules check
    if (!replies && isOwner) {
        console.log(`👑 Owner message detected from: ${senderName}. Checking owner rules.`);
        const ownerRules = getOwnerRules();
        const bestMatch = await findBestMatch(ownerRules);
        if (bestMatch) {
            replies = bestMatch.replies;
            matchedRuleId = bestMatch.matchedRuleId;
        }
    }
    
    // Normal Rules check
    if (!replies && !isOwner) {
        console.log(`🔍 Checking normal rules.`);
        const normalRules = getRules();
        const bestMatch = await findBestMatch(normalRules);
        if (bestMatch) {
            replies = bestMatch.replies;
            matchedRuleId = bestMatch.matchedRuleId;
        }
    }

    const endTime = process.hrtime(startTime);
    const processingTime = (endTime[0] * 1000 + endTime[1] / 1e6).toFixed(2);

    let replyToReturn = null;
    if (replies) {
        const resolvedRepliesForHistory = replies.map(r => {
            if (typeof r === 'string') {
                return resolveVariablesRecursively(r, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats);
            }
            return r;
        });
        
        replyToReturn = resolvedRepliesForHistory;

        const lastReplyTimes = getLastReplyTimes();
        lastReplyTimes[senderName] = Date.now();
        setLastReplyTimes(lastReplyTimes);

        messageStats.replyCount++;
        if (matchedRuleId) {
            const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
            messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
        }
        messageStats.save().catch(e => console.error("Error saving message stats:", e)); // Non-blocking

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