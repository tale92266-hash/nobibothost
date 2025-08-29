const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// The main webhook endpoint for Instagram
app.post('/webhook', (req, res) => {
  
  // 1. Log the entire incoming request body to see what Instagram sends
  console.log('✅ Incoming Instagram Webhook Payload:');
  console.log(JSON.stringify(req.body, null, 2)); // Pretty-print the JSON

  // 2. Try to extract common potential field names.
  // The key is to look at your console logs and see what the actual keys are.
  const message = req.body.message || req.body.text || req.body.message_text || '';
  const username = req.body.sender || req.body.username || req.body.sender_name || '';
  const userId = req.body.user_id || req.body.sender_id || req.body.id || '';

  console.log(`Extracted Data - Message: "${message}", User: "${username}" (ID: ${userId})`);

  // 3. Your simple bot logic
  let replyText = `Thanks for your message! You said: "${message}"`;

  if (message.toLowerCase().includes('hi') || message.toLowerCase().includes('hello')) {
    replyText = `Hello ${username}! 😊 Thanks for reaching out on Instagram. How can I help you?`;
  }

  if (message.toLowerCase().includes('price')) {
    replyText = `You can find all our pricing info on our website! www.example.com/prices`;
  }

  // 4. Format the response. The key is almost always "reply".
  const response = {
    reply: replyText
    // image: "https://example.com/image.jpg", // You can also send media
  };

  // 5. Send the response back
  res.json(response);
});

app.get('/', (req, res) => {
  res.send('🤖 Instagram AutoResponder Bot is Live!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});