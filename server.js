import express from "express";
import cors from "cors";
import { addScore, getTopScores } from "./leaderboard.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("."));



// Save score
app.post("/add-score", async (req, res) => {
  const { playerName, score, level } = req.body;
  try {
    await addScore(playerName, score, level);
    console.log(`✅ Score added for ${playerName}: ${score} (Level ${level})`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error adding score:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Fetch leaderboard
app.get("/leaderboard", async (req, res) => {
  try {
    const data = await getTopScores();

    // check if data is valid array
    if (!Array.isArray(data)) {
      console.error("⚠️ getTopScores() did not return array:", data);
      return res.status(500).json({ success: false, error: "Invalid data returned" });
    }

    res.json(data);
  } catch (err) {
    console.error("❌ Error fetching leaderboard:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on http://localhost:${PORT}`)
);
