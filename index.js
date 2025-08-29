const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '1mb' }));

// Context and state tracking
const chatContexts = {};

// Reply Pool (more structured and human-like)
const replies = {
  greetings: {
    intent: ['HI', 'HELLO', 'SUP', 'NAMASTE', 'RAM RAM'],
    responses: [
      "HEY! 👋 KYA HAAL HAIN?",
      "HELLO JI, AAO BAAT KAREN. 🙂",
      "HI THERE! KYA CHAL RAHA HAI? 😎",
      "NAMASKAR! KAHAAN SE AAYE HAI? 🙌"
    ]
  },
  howAreYou: {
    intent: ['HOW ARE YOU', 'KAISA HAI', 'KYA HAAL', 'KAISI HAI', 'KAISE HO'],
    responses: [
      "MAIN BADHIYA, TU BATA? 😁",
      "SAB MAST! AUR TERE KYA SCENE HAI? 😉",
      "CHILL CHAL RAHA HAI BRO, AUR TU? ✨"
    ]
  },
  thanks: {
    intent: ['THANK', 'SHUKRIYA', 'DHANYAWAD'],
    responses: [
      "KOI BAAT NAHI. ANYTIME! 🤝",
      "WELCOME DOST 🙏",
      "ARRE MENTION NOT YAAR 😌"
    ]
  },
  price: {
    intent: ['PRICE', 'COST', 'DAAM', 'KITNE KA'],
    responses: [
      "PRICES START FROM $99! 💸 AUR DETAILA WEBSITE PE HAIN.",
      "BAS $99 SE SHURU, AUR DETAIL WEBSITE PE HAI 🔗",
      "HUMARI SERVICES $99 SE SHURU HOTI HAIN. KYA AAPKO KOI SPECIFIC SERVICE CHAHIYE?"
    ]
  },
  details: {
    intent: ['DETAIL', 'MORE INFO', 'KUCH AUR BATAO', 'ZYAADA JAANKARI'],
    responses: [
      "HUMARE PASS KAI PACKAGES HAIN. BASIC PACKAGE MEIN 50 MESSAGES PER DAY HAIN. KYA AAPKO AUR DETAILS CHAHIYE?",
      "HUMARI PRO SERVICE MEIN UNLIMITED MESSAGES AUR AI-POWERED REPLY HAIN.",
      "AUR ZYAADA JAANKARI KE LIYE, AAP HUMARI SUPPORT TEAM SE BAAT KAR SAKTE HAIN."
    ]
  },
  clarification: {
    responses: [
      "SAMAJH NAHI AAYA, AAP KYA POOCH RAHE HAIN?",
      "HMM, MUJHE APNA SAWAL DOHRANA PADEGA.",
      "ISKO THODA AUR CLEAR KAROGE? MAIN SAMAJH NAHI PAYA. 🤔"
    ]
  },
  confirmation: {
    responses: [
      "ACHA, SAMAJH GAYA. 😊",
      "OKAY, GOT IT! 💯",
      "ACHA, AAP YE KEH RAHE HAIN."
    ]
  }
};

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

app.post('/webhook', (req, res) => {
  const sessionId = req.body.session_id || 'default_session';
  const msg = (req.body.query?.message || '').toLowerCase();

  let replyText;
  let currentIntent = 'default';
  
  // Get current session context or create a new one
  if (!chatContexts[sessionId]) {
    chatContexts[sessionId] = {
      lastIntent: null,
      dialogueState: 'normal',
      clarificationCount: 0
    };
  }
  const context = chatContexts[sessionId];

  // Logic to handle clarification state
  if (context.dialogueState === 'waiting_for_clarification') {
    // Acha, samajh gaya
    replyText = pick(replies.confirmation.responses);
    context.dialogueState = 'normal'; // Reset state after receiving clarification
    
    // Now try to process the new, clearer message
    if (msg.match(/\b(price|cost|daam|kitne ka)\b/)) {
        replyText += ' ' + pick(replies.price.responses);
        currentIntent = 'price';
    } else if (msg.match(/\b(detail|more info|kuch aur batao|zyaada jaankari)\b/)) {
        replyText += ' ' + pick(replies.details.responses);
        currentIntent = 'details';
    } else {
        // If clarification still doesn't work, give up or ask a different question
        replyText = pick(replies.clarification.responses);
        context.dialogueState = 'waiting_for_clarification';
    }
  } else {
    // Normal Intent matching
    if (msg.match(/\b(hi|hello|namaste|ram ram|sup)\b/)) {
      replyText = pick(replies.greetings.responses);
      currentIntent = 'greetings';
    } else if (msg.match(/\b(how are you|kaisa hai|kya haal|kaisi hai|kaise ho)\b/)) {
      replyText = pick(replies.howAreYou.responses);
      currentIntent = 'howAreYou';
    } else if (msg.match(/\b(thank|shukriya|dhanyawad)\b/)) {
      replyText = pick(replies.thanks.responses);
      currentIntent = 'thanks';
    } else if (msg.match(/\b(price|cost|daam|kitne ka)\b/)) {
      replyText = pick(replies.price.responses);
      currentIntent = 'price';
    } else if (msg.match(/\b(detail|more info|kuch aur batao|zyaada jaankari)\b/)) {
      replyText = pick(replies.details.responses);
      currentIntent = 'details';
    } else {
      // If intent not matched, ask for clarification
      replyText = pick(replies.clarification.responses);
      context.dialogueState = 'waiting_for_clarification';
      currentIntent = 'clarification';
    }
  }

  // Update context for the next turn
  context.lastIntent = currentIntent;
  context.lastMessage = msg;

  res.json({
    replies: [{ message: replyText.toUpperCase() }]
  });
});

app.listen(PORT, () => console.log(`🤖 HUMAN-LIKE CHAT BOT RUNNING ON ${PORT}`));
