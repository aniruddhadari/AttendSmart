import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";



/* =========================
   DOM ELEMENTS
========================= */
const nameInput = document.getElementById("studentName");
const deptInput = document.getElementById("studentDept");
const rollInput = document.getElementById("studentRoll");
const btn = document.getElementById("markAttendance");
const statusMsg = document.getElementById("statusMsg");

/* =========================
   SESSION ID
========================= */

const params = new URLSearchParams(window.location.search);
const sessionId = params.get("sessionId");

if (!sessionId) {
  window.location.href = "student-home.html";
  alert("Please scan the QR code to mark attendance.");
}


/* =========================
   MARK ATTENDANCE
========================= */
btn.addEventListener("click", async () => {
  const name = nameInput.value.trim();
  const dept = deptInput.value.trim();
  const roll = rollInput.value.trim();

  if (!name || !dept || !roll) {
    alert("Please fill all fields");
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    alert("Please login first");
    return;
  }

  try {
    const attendanceRef = doc(
      db,
      "sessions",
      sessionId,
      "attendance",
      user.uid
    );

    // Prevent duplicate attendance
    const existing = await getDoc(attendanceRef);
    if (existing.exists()) {
      statusMsg.innerText = "Attendance already marked ✅";
      return;
    }

    await setDoc(attendanceRef, {
      name,
      department: dept,
      roll,
      email: user.email,
      timestamp: serverTimestamp(),
    });

    statusMsg.innerText = "Attendance marked successfully ✅";
    btn.disabled = true;
  } catch (err) {
    console.error(err);
    statusMsg.innerText = "Failed to mark attendance ❌";
  }
});
