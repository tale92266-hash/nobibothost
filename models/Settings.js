const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
    settings_type: { type: String, required: true, unique: true },
    settings_data: mongoose.Schema.Types.Mixed
});

const Settings = mongoose.model("Settings", settingsSchema);

module.exports = Settings;
