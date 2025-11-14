import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import express from "express";
import cors from "cors";
import multer from 'multer';
import csv from 'csv-parser';
import fs from 'fs';
import ExcelJS from 'exceljs';
import seedrandom from 'seedrandom';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { addScore, getTopScores } from "./leaderboard.js";
import authRoutes, { authMiddleware, adminOnly } from "./authroutes.js"; // ✅ import auth routes & middlewares
import pool from "./db.js";  // ✅ Use TiDB pool from db.js

dotenv.config();
const app = express();
app.use(cors({
  origin: '*', // or your frontend domain
  credentials: true
}));

app.use(express.json());
app.use(express.static("."));
app.use(express.static("public")); // put admin.html in public folder

// ✅ MySQL connection pool


app.use("/api/auth", authRoutes);


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
// In server.js (or adminRoutes.js)
const upload = multer({ dest: 'uploads/' });

import readline from 'readline';
app.post("/api/admin/upload-questions", authMiddleware, adminOnly, upload.single('csv'), async (req, res) => {
  if (!req.file) {
    console.error("❌ No CSV file uploaded");
    return res.status(400).json({ success: false, message: "No file uploaded" });
  }

  const filePath = req.file.path;
  const results = [];

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(filePath),
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const parts = line.split('|'); // assuming CSV uses | as delimiter
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

    fs.unlinkSync(filePath); // remove uploaded file
    res.json({ success: true, message: `${results.length} questions uploaded successfully!` });

  } catch (err) {
    console.error("❌ Error uploading questions:", err);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ success: false, message: "Failed to upload questions" });
  }
});


// Export player progress
app.get("api/admin/export/players", authMiddleware, adminOnly, async (req, res) => {
  try {
    // Join users and leaderboard, only players
    const [rows] = await pool.query(`
       SELECT 
        l.player_name AS name,
        u.email,
        l.score,
        l.level,
        u.created_at AS registered_at
      FROM leaderboard l
      JOIN users u ON l.player_name = u.name
      WHERE u.role = 'player'
      GROUP BY l.player_name, u.email, l.score, l.level, u.created_at
      ORDER BY l.player_name
  `);

    if (!rows.length) return res.status(404).json({ success: false, message: "No players found" });

    // Create Excel workbook
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Player Progress');

    // Header row
    sheet.addRow(['Name', 'Email', 'Score', 'Level']);

    // Add player rows
    rows.forEach(player => {
      sheet.addRow([player.name, player.email, player.score, player.level]);
    });

    // Send file to client
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename=player_progress.xlsx'
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error("❌ Failed to export progress:", err);
    res.status(500).json({ success: false, message: "Failed to export progress" });
  }
});


app.post("/api/admin/upload-players", authMiddleware, adminOnly, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });

  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(req.file.path);
    const sheet = workbook.worksheets[0];

    const players = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header
      const name = row.getCell(1).value?.toString();
      const email = row.getCell(2).value?.toString();
      const password = row.getCell(3).value?.toString();
      if (name && email && password) players.push({ name, email, password });
    });
for (const p of players) {
  // Insert into users table (skip if email already exists)
  await pool.query(
    "INSERT IGNORE INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'player')",
    [p.name, p.email, p.password]
  );

  // Insert into leaderboard table (skip if player_name already exists)
  await pool.query(
    "INSERT IGNORE INTO leaderboard (player_name) VALUES (?)",
    [p.name]
  );
}

    
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${players.length} players added successfully!` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to add players' });
  }
});
app.get("/questions", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM questions ORDER BY id"); 
    const rng = seedrandom(req.user.id + '-' + Date.now()); 
    const shuffledQuestions = rows.sort(() => rng() - 0.5); 

    const data = shuffledQuestions.map(q => {
      const options = [q.opt1, q.opt2, q.opt3, q.opt4];
      const optRng = seedrandom(req.user.id + '-' + q.id + '-' + Date.now());
      const shuffledOptions = options.sort(() => optRng() - 0.5);

      return {
        id: q.id,
        question: q.q_text,
        options: shuffledOptions,
        correct: q.correct_option,
        level: q.level
      };
    });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch questions' });
  }
});


app.post("/api/admin/remove-player", authMiddleware, adminOnly, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: "Email is required" });

  try {
    // Get player name before deletion
    const [rows] = await pool.query("SELECT name FROM users WHERE email = ? AND role = 'player'", [email]);
    if (!rows.length) return res.json({ success: false, message: "Player not found" });

    const playerName = rows[0].name;

    // Delete from users
    await pool.query("DELETE FROM users WHERE email = ? AND role = 'player'", [email]);

    // Delete from leaderboard
    await pool.query("DELETE FROM leaderboard WHERE player_name = ?", [playerName]);

    res.json({ success: true, message: `Player "${playerName}" removed successfully` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Failed to remove player" });
  }
});


const PORT = process.env.PORT||3000;
app.listen(PORT, () =>
  console.log(`✅ Server running on ${PORT}`)
);