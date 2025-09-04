// file: core/utils.js

const lowerCaseAlphabet = 'abcdefghijklmnopqrstuvwxyz';
const upperCaseAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const numbers = '0123456789';
const symbols = '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~';
const grawlixes = '#$%&@*!';

// Convert literal \n to actual newlines BEFORE saving to DB
exports.convertNewlinesBeforeSave = (text) => {
    if (!text) return '';
    return text.replace(/\\n/g, '\n');
};

// Pick a random element from an array
exports.pick = (arr) => {
    return arr[Math.floor(Math.random() * arr.length)];
};

// Recursively resolve variables
exports.resolveVariablesRecursively = (text, senderName, receivedMessage, processingTime, groupName, isGroup, regexMatch = null, matchedRuleId = null, totalMsgs = 0, messageStats = null, maxIterations = 10) => {
    let result = text;
    let iterationCount = 0;

    while (iterationCount < maxIterations) {
        const initialResult = result;

        result = result.replace(/%message(?:_(\d+))?%/g, (match, maxLength) => {
            const message = receivedMessage || '';
            if (maxLength) {
                return message.substring(0, parseInt(maxLength, 10));
            }
            return message;
        });

        // Date & Time variables (extended)
        const now = new Date();
        const istOptions = { timeZone: 'Asia/Kolkata' };

        result = result.replace(/%day_of_month_short%/g, now.getDate().toString());
        result = result.replace(/%day_of_month%/g, now.toLocaleString('en-IN', { day: '2-digit', ...istOptions }));
        result = result.replace(/%month_short%/g, (now.getMonth() + 1).toString());
        result = result.replace(/%month%/g, now.toLocaleString('en-IN', { month: '2-digit', ...istOptions }));
        result = result.replace(/%month_name_short%/g, now.toLocaleString('en-IN', { month: 'short', ...istOptions }));
        result = result.replace(/%month_name%/g, now.toLocaleString('en-IN', { month: 'long', ...istOptions }));
        result = result.replace(/%year_short%/g, now.getFullYear().toString().slice(-2));
        result = result.replace(/%year%/g, now.getFullYear().toString());
        result = result.replace(/%day_of_week_short%/g, now.toLocaleString('en-IN', { weekday: 'short', ...istOptions }));
        result = result.replace(/%day_of_week%/g, now.toLocaleString('en-IN', { weekday: 'long', ...istOptions }));

        // New formatted time variables
        const hour12 = now.toLocaleString('en-IN', { hour: 'numeric', hour12: true, ...istOptions });
        const hour24 = now.toLocaleString('en-IN', { hour: 'numeric', hour12: false, ...istOptions });
        const minute = now.getMinutes().toString().padStart(2, '0');
        const second = now.getSeconds().toString().padStart(2, '0');
        const ampm = now.toLocaleString('en-IN', { hour: 'numeric', hour12: true, ...istOptions }).split(' ')[1];
        
        result = result.replace(/%hour%/g, hour12.split(' ')[0].padStart(2, '0'));
        result = result.replace(/%hour_short%/g, hour12.split(' ')[0]);
        result = result.replace(/%hour_of_day%/g, hour24.padStart(2, '0'));
        result = result.replace(/%hour_of_day_short%/g, hour24);
        result = result.replace(/%minute%/g, minute);
        result = result.replace(/%second%/g, second);
        result = result.replace(/%millisecond%/g, now.getMilliseconds().toString().padStart(3, '0'));
        result = result.replace(/%am\/pm%/g, ampm.toUpperCase());
        result = result.replace(/%name%/g, senderName);

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
        
        // New variables
        result = result.replace(/%gc%/g, () => {
            return isGroup ? `${groupName} GC` : 'CHAT';
        });
        result = result.replace(/%rule_id%/g, () => matchedRuleId ? matchedRuleId.toString() : 'N/A');
        result = result.replace(/%reply_count_overall%/g, () => totalMsgs.toString());
        
        if (messageStats) {
            result = result.replace(/%received_count%/g, () => messageStats.receivedCount.toString());
            result = result.replace(/%reply_count%/g, () => messageStats.replyCount.toString());
            result = result.replace(/%reply_count_day%/g, () => messageStats.lastActiveDate === new Date().toLocaleDateString() ? messageStats.replyCount.toString() : '0');
            result = result.replace(/%reply_count_contacts%/g, () => !messageStats.isGroup ? messageStats.replyCount.toString() : '0');
            result = result.replace(/%reply_count_groups%/g, () => messageStats.isGroup ? messageStats.replyCount.toString() : '0');
            
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

        // Random variables
        result = result.replace(/%rndm_num_(\d+)_(\d+)%/g, (match, min, max) => {
            const minNum = parseInt(min, 10);
            const maxNum = parseInt(max, 10);
            return Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
        });
        
        result = result.replace(/%rndm_abc_lower_(\d+)%/g, (match, length) => {
            let res = '';
            for (let i = 0; i < length; i++) { res += lowerCaseAlphabet.charAt(Math.floor(Math.random() * lowerCaseAlphabet.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_abc_upper_(\d+)%/g, (match, length) => {
            let res = '';
            for (let i = 0; i < length; i++) { res += upperCaseAlphabet.charAt(Math.floor(Math.random() * upperCaseAlphabet.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_abc_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + upperCaseAlphabet;
            let res = '';
            for (let i = 0; i < length; i++) { res += chars.charAt(Math.floor(Math.random() * chars.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_abcnum_lower_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + numbers;
            let res = '';
            for (let i = 0; i < length; i++) { res += chars.charAt(Math.floor(Math.random() * chars.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_abcnum_upper_(\d+)%/g, (match, length) => {
            const chars = upperCaseAlphabet + numbers;
            let res = '';
            for (let i = 0; i < length; i++) { res += chars.charAt(Math.floor(Math.random() * chars.length)); }
            return res;
        });

        result = result.replace(/%rndm_abcnum_(\d+)%/g, (match, length) => {
            const chars = lowerCaseAlphabet + upperCaseAlphabet + numbers;
            let res = '';
            for (let i = 0; i < length; i++) { res += chars.charAt(Math.floor(Math.random() * chars.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_ascii_(\d+)%/g, (match, length) => {
            let res = '';
            for (let i = 0; i < length; i++) { res += String.fromCharCode(Math.floor(Math.random() * (126 - 32 + 1)) + 32); }
            return res;
        });

        result = result.replace(/%rndm_symbol_(\d+)%/g, (match, length) => {
            let res = '';
            for (let i = 0; i < length; i++) { res += symbols.charAt(Math.floor(Math.random() * symbols.length)); }
            return res;
        });

        result = result.replace(/%rndm_grawlix_(\d+)%/g, (match, length) => {
            let res = '';
            for (let i = 0; i < length; i++) { res += grawlixes.charAt(Math.floor(Math.random() * grawlixes.length)); }
            return res;
        });
        
        result = result.replace(/%rndm_custom_(\d+)_([^%]+)%/g, (match, length, content) => {
            const count = parseInt(length, 10);
            const choices = content.split(/[,\u201a]/).map(s => s.trim());
            for (let i = choices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [choices[i], choices[j]] = [choices[j], choices[i]];
            }
            const selected = choices.slice(0, Math.min(count, choices.length));
            return selected.join('');
        });
        
        // Capturing Groups
        if (regexMatch) {
            result = result.replace(/%capturing_group_(\d+)%/g, (match, id) => {
                const index = parseInt(id, 10);
                return (regexMatch[index] !== undefined) ? regexMatch[index] : match;
            });
        }
        
        const { getVariables } = require('./state');
        const staticVars = getVariables();
        result = result.replace(/%(\w+)%/g, (match, varName) => {
            const staticVar = staticVars.find(v => v.name === varName);
            return staticVar ? staticVar.value : match;
        });

        if (result === initialResult) break;
        iterationCount++;
    }

    if (iterationCount === maxIterations) {
        console.warn('⚠️ Variable resolution reached max iterations. There might be a circular reference or a parsing error.');
    }

    return result;
};

// Parse sender string
exports.extractSenderNameAndContext = (sender) => {
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
};

// Pattern matching for override lists
exports.matchesOverridePattern = (senderName, patternList) => {
    for (const pattern of patternList) {
        const regexStr = '^' + pattern.replace(/\*/g, '.*') + '$';
        if (new RegExp(regexStr, 'i').test(senderName)) {
            return true;
        }
    }
    return false;
};

// Check for ignored users in a specific context
exports.isUserIgnored = (senderName, context, ignoredList) => {
    return ignoredList.some(item => {
        const nameMatch = exports.matchesOverridePattern(senderName, [item.name]);
        const contextMatch = exports.matchesOverridePattern(context, [item.context]);
        return nameMatch && contextMatch;
    });
};

// Check if a message matches a trigger pattern
exports.matchesTrigger = (message, triggerText, matchType) => {
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
};