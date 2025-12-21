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
   CONSTANTS & STATE
========================= */
const CLASS_SIZE = 30;
let attendanceChart = null;
let currentSessionId = null;
let unsubscribeAttendance = null;
let sessionStartTime = null;

/* =========================
   DOM
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
   INITIAL UI
========================= */
endBtn.disabled = true;
printBtn.style.display = "none";
exportBtn.style.display = "none";
printBtn.addEventListener("click", handlePrint);
exportBtn.addEventListener("click", handleExport);


/* =========================
   Print button
========================= */
function handlePrint() {
  if (!attendanceList.children.length) {
    alert("No attendance data to print");
    return;
  }

  document.title = `Attendance_${new Date().toLocaleDateString()}`;
  window.print();
}

/* =========================
   Excel download
========================= */
function handleExport() {
  if (!attendanceList.children.length) {
    alert("No attendance data to export");
    return;
  }

  let csv = "Name,Department,Roll,Time,Distance(m)\n";

  document.querySelectorAll("#attendanceList tr").forEach((tr) => {
    const cells = [...tr.children].map(td =>
      `"${td.innerText.replace(/"/g, '""')}"`
    );
    csv += cells.join(",") + "\n";
  });

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = `attendance_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}


/* =========================
   PIE CHART
========================= */
function renderPieChart(present, absent, late) {
  const canvas = document.getElementById("attendanceChart");
  if (!canvas || typeof Chart === "undefined") {
    console.error("❌ Chart.js not loaded");
    return;
  }

  const ctx = canvas.getContext("2d");

  if (attendanceChart) attendanceChart.destroy();

  attendanceChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: ["Present", "Absent", "Late"],
      datasets: [
        {
          data: [present, absent, late],
          backgroundColor: ["#22c55e", "#ef4444", "#f59e0b"],
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
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
  new QRCode(qrDiv, {
    text: `https://attendsmart-fee27.web.app/student.html?sessionId=${currentSessionId}`,
    width: 200,
    height: 200,
  });

  endBtn.disabled = false;
  listenForAttendance(currentSessionId);
});

/* =========================
   END SESSION
========================= */
endBtn.addEventListener("click", async () => {
  await updateDoc(doc(db, "sessions", currentSessionId), { active: false });
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
        ? `<a href="https://maps.google.com/?q=${data.location.lat},${data.location.lng}" target="_blank">View</a>`
        : "—";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${data.name}</td>
        <td>${data.department}</td>
        <td>${data.roll}</td>
        <td>${time}</td>
        <td>${data.distance ?? "—"}</td>
        <td>${mapLink}</td>
      `;
      attendanceList.appendChild(tr);
    });

    const absent = Math.max(CLASS_SIZE - total, 0);
    const percent = Math.round((total / CLASS_SIZE) * 100);

    totalCountEl.innerText = total;
    lateCountEl.innerText = late;
    attendancePercentEl.innerText = `${percent}%`;

    insightsEl.innerText =
      total === 0
        ? "No students attended."
        : percent < 40
        ? "⚠️ Very low attendance."
        : percent < 70
        ? "⚠️ Moderate attendance."
        : "✅ High attendance.";

    renderPieChart(total, absent, late);
  });
}
