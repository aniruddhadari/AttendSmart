import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fetch from "node-fetch";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ai/insights", async (req, res) => {
  try {
    const { summary } = req.body;

    if (!summary) {
      return res.status(400).json({ error: "Summary missing" });
    }

  const response = await fetch(
  `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            {
              text: `
You are an assistant helping teachers analyze class attendance.

Give short insights about:
- Attendance level
- Punctuality
- Any unusual patterns

Attendance data:
${summary}
`
            }
          ]
        }
      ]
    })
  }
);


    const data = await response.json();

    if (data.error) {
      console.error("Gemini API error:", data.error);
      return res.status(500).json({ error: "Gemini error" });
    }

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No insights generated.";

    res.json({ insights: text });
  } catch (err) {
    console.error("Backend crash:", err);
    res.status(500).json({ error: "Backend failure" });
  }
});

app.listen(5000, () => {
  console.log("✅ AI Server running at http://localhost:5000");
});
