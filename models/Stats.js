// file: models/Stats.js

const mongoose = require("mongoose");

const statsSchema = new mongoose.Schema({
    totalUsers: [{ type: String }],
    todayUsers: [{ type: String }],
    totalMsgs: { type: Number, default: 0 },
    todayMsgs: { type: Number, default: 0 },
    nobiPapaHideMeUsers: [{ type: String }],
    lastResetDate: { type: String }
});

const Stats = mongoose.model("Stats", statsSchema);

module.exports = Stats;
