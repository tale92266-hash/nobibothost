const express = require("express");
const router = express.Router();
const { processMessage } = require("../services/messageProcessor");
const { extractSenderNameAndContext, matchesOverridePattern } = require("../utils/helpers");
const { getSpecificOverrideUsers, getSettings } = require("../services/dataService");

// Global readiness flag
let isReady = false;

function setReady(ready) {
  isReady = ready;
}

router.post("/webhook", async (req, res) => {
  // Check if the server is ready before processing the request
  if (!isReady) {
    console.warn('⚠️ Server not ready. Rejecting incoming webhook.');
    return res.status(503).send('Server is initializing. Please try again in a moment.');
  }

  const sessionId = req.body.session_id || "default_session";
  const msg = req.body.query?.message || "";
  const sender = req.body.query?.sender || "";
  
  const { senderName: parsedSenderName, isGroup, groupName } = extractSenderNameAndContext(sender);
  
  const settings = getSettings();
  const SPECIFIC_OVERRIDE_USERS = getSpecificOverrideUsers();

  // Bot Online check added to webhook endpoint
  if (!settings.isBotOnline) {
    console.log('🤖 Bot is offline. Skipping message processing.');
    return res.json({ replies: [] });
  }

  // Specific override check
  if (SPECIFIC_OVERRIDE_USERS.length > 0 && !matchesOverridePattern(parsedSenderName, SPECIFIC_OVERRIDE_USERS)) {
    console.log(`⚠️ User "${parsedSenderName}" is not on the specific override list. Ignoring message.`);
    return res.json({ replies: [] });
  }

  // Get socket functions from app
  const emitStats = req.app.get('emitStats');
  const addChatMessage = req.app.get('addChatMessage');

  // Process message
  const replyText = await processMessage(msg, sessionId, sender, emitStats);

  // Create message object for history
  const messageData = {
    sessionId: sessionId,
    senderName: parsedSenderName,
    groupName: isGroup ? groupName : null,
    userMessage: msg,
    botReply: replyText,
    timestamp: new Date().toISOString()
  };

  // Add to chat history
  if (addChatMessage) {
    addChatMessage(messageData);
  }

  if (!replyText) return res.json({ replies: [] });
  res.json({ replies: [{ message: replyText }] });
});

module.exports = { router, setReady };
