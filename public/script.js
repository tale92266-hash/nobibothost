const socket = io();

const msgInput = document.getElementById("msgInput");
const sendBtn = document.getElementById("sendBtn");
const messages = document.getElementById("messages");

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

// -------------------- Add message to chat --------------------
function addMessage(text, isUser=true) {
  const div = document.createElement("div");
  div.classList.add("message");
  div.classList.add(isUser ? "user-msg" : "bot-msg");
  div.innerText = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

// -------------------- Send message --------------------
async function sendMessage() {
  const msg = msgInput.value.trim();
  if(!msg) return;
  addMessage(msg, true);
  msgInput.value = "";

  const res = await fetch("/webhook", {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ session_id: "default_session", query:{message: msg} })
  });
  const data = await res.json();
  if(data?.replies?.length){
    addMessage(data.replies[0].message, false);
  }
}

sendBtn.addEventListener("click", sendMessage);
msgInput.addEventListener("keypress", e => { if(e.key === "Enter") sendMessage(); });
