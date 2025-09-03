const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const { mongoose } = require("../config/database");
const { Rule, Variable, User } = require("../config/database");
const { 
  loadAllRules, 
  loadAllVariables,
  getIgnoredOverrideUsers,
  getSpecificOverrideUsers,
  setIgnoredOverrideUsers,
  setSpecificOverrideUsers,
  saveIgnoredOverrideUsers,
  saveSpecificOverrideUsers,
  getSettings,
  setSettings,
  saveSettings
} = require("../services/dataService");
const { convertNewlinesBeforeSave } = require("../utils/helpers");

// Update ignored override users
router.post("/settings/ignored-override", async (req, res) => {
  try {
    const { users } = req.body;
    
    const newUsers = users.split(',').map(userString => {
      const [name, context] = userString.split(':').map(s => s.trim());
      return { name, context: context || 'DM' };
    }).filter(item => item.name);
    
    setIgnoredOverrideUsers(newUsers);
    await saveIgnoredOverrideUsers();
    res.json({ success: true, message: "Ignored override users updated successfully." });
  } catch (error) {
    console.error("❌ Failed to update ignored override users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update specific override users
router.post("/settings/specific-override", async (req, res) => {
  try {
    const { users } = req.body;
    const newUsers = users.split(',').map(u => u.trim()).filter(Boolean);
    setSpecificOverrideUsers(newUsers);
    await saveSpecificOverrideUsers();
    res.json({ success: true, message: "Specific override users updated successfully." });
  } catch (error) {
    console.error("❌ Failed to update specific override users:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get all settings
router.get("/settings", async (req, res) => {
  try {
    const settings = getSettings();
    const settingsData = {
      preventRepeatingRule: settings.preventRepeatingRule,
      isBotOnline: settings.isBotOnline,
      temporaryHide: settings.temporaryHide,
      ignoredOverrideUsers: getIgnoredOverrideUsers(),
      specificOverrideUsers: getSpecificOverrideUsers()
    };
    res.json(settingsData);
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update repeating rule setting
router.post("/settings/prevent-repeating-rule", async (req, res) => {
  try {
    const { enabled, cooldown } = req.body;
    const settings = getSettings();
    settings.preventRepeatingRule.enabled = enabled;
    settings.preventRepeatingRule.cooldown = cooldown;
    setSettings(settings);
    await saveSettings();
    res.json({ success: true, message: "Repeating rule setting updated successfully." });
  } catch (error) {
    console.error("❌ Failed to update repeating rule setting:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update temporary hide setting
router.post("/settings/temporary-hide", async (req, res) => {
  try {
    const { enabled, matchType, triggerText, unhideEnabled, unhideTriggerText, unhideMatchType, hideReply, unhideReply } = req.body;
    const settings = getSettings();
    settings.temporaryHide.enabled = enabled;
    settings.temporaryHide.matchType = matchType;
    settings.temporaryHide.triggerText = triggerText;
    settings.temporaryHide.unhideEnabled = unhideEnabled;
    settings.temporaryHide.unhideTriggerText = unhideTriggerText;
    settings.temporaryHide.unhideMatchType = unhideMatchType;
    settings.temporaryHide.hideReply = hideReply;
    settings.temporaryHide.unhideReply = unhideReply;
    setSettings(settings);
    await saveSettings();
    res.json({ success: true, message: "Temporary hide setting updated successfully." });
  } catch (error) {
    console.error("❌ Failed to update temporary hide setting:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Update bot status
router.post("/bot/status", async (req, res) => {
  try {
    const { isOnline } = req.body;
    const settings = getSettings();
    settings.isBotOnline = isOnline;
    setSettings(settings);
    await saveSettings();
    res.json({ success: true, message: `Bot status updated to ${isOnline ? 'online' : 'offline'}.` });
    console.log(`🤖 Bot status has been set to ${isOnline ? 'online' : 'offline'}.`);
  } catch (error) {
    console.error("❌ Failed to update bot status:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Rules bulk update
router.post("/rules/bulk-update", async (req, res) => {
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
    fs.writeFileSync(path.join(__dirname, "..", "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));

    res.json({
      success: true,
      message: `${req.body.rules.length} rules reordered successfully`,
      updatedCount: req.body.rules.length,
      totalCount: req.body.rules.length
    });

    // Emit socket event if io is available
    if (req.app.get('io')) {
      const { getRules } = require("../services/dataService");
      const RULES = getRules();
      req.app.get('io').emit('rulesUpdated', {
        action: 'bulk_reorder_atomic',
        count: req.body.rules.length,
        newOrder: RULES.map(r => ({ id: r._id, number: r.RULE_NUMBER, name: r.RULE_NAME }))
      });
    }
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

// Get rules
router.get("/rules", async (req, res) => {
  try {
    const rules = await Rule.find({}).sort({ RULE_NUMBER: 1 });
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch rules" });
  }
});

// Update rule
router.post("/rules/update", async (req, res) => {
  const { type, rule, oldRuleNumber } = req.body;
  try {
    const session = await mongoose.startSession();
    await session.startTransaction();

    try {
      if (type === "add") {
        await Rule.updateMany(
          { RULE_NUMBER: { $gte: rule.ruleNumber } },
          { $inc: { RULE_NUMBER: 1 } },
          { session }
        );

        await Rule.create([{
          RULE_NUMBER: rule.ruleNumber,
          RULE_NAME: rule.ruleName,
          RULE_TYPE: rule.ruleType,
          KEYWORDS: rule.keywords,
          REPLIES_TYPE: rule.repliesType,
          REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
          TARGET_USERS: rule.targetUsers
        }], { session });
        
      } else if (type === "edit") {
        if (rule.ruleNumber !== oldRuleNumber) {
          const startRuleNumber = Math.min(rule.ruleNumber, oldRuleNumber);
          const endRuleNumber = Math.max(rule.ruleNumber, oldRuleNumber);

          if (rule.ruleNumber < oldRuleNumber) {
            await Rule.updateMany(
              { RULE_NUMBER: { $gte: startRuleNumber, $lt: endRuleNumber } },
              { $inc: { RULE_NUMBER: 1 } },
              { session }
            );
          } else {
            await Rule.updateMany(
              { RULE_NUMBER: { $gt: startRuleNumber, $lte: endRuleNumber } },
              { $inc: { RULE_NUMBER: -1 } },
              { session }
            );
          }

          await Rule.findOneAndUpdate(
            { RULE_NUMBER: oldRuleNumber },
            { $set: { RULE_NUMBER: rule.ruleNumber } },
            { session }
          );
        }

        await Rule.findOneAndUpdate(
          { RULE_NUMBER: rule.ruleNumber },
          {
            $set: {
              RULE_NAME: rule.ruleName,
              RULE_TYPE: rule.ruleType,
              KEYWORDS: rule.keywords,
              REPLIES_TYPE: rule.repliesType,
              REPLY_TEXT: convertNewlinesBeforeSave(rule.replyText),
              TARGET_USERS: rule.TARGET_USERS
            }
          },
          { new: true, session }
        );
        
      } else if (type === "delete") {
        await Rule.deleteOne({ RULE_NUMBER: rule.ruleNumber }, { session });
        await Rule.updateMany(
          { RULE_NUMBER: { $gt: rule.ruleNumber } },
          { $inc: { RULE_NUMBER: -1 } },
          { session }
        );
      }

      await session.commitTransaction();
      session.endSession();

      const rulesFromDB = await Rule.find({}).sort({ RULE_NUMBER: 1 });
      const jsonRules = { rules: rulesFromDB.map(r => r.toObject()) };
      fs.writeFileSync(path.join(__dirname, "..", "data", "funrules.json"), JSON.stringify(jsonRules, null, 2));

      await loadAllRules();
      res.json({ success: true, message: "Rule updated successfully!" });

      // Emit socket event if io is available
      if (req.app.get('io')) {
        req.app.get('io').emit('rulesUpdated', { action: type, ruleNumber: rule.ruleNumber });
      }

    } catch (err) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ Failed to update rule:", err);
      res.status(500).json({ success: false, message: "Server error: " + err.message });
    }
  } catch (err) {
    console.error("❌ Failed to start session or transaction:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Get variables
router.get("/variables", async (req, res) => {
  try {
    const variables = await Variable.find({});
    res.json(variables);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch variables" });
  }
});

// Update variable
router.post("/variables/update", async (req, res) => {
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
    const variablesFilePath = path.join(__dirname, "..", "data", "variables.json");
    fs.writeFileSync(variablesFilePath, JSON.stringify(variablesFromDB.map(v => v.toObject()), null, 2));

    res.json({ success: true, message: "Variable updated successfully!" });

    // Emit socket event if io is available
    if (req.app.get('io')) {
      req.app.get('io').emit('variablesUpdated', { action: type, variableName: variable.name });
    }
  } catch (err) {
    console.error("❌ Failed to update variable:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
