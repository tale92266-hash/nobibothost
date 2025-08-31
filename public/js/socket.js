const SocketModule = {
    socket: null,

    init() {
        // Initialize socket connection
        this.socket = io();
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to server');
        });

        this.socket.on('statsUpdate', (data) => {
            StatsModule.updateDisplay(data);
        });

        this.socket.on('rulesUpdated', (data) => {
            console.log('Rules updated:', data);
            // Refresh rules list
            APIModule.fetchRules();
        });

        this.socket.on('variablesUpdated', (data) => {
            console.log('Variables updated:', data);
            // Refresh variables list
            APIModule.fetchVariables();
        });

        // Chat functionality
        this.socket.on('newMessage', (data) => {
            ChatModule.handleNewMessage(data);
        });

        this.socket.on('chatHistory', (historyMessages) => {
            ChatModule.handleChatHistory(historyMessages);
        });
    },

    getSocket() {
        return this.socket;
    }
};
