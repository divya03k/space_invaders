// index.js
import pool from "./db.js";

async function testConnection() {
  try {
    console.log("Connecting to TiDB Cloud...");
    const [rows] = await pool.query("SELECT * FROM leaderboard ORDER BY score DESC LIMIT 10;");
    console.log("Leaderboard rows:", rows);
  } catch (err) {
    console.error("ERROR connecting to DB:", err.message || err);
  } finally {
    await pool.end();
    console.log("Connection closed.");
  }
}

testConnection();
