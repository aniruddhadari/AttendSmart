import { auth, db } from "./firebase.js";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   DOM ELEMENTS
========================= */
const startBtn = document.getElementById("startSession");
const endBtn = document.getElementById("endSession");
const sessionInfo = document.getElementById("sessionInfo");
const qrDiv = document.getElementById("qrCode");
const attendanceList = document.getElementById("attendanceList");

const totalCountEl = document.getElementById("totalCount");
const attendancePercentEl = document.getElementById("attendancePercent");
const lateCountEl = document.getElementById("lateCount");
const insightsEl = document.getElementById("sessionInsights");

const printBtn = document.getElementById("printBtn");
const exportBtn = document.getElementById("exportBtn");



/* =========================
   STATE
========================= */
let currentSessionId = null;
let unsubscribeAttendance = null;
let sessionStartTime = null;

/* =========================
   INITIAL UI STATE
========================= */
endBtn.disabled = true;
printBtn.style.display = "none";
exportBtn.style.display = "none";

/* =========================
   HELPERS
========================= */
function getSessionDateString() {
  if (!sessionStartTime) return "session";
  return sessionStartTime.toISOString().split("T")[0];
}

/* =========================
   START SESSION
========================= */
startBtn.addEventListener("click", async () => {
  try {
    const user = auth.currentUser;
    if (!user) return alert("Not logged in");

    const sessionRef = await addDoc(collection(db, "sessions"), {
      teacherId: user.uid,
      active: true,
      createdAt: serverTimestamp(),
    });

    currentSessionId = sessionRef.id;
    sessionStartTime = new Date();

    sessionInfo.innerHTML = `
      <p><b>Session Created!</b></p>
      <p>Session ID: <code>${currentSessionId}</code></p>
    `;

    qrDiv.innerHTML = "";
    const sessionUrl = `https://attendsmart-fee27.web.app/student.html?sessionId=${currentSessionId}`;

    new QRCode(qrDiv, { text: sessionUrl, width: 200, height: 200 });

    endBtn.disabled = false;
    printBtn.style.display = "none";
    exportBtn.style.display = "none";

    totalCountEl.innerText = "";
    attendancePercentEl.innerText = "";
    lateCountEl.innerText = "";
    insightsEl.innerText = "";

    listenForAttendance(currentSessionId);
  } catch (err) {
    console.error(err);
    alert("Failed to start session");
  }
});

/* =========================
   END SESSION
========================= */
endBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;

  try {
    await updateDoc(doc(db, "sessions", currentSessionId), {
      active: false,
    });

    sessionInfo.innerHTML += `<p><b>Session Ended</b></p>`;
    qrDiv.innerHTML = "";
    endBtn.disabled = true;

    printBtn.style.display = "inline-block";
    exportBtn.style.display = "inline-block";

    if (unsubscribeAttendance) unsubscribeAttendance();
  } catch (err) {
    console.error(err);
    alert("Failed to end session");
  }
});

/* =========================
   LIVE ATTENDANCE + ANALYTICS
========================= */
function listenForAttendance(sessionId) {
  const attendanceQuery = query(
    collection(db, "sessions", sessionId, "attendance"),
    orderBy("timestamp", "asc")
  );

  unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
    attendanceList.innerHTML = "";

    let total = 0;
    let late = 0;

    snapshot.forEach((doc) => {
      total++;
      const data = doc.data();
      const joinTime = data.timestamp?.toDate();

      const minutesLate =
        joinTime && sessionStartTime
          ? (joinTime - sessionStartTime) / (1000 * 60)
          : 0;

      if (minutesLate > 5) late++;

      const time = joinTime ? joinTime.toLocaleTimeString() : "—";

      const li = document.createElement("li");
      li.textContent = `${data.name} | ${data.department} | ${data.roll} — ${time}`;
      attendanceList.appendChild(li);
    });

    /* ===== ANALYTICS ===== */
    const CLASS_SIZE = 30;

    totalCountEl.innerText = total;
    lateCountEl.innerText = late;

    const percent = Math.round((total / CLASS_SIZE) * 100);
    attendancePercentEl.innerText = `${percent}%`;

    let insightText = "";
    if (total === 0) {
      insightText = "No students attended this session.";
    } else if (percent < 40) {
      insightText = "⚠️ Very low attendance. Possible engagement issue.";
    } else if (percent < 70) {
      insightText = "⚠️ Moderate attendance.";
    } else {
      insightText = "✅ High attendance. Good participation.";
    }

    if (late > 0) insightText += ` ${late} student(s) joined late.`;
    insightsEl.innerText = insightText;
  });
}
const tr = document.createElement("tr");

tr.innerHTML = `
  <td>${data.name}</td>
  <td>${data.department}</td>
  <td>${data.roll}</td>
  <td>${time}</td>
  <td>${data.distance ?? "—"}</td>
  <td>
    ${
      data.location
        ? `<a href="https://www.google.com/maps?q=${data.location.lat},${data.location.lng}"
             target="_blank">View</a>`
        : "—"
    }
  </td>
`;

attendanceList.appendChild(tr);

/* =========================
   PRINT (PDF)
========================= */
printBtn.addEventListener("click", () => {
  document.title = `Attendance_${getSessionDateString()}`;
  window.print();
});

/* =========================
   EXPORT CSV (EXCEL)
========================= */
exportBtn.addEventListener("click", () => {
  const rows = [];

  rows.push(["Session Date", getSessionDateString()]);
  rows.push(["Total Students Present", attendanceList.children.length]);
  rows.push([]);
  rows.push(["Name", "Department", "Roll", "Time"]);

  document.querySelectorAll("#attendanceList li").forEach((li) => {
    const parts = li.textContent.split(" | ");
    const rollTime = parts[2].split(" — ");

    rows.push([parts[0], parts[1], rollTime[0], rollTime[1]]);
  });

  let csvContent = "data:text/csv;charset=utf-8,";
  rows.forEach((row) => {
    csvContent += row.join(",") + "\n";
  });

  const link = document.createElement("a");
  link.href = encodeURI(csvContent);
  link.download = `attendance_${getSessionDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
