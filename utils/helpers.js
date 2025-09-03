const fs = require("fs");

function pick(arr) { 
  return arr[Math.floor(Math.random() * arr.length)]; 
}

function convertNewlinesBeforeSave(text) {
  if (!text) return '';
  return text.replace(/\\n/g, '\n');
}

function extractSenderNameAndContext(sender) {
  let senderName = sender;
  let groupName = null;
  let isGroup = false;
  
  const adminPattern = /^\(.*\)\s*/;
  const cleanSender = sender.replace(adminPattern, '');
  
  const groupPattern = /^(.*):\s*(.*)$/;
  const match = cleanSender.match(groupPattern);
  if (match && match.length === 3) {
    groupName = match[1].trim();
    senderName = match[2].trim();
    isGroup = true;
  }
  
  return { senderName, groupName, isGroup };
}

function matchesOverridePattern(senderName, patternList) {
  for (const pattern of patternList) {
    const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
    if (new RegExp(regexStr, 'i').test(senderName)) {
      return true;
    }
  }
  return false;
}

function isUserIgnored(senderName, context, ignoredList) {
  return ignoredList.some(item => {
    const nameMatch = matchesOverridePattern(senderName, [item.name]);
    const contextMatch = matchesOverridePattern(context, [item.context]);
    return nameMatch && contextMatch;
  });
}

function matchesTrigger(message, triggerText, matchType) {
  const triggers = triggerText.split('//').map(t => t.trim()).filter(Boolean);
  for (const trigger of triggers) {
    let match = false;
    if (matchType === 'EXACT' && trigger.toLowerCase() === message.toLowerCase()) match = true;
    else if (matchType === 'PATTERN') {
      let regexStr = trigger.replace(/\*/g, ".*");
      if (new RegExp(`^${regexStr}$`, "i").test(message)) match = true;
    } else if (matchType === 'EXPERT') {
      try {
        if (new RegExp(trigger, "i").test(message)) match = true;
      } catch {}
    }
    if (match) return true;
  }
  return false;
}

function pickRandomReply(replyText, senderName, msg, processingTime, groupName, isGroup, resolveVariablesRecursively) {
  const replies = replyText.split('<#>').map(r => r.trim()).filter(Boolean);
  if (replies.length === 0) {
    return null;
  }
  const selectedReply = pick(replies);
  return resolveVariablesRecursively(selectedReply, senderName, msg, processingTime, groupName, isGroup);
}

