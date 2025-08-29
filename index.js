const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '1mb' }));

// Custom patterns
const rules = [
  {
    type: "exact",
    keywords: ["hi", "hello"],
    reply: "Exact match mila 👌"
  },
  {
    type: "all",
    keywords: ["price", "menu"],
    reply: "Dono words ek saath mile — full info chahiye kya? 📦"
  },
  {
    type: "contain",
    keywords: ["order", "buy", "purchase"],
    reply: "Lagta hai order karna hai, link le: https://example.com/order"
  },
  {
    type: "expert",
    pattern: /\b\d{10}\b/,  // detect 10 digit number
    reply: "Phone number detect hua 📱"
  },
  {
    type: "expert",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z]{2,}\b/i, // detect email
    reply: "Email detect ho gayi 📧"
  }
];

app.post('/webhook', (req, res) => {
  const message = req.body.query?.message || '';
  const lower = message.toLowerCase();
  let matchedReplies = [];

  for (const rule of rules) {
    if (rule.type === "exact") {
      if (rule.keywords.some(k => lower === k)) {
        matchedReplies.push(rule.reply);
      }
    }
    else if (rule.type === "all") {
      if (rule.keywords.every(k => lower.includes(k))) {
        matchedReplies.push(rule.reply);
      }
    }
    else if (rule.type === "contain") {
      if (rule.keywords.some(k => lower.includes(k))) {
        matchedReplies.push(rule.reply);
      }
    }
    else if (rule.type === "expert") {
      if (rule.pattern.test(message)) {
        matchedReplies.push(rule.reply);
      }
    }
  }

  if (matchedReplies.length === 0) {
    matchedReplies.push("Samajh nahi aaya bhai, aur clearly likh. 🤔");
  }

  res.json({
    replies: matchedReplies.map(r => ({ message: r }))
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
