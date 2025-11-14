import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import express from "express";
import cors from "cors";
import multer from 'multer';
import fs from 'fs';
import ExcelJS from 'exceljs';
import seedrandom from 'seedrandom';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { addScore, getTopScores } from "./leaderboard.js";
import authRoutes, { authMiddleware, adminOnly } from "./authroutes.js";
import pool from "./db.js";
import readline from 'readline';
import XLSX from "xlsx";
import db from "./db.js";


dotenv.config();
const app = express();

// CORS: allow frontend anywhere for now
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
app.use(express.static("."));
app.use(express.static("public"));

app.use("/api/auth", authRoutes);

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

// -------------------
// Add Score
// -------------------
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

// -------------------
// Leaderboard
// -------------------
app.get("/leaderboard", async (req, res) => {
  try {
    const data = await getTopScores();
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

// -------------------
// Upload Questions (CSV)
// -------------------
app.post("/api/admin/upload-questions", authMiddleware, adminOnly, upload.single('csv'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

  const filePath = req.file.path;
  const results = [];

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const parts = line.split('|');
      if (parts.length >= 6) {
        results.push({
          q_text: parts[0].trim(),
          opt1: parts[1].trim(),
          opt2: parts[2].trim(),
          opt3: parts[3].trim(),
          opt4: parts[4].trim(),
          correct_option: parts[5].trim(),
          level: 1
        });
      }
    }

    for (const q of results) {
      await pool.query(
        `INSERT INTO questions (q_text, opt1, opt2, opt3, opt4, correct_option, level)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [q.q_text, q.opt1, q.opt2, q.opt3, q.opt4, q.correct_option, q.level]
      );
    }

    fs.unlinkSync(filePath);
    res.json({ success: true, message: `${results.length} questions uploaded successfully!` });

  } catch (err) {
    console.error("❌ Error uploading questions:", err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, message: "Failed to upload questions" });
  }
});
// DELETE ALL QUESTIONS
app.delete('/api/admin/delete-all-questions', async (req, res) => {
  try {
    await pool.query("DELETE FROM questions");
    res.json({ success: true, message: "All questions deleted successfully." });
  } catch (err) {
    console.error("Error deleting questions:", err);
    res.status(500).json({ success: false, message: "Server error deleting questions." });
  }
});
// DELETE ALL PLAYERS

app.delete("/api/admin/delete-all-players", async (req, res) => {
    try {
        console.log("🟡 Incoming delete-all-players request");

        const [users] = await pool.query("SELECT COUNT(*) AS total FROM users");
        console.log("Users in DB:", users[0].total);

        const [leaderboard] = await pool.query("SELECT COUNT(*) AS total FROM leaderboard");
        console.log("Leaderboard entries:", leaderboard[0].total);

        const [del1] = await pool.query("DELETE FROM users WHERE role='player'");
        const [del2] = await pool.query("DELETE FROM leaderboard");

        console.log("Deleted players:", del1.affectedRows);
        console.log("Deleted leaderboard:", del2.affectedRows);

        res.json({ success: true, message: "All players deleted successfully!" });
    } catch (err) {
        console.error("🔥 HARD ERROR:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// -------------------
// Export Players
// -------------------
app.get("/api/admin/export/players", authMiddleware, adminOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(`
       SELECT l.player_name AS name, u.email, l.score, l.level, u.created_at AS registered_at
       FROM leaderboard l
       JOIN users u ON l.player_name = u.name
       WHERE u.role = 'player'
       GROUP BY l.player_name, u.email, l.score, l.level, u.created_at
       ORDER BY l.player_name
    `);

    if (!rows.length) return res.status(404).json({ success: false, message: "No players found" });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Player Progress');
    sheet.addRow(['Name', 'Email', 'Score', 'Level']);
    rows.forEach(player => sheet.addRow([player.name, player.email, player.score, player.level]));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=player_progress.xlsx');
    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Failed to export progress:", err);
    res.status(500).json({ success: false, message: "Failed to export progress" });
  }
});

// -------------------
// Upload Players (Excel)
// -------------------
app.post("/api/admin/upload-players", authMiddleware, adminOnly, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });

    // Read Excel using XLSX (you can use ExcelJS too)
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

    let inserted = 0, skipped = 0;
    for (const row of rows) {
      const name = (row.Name || row.name || '').toString().trim();
      const email = (row.Email || row.email || '').toString().trim();
      const passwordPlain = row.Password || row.password || "player123";

      if (!name || !email) {
        skipped++;
        continue;
      }

      // Hash password
      const password_hash = await bcrypt.hash(passwordPlain.toString(), 10);

      try {
        // Use INSERT IGNORE to avoid duplicate email errors (email has UNIQUE in schema)
        const [result] = await pool.query(
          "INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'player')",
          [name, email, password_hash]
        );

        // If inserted a new user, make sure leaderboard has an entry
        if (result.affectedRows > 0) {
          await pool.query(
            "INSERT IGNORE INTO leaderboard (player_name, score, level) VALUES (?, 0, 1)",
            [name]
          );
          inserted++;
        } else {
          // If user exists, optionally ensure leaderboard row exists
          await pool.query(
            "INSERT IGNORE INTO leaderboard (player_name, score, level) VALUES (?, 0, 1)",
            [name]
          );
          skipped++;
        }
      } catch (subErr) {
        console.warn("Row insert skipped due to error:", subErr.message);
        skipped++;
      }
    }

    // cleanup
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ success: true, message: `Uploaded players: ${inserted}. Skipped: ${skipped}.` });
  } catch (err) {
    console.error("❌ Upload players error:", err);
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------
// Fetch Questions (protected)// Fetch Questions
// -------------------
app.get("/questions", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM questions ORDER BY id");
    const rng = seedrandom(req.user.id + '-' + Date.now());
    const shuffledQuestions = rows.sort(() => rng() - 0.5);

    const data = shuffledQuestions.map(q => {
      const options = [q.opt1, q.opt2, q.opt3, q.opt4];
      const optRng = seedrandom(req.user.id + '-' + q.id + '-' + Date.now());
      const shuffledOptions = options.sort(() => optRng() - 0.5);
      return { id: q.id, question: q.q_text, options: shuffledOptions, correct: q.correct_option, level: q.level };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

// -------------------
// Remove Player
// -------------------
app.post("/api/admin/remove-player", authMiddleware, adminOnly, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  try {
    const [rows] = await pool.query("SELECT name FROM users WHERE email = ? AND role = 'player'", [email]);
    if (!rows.length) return res.json({ success: false, message: "Player not found" });

    const playerName = rows[0].name;
    await pool.query("DELETE FROM users WHERE email = ? AND role = 'player'", [email]);
    await pool.query("DELETE FROM leaderboard WHERE player_name = ?", [playerName]);

    res.json({ success: true, message: `Player "${playerName}" removed successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to remove player" });
  }
});

// -------------------
// Start Server
// -------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
