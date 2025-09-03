function socketService(io) {
  let recentChatMessages = [];
  const MAX_CHAT_HISTORY = 10;

  io.on('connection', (socket) => {
    console.log('⚡ New client connected');
    
    // Send recent chat history to new client immediately
    if (recentChatMessages.length > 0) {
      console.log(`📤 Sending ${recentChatMessages.length} recent messages to new client`);
      socket.emit('chatHistory', recentChatMessages);
    }

    socket.on('disconnect', () => {
      console.log('❌ Client disconnected');
    });
  });

  function emitStats() {
    const { getStats } = require("./dataService");
    const stats = getStats();
    if (stats) {
      io.emit("statsUpdate", {
        totalUsers: stats.totalUsers.length,
        totalMsgs: stats.totalMsgs,
        todayUsers: stats.todayUsers.length,
        todayMsgs: stats.todayMsgs,
        nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
      });
    }
  }

  function addChatMessage(messageData) {
    // Add to recent messages array (newest first)
    recentChatMessages.unshift(messageData);
    
    // Keep only last 10 messages
    if (recentChatMessages.length > MAX_CHAT_HISTORY) {
      recentChatMessages = recentChatMessages.slice(0, MAX_CHAT_HISTORY);
    }

    console.log(`💬 Chat history updated. Total messages: ${recentChatMessages.length}`);
    
    // Emit real-time chat message to all connected clients
    io.emit('newMessage', messageData);
  }

  return {
    emitStats,
    addChatMessage
  };
}

module.exports = socketService;
