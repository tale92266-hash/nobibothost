const mongoose = require("mongoose");
const path = require("path");
const fs = require("fs");

const User = require("./models/User");
const Rule = require("./models/Rule");
const Stats = require("./models/Stats");
const Variable = require("./models/Variable");
const Settings = require("./models/Settings");
const MessageStats = require("./models/MessageStats");

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("⚡ MongoDB connected successfully!");

        try {
            await User.collection.dropIndex('email_1');
            console.log('✅ Old email_1 index dropped successfully.');
        } catch (error) {
            if (error.codeName !== 'IndexNotFound') {
                console.error('❌ Failed to drop old index:', error);
            } else {
                console.log('🔍 Old email_1 index not found, no action needed.');
            }
        }
    } catch (err) {
        console.error("❌ MongoDB connection error:", err);
        process.exit(1);
    }
};

module.exports = {
    connectDB,
    User,
    Rule,
    Stats,
    Variable,
    Settings,
    MessageStats
};
