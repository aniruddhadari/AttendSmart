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
   INITIAL STATE
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
  const sessionUrl =
    `https://attendsmart-fee27.web.app/student.html?sessionId=${currentSessionId}`;

  new QRCode(qrDiv, { text: sessionUrl, width: 200, height: 200 });

  endBtn.disabled = false;
  printBtn.style.display = "none";
  exportBtn.style.display = "none";

  listenForAttendance(currentSessionId);
});

/* =========================
   END SESSION
========================= */
endBtn.addEventListener("click", async () => {
  if (!currentSessionId) return;

  await updateDoc(doc(db, "sessions", currentSessionId), {
    active: false,
  });

  sessionInfo.innerHTML += `<p><b>Session Ended</b></p>`;
  endBtn.disabled = true;

  printBtn.style.display = "inline-block";
  exportBtn.style.display = "inline-block";

  if (unsubscribeAttendance) unsubscribeAttendance();
});

/* =========================
   LIVE ATTENDANCE
========================= */
function listenForAttendance(sessionId) {
  const q = query(
    collection(db, "sessions", sessionId, "attendance"),
    orderBy("timestamp", "asc")
  );

  unsubscribeAttendance = onSnapshot(q, (snapshot) => {
    attendanceList.innerHTML = "";

    let total = 0;
    let late = 0;

    snapshot.forEach((docSnap) => {
      total++;
      const data = docSnap.data();

      const joinTime = data.timestamp?.toDate();
      const time = joinTime ? joinTime.toLocaleTimeString() : "—";

      if (
        joinTime &&
        sessionStartTime &&
        (joinTime - sessionStartTime) / 60000 > 5
      ) {
        late++;
      }

      const mapLink = data.location
        ? `https://www.google.com/maps?q=${data.location.lat},${data.location.lng}`
        : null;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.name}</td>
        <td>${data.department}</td>
        <td>${data.roll}</td>
        <td>${time}</td>
        <td>${data.distance ?? "—"}</td>
        <td>
          ${
            mapLink
              ? `<a href="${mapLink}" target="_blank">View</a>`
              : "—"
          }
        </td>
      `;

      attendanceList.appendChild(tr);
    });

    /* ANALYTICS */
    const CLASS_SIZE = 30;

    totalCountEl.innerText = total;
    lateCountEl.innerText = late;

    const percent = Math.round((total / CLASS_SIZE) * 100);
    attendancePercentEl.innerText = `${percent}%`;

    insightsEl.innerText =
      total === 0
        ? "No students attended this session."
        : percent < 40
        ? "⚠️ Very low attendance."
        : percent < 70
        ? "⚠️ Moderate attendance."
        : "✅ High attendance.";
  });
}

/* =========================
   PRINT
========================= */
printBtn.addEventListener("click", () => {
  document.title = `Attendance_${getSessionDateString()}`;
  window.print();
});

/* =========================
   EXPORT CSV
========================= */
exportBtn.addEventListener("click", () => {
  let csv = "Name,Department,Roll,Time,Distance\n";

  document.querySelectorAll("#attendanceList tr").forEach((tr) => {
    const cells = [...tr.children].map((td) => td.innerText.replace(",", " "));
    csv += cells.join(",") + "\n";
  });

  const link = document.createElement("a");
  link.href = encodeURI("data:text/csv;charset=utf-8," + csv);
  link.download = `attendance_${getSessionDateString()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
