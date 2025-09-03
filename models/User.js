const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    sessionId: { type: String, required: true, unique: false },
    senderName: { type: String, required: true, unique: true }
});

const User = mongoose.model("User", userSchema);

module.exports = User;
