const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json({ limit: '1mb' }));

app.post('/webhook', (req, res) => {
  console.log('=== AutoResponder request ===');
  console.log('Headers:', req.headers);
  console.log('Body:', JSON.stringify(req.body, null, 2));

  // Support both shapes just in case
  const message = req.body.query?.message || req.body.message || '';
  const senderInfo = req.body.query?.sender || req.body.sender || '';
  const username =
    typeof senderInfo === 'string' && senderInfo.split(':').length
      ? senderInfo.split(':')[0].trim()
      : 'User';

  let replyText = `Thanks for your message! You said: "${message}"`;
  const lower = message.toLowerCase();

  if (lower.includes('hi') || lower.includes('hello')) {
    replyText = `Hello ${username}! 😊 Thanks for reaching out on Instagram. How can I help you?`;
  } else if (lower.includes('price') || lower.includes('cost')) {
    replyText = `Our prices start at $99. Check our website for detailed pricing!`;
  } else if (lower.includes('menu')) {
    replyText = `Here's our menu:\n1. Products\n2. Services\n3. Support\n4. Pricing`;
  }

  // IMPORTANT: AutoResponder expects "replies": [ { "message": "..." }, ... ]
  return res.status(200).json({
    replies: [
      { message: replyText }
    ]
  });
});

app.get('/', (req, res) => res.send('🤖 Instagram AutoResponder Bot is Live!'));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
