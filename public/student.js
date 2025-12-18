import { auth, db } from "./firebase.js";
import {
  doc,
  setDoc,
  serverTimestamp,
  getDoc,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =========================
   CLASS LOCATION (CHANGE THIS)
========================= */
const CLASS_LOCATION = {
  lat: 22.49985447531162, 
  lng: 88.16442373679071,
};

const ALLOWED_RADIUS = 150; // meters

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
  alert("Please scan the QR code to mark attendance.");
  window.location.href = "student-home.html";
}

/* =========================
   DISTANCE CALCULATION
========================= */
function getDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
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

  statusMsg.innerText = "📍 Checking your location...";

  if (!navigator.geolocation) {
    statusMsg.innerText = "❌ Location not supported on this device";
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const studentLat = position.coords.latitude;
      const studentLng = position.coords.longitude;

      const distance = getDistanceInMeters(
        studentLat,
        studentLng,
        CLASS_LOCATION.lat,
        CLASS_LOCATION.lng
      );

      if (distance > ALLOWED_RADIUS) {
        statusMsg.innerText = `❌ You are too far from class (${Math.round(
          distance
        )}m)`;
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

        const existing = await getDoc(attendanceRef);
        if (existing.exists()) {
          statusMsg.innerText = "✅ Attendance already marked";
          return;
        }

        await setDoc(attendanceRef, {
          name,
          department: dept,
          roll,
          email: user.email,
          location: {
            lat: studentLat,
            lng: studentLng,
          },
          distance: Math.round(distance),
          timestamp: serverTimestamp(),
        });

        statusMsg.innerText = "✅ Attendance marked successfully";
        btn.disabled = true;
      } catch (err) {
        console.error(err);
        statusMsg.innerText = "❌ Failed to save attendance";
      }
    },
    (error) => {
      console.error("Location error:", error);

      let message = "❌ Location failed.";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message =
            "❌ Location permission denied. Please allow location access.";
          break;

        case error.POSITION_UNAVAILABLE:
          message = "❌ Location unavailable. Turn ON GPS.";
          break;

        case error.TIMEOUT:
          message =
            "❌ Location timed out.\n\n" +
            "Please:\n" +
            "• Turn ON phone GPS\n" +
            "• Move near a window\n" +
            "• Try again";
          break;
      }
      statusMsg.innerText = message;
    },
    {
      enableHighAccuracy: false,
      timeout: 30000,
      maximumAge: 10000,
    }
  );
});