function resolveVariablesRecursively(text, senderName, receivedMessage, processingTime, groupName, isGroup, regexMatch = null, matchedRuleId = null, totalMsgs = 0, messageStats = null, maxIterations = 10, messageHistory = [], VARIABLES = [], today = '') {
  let result = text;
  let iterationCount = 0;
  const lowerCaseAlphabet = 'abcdefghijklmnopqrstuvwxyz';
  const upperCaseAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
  const grawlixes = '#$%&@*!';

  while (iterationCount < maxIterations) {
    const initialResult = result;
    
    // Pass 1: Resolve new variables first, as they are most specific
    result = result.replace(/%message(?:_(\d+))?%/g, (match, maxLength) => {
      const message = receivedMessage || '';
      if (maxLength) {
        return message.substring(0, parseInt(maxLength, 10));
      }
      return message;
    });

    // Previous message variables
    result = result.replace(/%prev_message_(\d+)(?:,(\d+))?_(\d+)(?:_(\d+))?%/g, (match, ruleId1, ruleId2, offset, maxLength) => {
      const ruleIds = [ruleId1, ruleId2].filter(Boolean).map(id => parseInt(id, 10));
      const historyOffset = parseInt(offset, 10);
      const filteredHistory = messageHistory.filter(item => {
        if (!item.ruleId) return ruleIds.includes(0);
        return ruleIds.includes(item.ruleId);
      });
      if (historyOffset < filteredHistory.length) {
        let message = filteredHistory[historyOffset].userMessage;
        if (maxLength) {
          message = message.substring(0, parseInt(maxLength, 10));
        }
        return message;
      }
      return match;
    });

    // Previous reply variables
    result = result.replace(/%prev_reply_(\d+)(?:,(\d+))?_(\d+)(?:_(\d+))?%/g, (match, ruleId1, ruleId2, offset, maxLength) => {
      const ruleIds = [ruleId1, ruleId2].filter(Boolean).map(id => parseInt(id, 10));
      const historyOffset = parseInt(offset, 10);
      const filteredHistory = messageHistory.filter(item => {
        if (!item.ruleId) return ruleIds.includes(0);
        return ruleIds.includes(item.ruleId);
      });
      if (historyOffset < filteredHistory.length) {
        let reply = filteredHistory[historyOffset].botReply;
        if (maxLength) {
          reply = reply.substring(0, parseInt(maxLength, 10));
        }
        return reply;
      }
      return match;
    });

    // Processing time variable
    result = result.replace(/%processing_time%/g, () => processingTime.toString());

    // Date & Time variables (extended)
    const now = new Date();
    const istOptions = { timeZone: 'Asia/Kolkata' };
    result = result.replace(/%day_of_month_short%/g, now.getDate());
    result = result.replace(/%day_of_month%/g, now.toLocaleString('en-IN', { day: '2-digit', ...istOptions }));
    result = result.replace(/%month_short%/g, now.getMonth() + 1);
    result = result.replace(/%month%/g, now.toLocaleString('en-IN', { month: '2-digit', ...istOptions }));
    result = result.replace(/%month_name_short%/g, now.toLocaleString('en-IN', { month: 'short', ...istOptions }));
    result = result.replace(/%month_name%/g, now.toLocaleString('en-IN', { month: 'long', ...istOptions }));
    result = result.replace(/%year_short%/g, now.getFullYear().toString().slice(-2));
    result = result.replace(/%year%/g, now.getFullYear());
    result = result.replace(/%day_of_week_short%/g, now.toLocaleString('en-IN', { weekday: 'short', ...istOptions }));
    result = result.replace(/%day_of_week%/g, now.toLocaleString('en-IN', { weekday: 'long', ...istOptions }));

    // Countdown variables
    result = result.replace(/%countdown(?:_days)?_(\d+)%/g, (match, unixTimestamp, isDays) => {
      const targetDate = new Date(parseInt(unixTimestamp, 10) * 1000);
      const diffSeconds = (targetDate.getTime() - now.getTime()) / 1000;
      if (match.includes('_days')) {
        return Math.floor(diffSeconds / (60 * 60 * 24));
      }
      const days = Math.floor(diffSeconds / (60 * 60 * 24));
      const hours = Math.floor((diffSeconds % (60 * 60 * 24)) / (60 * 60));
      const minutes = Math.floor((diffSeconds % (60 * 60)) / 60);
      const seconds = Math.floor(diffSeconds % 60);
      return `${days}d ${hours}h ${minutes}m ${seconds}s`;
    });

    // Day of year and Week of year (ISO 8601)
    result = result.replace(/%day_of_year%/g, () => {
      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const diff = now.getTime() - startOfYear.getTime();
      const oneDay = 1000 * 60 * 60 * 24;
      return Math.floor(diff / oneDay);
    });

    result = result.replace(/%week_of_year%/g, () => {
      const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
      d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    });

    // Existing variables (no change)
    result = result.replace(/%(hour|hour_short|hour_of_day|hour_of_day_short|minute|second|millisecond|am\/pm|name)%/g, (match, varName) => {
      const now = new Date();
      const istOptions = { timeZone: 'Asia/Kolkata' };
      switch (varName) {
        case 'hour':
          return now.toLocaleString('en-IN', { hour: '2-digit', hour12: true, ...istOptions }).split(' ')[0];
        case 'hour_short':
          return now.toLocaleString('en-IN', { hour: 'numeric', hour12: true, ...istOptions }).split(' ')[0];
        case 'hour_of_day':
          return now.toLocaleString('en-IN', { hour: '2-digit', hour12: false, ...istOptions });
        case 'hour_of_day_short':
          return now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, ...istOptions });
        case 'minute':
          return now.toLocaleString('en-IN', { minute: '2-digit', ...istOptions });
        case 'second':
          return now.toLocaleString('en-IN', { second: '2-digit', ...istOptions });
        case 'millisecond':
          return now.getMilliseconds().toString().padStart(3, '0');
        case 'am/pm':
          return now.toLocaleString('en-IN', { hour: '2-digit', hour12: true, ...istOptions }).split(' ')[1].toUpperCase();
        case 'name':
          return senderName;
      }
      return match;
    });

    // Inbuilt variable for GC/DM name
    result = result.replace(/%gc%/g, () => {
      return isGroup ? `${groupName} GC` : 'CHAT';
    });

    // Add new variables based on the request
    result = result.replace(/%rule_id%/g, () => matchedRuleId ? matchedRuleId.toString() : 'N/A');
    result = result.replace(/%reply_count_overall%/g, () => totalMsgs.toString());

    // Add other requested variables
    if (messageStats) {
      result = result.replace(/%received_count%/g, () => messageStats.receivedCount.toString());
      result = result.replace(/%reply_count%/g, () => messageStats.replyCount.toString());
      result = result.replace(/%reply_count_day%/g, () => messageStats.lastActiveDate === today ? messageStats.replyCount.toString() : '0');
      result = result.replace(/%reply_count_contacts%/g, () => !messageStats.isGroup ? messageStats.replyCount.toString() : '0');
      result = result.replace(/%reply_count_groups%/g, () => messageStats.isGroup ? messageStats.replyCount.toString() : '0');
      
      // Handle %reply_count_0% variable
      const ruleReplyCountRegex = /%reply_count_([0-9,]+)%/g;
      result = result.replace(ruleReplyCountRegex, (match, ruleIds) => {
        const ids = ruleIds.split(',').map(id => id.trim());
        let count = 0;
        ids.forEach(id => {
          const ruleId = parseInt(id);
          if (!isNaN(ruleId)) {
            count += messageStats.ruleReplyCounts.get(ruleId.toString()) || 0;
          }
        });
        return count.toString();
      });
    }

    // Pass 2: Resolve the new random variables
    result = result.replace(/%rndm_num_(\d+)_(\d+)%/g, (match, min, max) => {
      const minNum = parseInt(min, 10);
      const maxNum = parseInt(max, 10);
      return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
    });

    result = result.replace(/%rndm_abc_lower_(\d+)%/g, (match, length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += lowerCaseAlphabet.charAt(Math.floor(Math.random() * lowerCaseAlphabet.length));
      }
      return result;
    });

    result = result.replace(/%rndm_abc_upper_(\d+)%/g, (match, length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += upperCaseAlphabet.charAt(Math.floor(Math.random() * upperCaseAlphabet.length));
      }
      return result;
    });

    result = result.replace(/%rndm_abc_(\d+)%/g, (match, length) => {
      const chars = lowerCaseAlphabet + upperCaseAlphabet;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });

    result = result.replace(/%rndm_abcnum_lower_(\d+)%/g, (match, length) => {
      const chars = lowerCaseAlphabet + numbers;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });

    result = result.replace(/%rndm_abcnum_upper_(\d+)%/g, (match, length) => {
      const chars = upperCaseAlphabet + numbers;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });

    result = result.replace(/%rndm_abcnum_(\d+)%/g, (match, length) => {
      const chars = lowerCaseAlphabet + upperCaseAlphabet + numbers;
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    });

    result = result.replace(/%rndm_ascii_(\d+)%/g, (match, length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        // Generate a random printable ASCII character (32 to 126)
        result += String.fromCharCode(Math.floor(Math.random() * (126 - 32 + 1)) + 32);
      }
      return result;
    });

    result = result.replace(/%rndm_symbol_(\d+)%/g, (match, length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += symbols.charAt(Math.floor(Math.random() * symbols.length));
      }
      return result;
    });

    result = result.replace(/%rndm_grawlix_(\d+)%/g, (match, length) => {
      let result = '';
      for (let i = 0; i < length; i++) {
        result += grawlixes.charAt(Math.floor(Math.random() * grawlixes.length));
      }
      return result;
    });

    // Pass 3: Resolve the new random custom variable
    result = result.replace(/%rndm_custom_(\d+)_([^%]+)%/g, (match, length, content) => {
      const count = parseInt(length, 10);
      const choices = content.split(/[,‚]/).map(s => s.trim());
      
      // Fisher-Yates shuffle algorithm
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }
      
      const selected = choices.slice(0, Math.min(count, choices.length));
      return selected.join('');
    });

    // Pass 4: Resolve Capturing Groups
    if (regexMatch) {
      result = result.replace(/%capturing_group_(\d+)%/g, (match, id) => {
        const index = parseInt(id, 10);
        return (regexMatch[index] !== undefined) ? regexMatch[index] : match;
      });
    }

    // Pass 5: Resolve static variables from DB
    result = result.replace(/%(\w+)%/g, (match, varName) => {
      const staticVar = VARIABLES.find(v => v.name === varName);
      if (staticVar) {
        return staticVar.value;
      }
      return match;
    });

    if (result === initialResult) {
      break;
    }
    iterationCount++;
  }

  if (iterationCount === maxIterations) {
    console.warn('⚠️ Variable resolution reached max iterations. There might be a circular reference or a parsing error.');
  }

  return result;
}

module.exports = {
  pick,
  convertNewlinesBeforeSave,
  extractSenderNameAndContext,
  matchesOverridePattern,
  isUserIgnored,
  matchesTrigger,
  pickRandomReply,
  resolveVariablesRecursively
};
