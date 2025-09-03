const express = require("express");
const router = express.Router();
const { User } = require("../config/database");
const { getStats } = require("../services/dataService");

router.get("/", async (req, res) => {
  try {
    const stats = getStats();
    const totalUsersCount = await User.countDocuments();
    res.json({
      totalUsers: totalUsersCount,
      totalMsgs: stats.totalMsgs,
      todayUsers: stats.todayUsers.length,
      todayMsgs: stats.todayMsgs,
      nobiPapaHideMeCount: stats.nobiPapaHideMeUsers.length
    });
  } catch (err) {
    console.error('Failed to fetch stats:', err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

module.exports = router;
