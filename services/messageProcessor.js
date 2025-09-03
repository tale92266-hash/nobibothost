const { MessageStats, User, Stats } = require("../config/database");
const { 
  extractSenderNameAndContext, 
  matchesOverridePattern, 
  isUserIgnored, 
  matchesTrigger, 
  pickRandomReply,
  resolveVariablesRecursively,
  pick
} = require("../utils/helpers");
const { 
  getStats, 
  setStats,
  saveStats,
  getWelcomedUsers, 
  setWelcomedUsers,
  getRules, 
  getVariables,
  getIgnoredOverrideUsers, 
  getSpecificOverrideUsers,
  getSettings,
  saveIgnoredOverrideUsers 
} = require("./dataService");

// Global variables
let messageHistory = [];
const MAX_HISTORY = 50;
let lastReplyTimes = {};

async function processMessage(msg, sessionId = "default", sender, emitStats) {
  const startTime = process.hrtime();
  const { senderName, isGroup, groupName } = extractSenderNameAndContext(sender);
  
  const SPECIFIC_OVERRIDE_USERS = getSpecificOverrideUsers();
  const stats = getStats();
  const settings = getSettings();
  const IGNORED_OVERRIDE_USERS = getIgnoredOverrideUsers();
  const RULES = getRules();
  const VARIABLES = getVariables();
  let welcomedUsers = getWelcomedUsers();
  const today = new Date().toLocaleDateString();

  // Highest priority check for specific override
  if (SPECIFIC_OVERRIDE_USERS.length > 0 && !matchesOverridePattern(senderName, SPECIFIC_OVERRIDE_USERS)) {
    console.log(`⚠️ User "${senderName}" is not on the specific override list. Ignoring message.`);
    return null;
  }

  // Check if stats is loaded before accessing it
  if (!stats) {
    console.error('❌ Stats object is undefined. Cannot process message.');
    return null;
  }

  // Bot Online check
  if (!settings.isBotOnline) {
    console.log('🤖 Bot is offline. Skipping message processing.');
    return null;
  }

  const context = isGroup ? groupName : 'DM';
  console.log(`🔍 Processing message from: ${senderName} (Context: ${context})`);
  
  // Check for unhide trigger FIRST
  let unhideTriggered = false;
  if (settings.temporaryHide.unhideEnabled) {
    if (matchesTrigger(msg, settings.temporaryHide.unhideTriggerText, settings.temporaryHide.unhideMatchType)) {
      console.log(`✅ Unhide trigger received from user: ${senderName}`);
      
      const initialIgnoredCount = IGNORED_OVERRIDE_USERS.length;
      const filteredIgnored = IGNORED_OVERRIDE_USERS.filter(item => {
        const nameMatches = matchesOverridePattern(senderName, [item.name]);
        const contextMatches = matchesOverridePattern(context, [item.context]);
        return !(nameMatches && contextMatches);
      });
      
      if (filteredIgnored.length < initialIgnoredCount) {
        setIgnoredOverrideUsers(filteredIgnored);
        await saveIgnoredOverrideUsers();
        console.log(`👤 User "${senderName}" has been unhidden in context "${context}".`);
        unhideTriggered = true;
      } else {
        console.log(`⚠️ User "${senderName}" was not in the temporary hide list for context "${context}".`);
      }
    }
  }

  // Temporary hide check
  let temporaryHideTriggered = false;
  if (settings.temporaryHide.enabled) {
    if (matchesTrigger(msg, settings.temporaryHide.triggerText, settings.temporaryHide.matchType)) {
      temporaryHideTriggered = true;
      console.log(`✅ Hide trigger received from user: ${senderName}`);
    }
  }

  // User is ignored if they are in the context-specific list
  const isSenderIgnored = isUserIgnored(senderName, context, IGNORED_OVERRIDE_USERS);

  // Process hide/unhide replies and then return
  if (temporaryHideTriggered) {
    const reply = pickRandomReply(settings.temporaryHide.hideReply, senderName, msg, 0, groupName, isGroup, resolveVariablesRecursively);
    
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
    const reply = pickRandomReply(settings.temporaryHide.unhideReply, senderName, msg, 0, groupName, isGroup, resolveVariablesRecursively);
    return reply;
  }

  if (isSenderIgnored && !unhideTriggered) {
    console.log(`🚫 User "${senderName}" is ignored in context "${context}". Skipping reply.`);
    return null;
  }

  // Find or create user-specific message stats
  let messageStats = await MessageStats.findOne({ sessionId: sessionId });

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

  // Update received count
  messageStats.receivedCount++;
  await messageStats.save();

  // Update global stats
  if (!welcomedUsers.includes(senderName)) {
    welcomedUsers.push(senderName);
    setWelcomedUsers(welcomedUsers);
    await User.create({ senderName, sessionId });
  }

  // Check if the user has messaged today
  if (!stats.todayUsers.includes(senderName)) {
    stats.todayUsers.push(senderName);
  }

  stats.totalMsgs++;
  stats.todayMsgs++;
  
  if (msg.includes("nobi papa hide me") && !stats.nobiPapaHideMeUsers.includes(sessionId)) {
    stats.nobiPapaHideMeUsers.push(sessionId);
  }

  const updatedStats = await Stats.findByIdAndUpdate(stats._id, stats, { new: true });
  setStats(updatedStats);
  saveStats();
  if (emitStats) emitStats();

  // Match Rules
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
        setWelcomedUsers(welcomedUsers);
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

        if (rule.RULE_TYPE === "EXACT" && pattern.toLowerCase() === msg.toLowerCase()) {
          match = true;
        } else if (rule.RULE_TYPE === "PATTERN") {
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

  // Process reply with variables
  if (reply) {
    console.log(`🔧 Processing reply with correct variable resolution order`);
    
    reply = resolveVariablesRecursively(reply, senderName, msg, processingTime, groupName, isGroup, regexMatch, matchedRuleId, stats.totalMsgs, messageStats, 10, messageHistory, VARIABLES, today);

    // Update last reply time if a reply is sent
    lastReplyTimes[senderName] = Date.now();

    // Update user-specific reply counts
    messageStats.replyCount++;

    // Check for matchedRuleId before updating rule-specific count
    if (matchedRuleId) {
      const ruleCount = messageStats.ruleReplyCounts.get(matchedRuleId.toString()) || 0;
      messageStats.ruleReplyCounts.set(matchedRuleId.toString(), ruleCount + 1);
    }

    await messageStats.save();
  }

  // Add to message history
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
  processMessage
};
