// leaderboard.js
import pool from "./db.js";

// Add a new player score
export async function addScore(playerName, score, level = 1) {
  const sql = "INSERT INTO leaderboard (player_name, score, level) VALUES (?, ?, ?)";
  const params = [playerName, score, level];

  try {
    const [result] = await pool.execute(sql, params);
    console.log(`✅ Score added for ${playerName}: ${score}`);
    return result.insertId;
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      console.log(`⚠️ Player '${playerName}' already exists. Updating score instead.`);
      await pool.execute(
        "UPDATE leaderboard SET score = ?, level = ?, last_played = NOW() WHERE player_name = ?",
        [score, level, playerName]
      );
    } else {
      console.error("❌ Error adding score:", err.message);
    }
  }
}

// Get top 10 players
export async function getTopScores(limit = 10) {
  const sql = "SELECT player_name, score, level, last_played FROM leaderboard ORDER BY score DESC LIMIT 5";
  const [rows] = await pool.execute(sql, [limit]);
  return rows;
}
