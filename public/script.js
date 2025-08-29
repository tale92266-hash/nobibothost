const socket = io();

const statsIds = {
  totalUsers: "totalUsers",
  totalMsgs: "totalMsgs",
  todayUsers: "todayUsers",
  todayMsgs: "todayMsgs",
  nobiPapaHideMeCount: "nobiPapaHideMeCount"
};

// -------------------- Update stats from server --------------------
socket.on("statsUpdate", data => {
  for (let key in statsIds) {
    document.getElementById(statsIds[key]).innerText = data[key] ?? 0;
  }
});
