const express = require('express');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

app.post('/webhook', (req, res) => {
  
  // Log the incoming request
  console.log('✅ Incoming Instagram Webhook Payload:');
  console.log(JSON.stringify(req.body, null, 2));

  // Extract data from the 'query' object (corrected structure)
  const message = req.body.query?.message || '';
  const senderInfo = req.body.query?.sender || '';
  const username = senderInfo.split(':')[0]?.trim() || 'User';

  console.log(`Extracted Data - Message: "${message}", User: "${username}"`);

  // Your bot logic
  let replyText = `Thanks for your message! You said: "${message}"`;

  if (message.toLowerCase().includes('hi') || message.toLowerCase().includes('hello')) {
    replyText = `Hello ${username}! 😊 Thanks for reaching out on Instagram. How can I help you?`;
  }

  if (message.toLowerCase().includes('price') || message.toLowerCase().includes('cost')) {
    replyText = `Our prices start at $99. Check our website for detailed pricing!`;
  }

  if (message.toLowerCase().includes('menu')) {
    replyText = `Here's our menu:\n1. Products\n2. Services\n3. Support\n4. Pricing`;
  }

  // Send the response back to AutoResponder
  res.json({
    reply: replyText
    // You can add other response types:
    // image: "https://example.com/image.jpg",
    // file: "https://example.com/file.pdf"
  });
});

app.get('/', (req, res) => {
  res.send('🤖 Instagram AutoResponder Bot is Live!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
