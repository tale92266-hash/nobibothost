const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '1mb' }));

const chatContexts = {};

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

// Function to match message with advanced regex patterns
function getReplyFromMessage(msg) {
  if (msg.match(/\b(hi|hello|he[y]+|sup|namaste|ram\s?ram)\b/i)) {
    return 'greetings';
  }
  if (msg.match(/\b(how\s?are\s?you|hw\s?r\s?u|k[ae]is[ae]\s?ho|kya\s?haal|kaisi\s?hai|kaise\s?ho)\b/i)) {
    return 'howAreYou';
  }
  if (msg.match(/\b(thank|thanks|shukr[iya]+|dhanyawad)\b/i)) {
    return 'thanks';
  }
  if (msg.match(/\b(price|cost|daam|kya\s?daam|kitne\s?ka|kya\s?price)\b/i)) {
    return 'price';
  }
  if (msg.match(/\b(detail|more\s?info|kuch\s?aur\s?batao|zyaada\s?jaankari|details)\b/i)) {
    return 'details';
  }
  return 'default';
}

app.post('/webhook', (req, res) => {
  const sessionId = req.body.session_id || 'default_session';
  const msg = (req.body.query?.message || '').toLowerCase();

  let replyText;
  let currentIntent = 'default';

  if (!chatContexts[sessionId]) {
    chatContexts[sessionId] = {
      lastIntent: null,
      dialogueState: 'normal',
      clarificationCount: 0
    };
  }
  const context = chatContexts[sessionId];

  if (context.dialogueState === 'waiting_for_clarification') {
    const userIntent = getReplyFromMessage(msg);
    if (userIntent !== 'default') {
      replyText = pick(replies.confirmation.responses) + ' ' + pick(replies[userIntent].responses);
      currentIntent = userIntent;
      context.dialogueState = 'normal';
    } else {
      replyText = pick(replies.clarification.responses);
      context.clarificationCount++;
    }
  } else {
    const userIntent = getReplyFromMessage(msg);
    if (userIntent !== 'default') {
      replyText = pick(replies[userIntent].responses);
      currentIntent = userIntent;
    } else {
      replyText = pick(replies.clarification.responses);
      context.dialogueState = 'waiting_for_clarification';
      currentIntent = 'clarification';
    }
  }

  context.lastIntent = currentIntent;
  context.lastMessage = msg;

  res.json({
    replies: [{ message: replyText.toUpperCase() }]
  });
});

app.listen(PORT, () => console.log(`🤖 HUMAN-LIKE CHAT BOT RUNNING ON ${PORT}`));
