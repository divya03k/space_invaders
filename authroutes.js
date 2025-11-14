// authRoutes.js
import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import pool from "./db.js"; // ✅ import ONLY from db.js

const router = express.Router();

// 🔐 Middleware: Verify JWT
export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ success: false, message: "No token provided" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await pool.query("SELECT * FROM users WHERE id = ?", [decoded.userId]);

    if (!rows.length) {
      return res.status(401).json({ success: false, message: "Invalid token" });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(401).json({ success: false, message: "Token expired or invalid" });
  }
};

// 🔐 Middleware: Admin only
export const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admins only" });
  }
  next();
};

// 🧩 LOGIN Route
router.post("/login", async (req, res) => {
  const { email, password, role } = req.body;

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ? AND role = ?",
      [email, role]
    );

    const user = rows[0];
    if (!user) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    // ✅ Compare plain password (or use bcrypt if hashed)
    const passwordMatch = user.password_hash === password;
    if (!passwordMatch) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    // ✅ Generate token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "24h" });

    res.json({
      success: true,
      token,
      name: user.name,
      role: user.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Server error during login" });
  }
});

// 🧩 REGISTER Route for new players
router.post("/register", async (req, res) => {
  const { name, email, password } = req.body;

  try {
    // Check if user already exists
    const [existing] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1️⃣ Insert new player into users table
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
      [name, email, hashedPassword, "player"]
    );

    // 2️⃣ Insert default entry in leaderboard
    await pool.query(
      `INSERT INTO leaderboard (player_name, score, level, last_played)
       VALUES (?, 0, 0, NOW())`,
      [name]
    );

    res.json({ success: true, message: "Player registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

export default router;
