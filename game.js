// ============================================
// SPACE INVADERS QUIZ - FULLY WORKING WITH ALL ASSETS
// NO BLUE BOX, REAL GRAPHICS, INSTANT START
// ============================================

const CONFIG = {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800,
    LEVELS: 5,
    QUIZ_INTERVAL: 10000,
    BULLET_INTERVAL: 300,
    ENEMY_SPAWN_INTERVAL: 1200,
    PLAYER_SPEED: 8,
    ENEMY_SPEED: 3,
    BULLET_SPEED: 15
};

const gameState = {
    playerName: '',
    score: 0,
    level: 1,
    playerX: 550,
    playerY: 650,
    bullets: [],
    enemies: [],
    enemySpawnTimer: 0,
    bulletTimer: 0,
    quizTimer: 0,
    gameOver: false,
    quizMode: false,
    questions: {},
    assets: { backgrounds: {}, player: null, enemies: {}, bullet: null }
};

const elements = {
    nameScreen: document.getElementById('nameScreen'),
    gameScreen: document.getElementById('gameScreen'),
    quizScreen: document.getElementById('quizScreen'),
    gameOverScreen: document.getElementById('gameOverScreen'),
    leaderboardScreen: document.getElementById('leaderboardScreen'),
    canvas: document.getElementById('gameCanvas'),
    nameInput: document.getElementById('nameInput'),
    startBtn: document.getElementById('startBtn'),
    restartBtn: document.getElementById('restartBtn'),
    leaderboardBtn: document.getElementById('leaderboardBtn'),
    backToGameBtn: document.getElementById('backToGameBtn'),
    scoreDisplay: document.getElementById('scoreDisplay'),
    levelDisplay: document.getElementById('levelDisplay'),
    playerNameDisplay: document.getElementById('playerNameDisplay'),
    finalScore: document.getElementById('finalScore'),
    quizLevel: document.getElementById('quizLevel'),
    quizQuestion: document.getElementById('quizQuestion'),
    quizOptions: document.getElementById('quizOptions'),
    quizFeedback: document.getElementById('quizFeedback'),
    leaderboardList: document.getElementById('leaderboardList'),
    leftBtn: document.getElementById('leftBtn'),
    rightBtn: document.getElementById('rightBtn'),
    upBtn: document.getElementById('upBtn'),
    downBtn: document.getElementById('downBtn'),
    returnHomeBtn: document.getElementById('returnHomeBtn'),
    exitGameBtn: document.getElementById("exitGameBtn")
};

let ctx = null;
// ======================
// SOUND EFFECTS
// ======================
const sounds = {
    background: new Audio('assets/background.ogg'),
    explosion: new Audio('assets/explosion.wav')
};

sounds.background.loop = true;
sounds.background.volume = 0.4;
sounds.explosion.volume = 0.8;

let keys = {};
let touchX = 0, touchY = 0;
let isTouching = false;

// ======================
// LOAD IMAGE SAFELY
// ======================
function loadImage(src, fallbackColor = '#00ff00') {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn(`Asset missing: ${src} → using fallback`);
            const canvas = document.createElement('canvas');
            canvas.width = src.includes('background') ? 1200 : src.includes('enemy') ? 80 : src.includes('bullet') ? 25 : 100;
            canvas.height = src.includes('background') ? 800 : src.includes('enemy') ? 80 : src.includes('bullet') ? 50 : 100;
            const c = canvas.getContext('2d');
            c.fillStyle = fallbackColor;
            c.fillRect(0, 0, canvas.width, canvas.height);
            const fallback = new Image();
            fallback.src = canvas.toDataURL();
            fallback.onload = () => resolve(fallback);
        };
        img.src = src + '?v=' + Date.now();
    });
}

// ======================
// LOAD ALL ASSETS
// ======================
async function loadAssets() {
    // Backgrounds
    for (let i = 1; i <= 5; i++) {
        gameState.assets.backgrounds[i] = await loadImage(`assets/level${i}/background.jpg`, '#000033');
    }
    // Enemies
    for (let i = 1; i <= 5; i++) {
        gameState.assets.enemies[i] = await loadImage(`assets/level${i}/enemy.png`, '#ff0055');
    }
    // Player & Bullet
    gameState.assets.player = await loadImage('assets/level1/player.png', '#00ff00');
    gameState.assets.bullet = await loadImage('assets/bullet.png', '#ffff00');
}

// ======================
// LOAD QUESTIONS
// ======================
async function loadQuestions() {
    try {
        const token = localStorage.getItem('token'); // JWT from login
        const r = await fetch('https://space-invaders-cddi.onrender.com/questions', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!r.ok) throw 0;

        const allFromDB = await r.json(); // Array of questions from DB

        // Map DB format to your gameState structure
        const all = allFromDB.map(q => ({
            question: q.question,
            options: q.options, // already shuffled by backend
            correctAnswer: q.correct,
            answered: false
        }));

        if (all.length) {
            const per = Math.ceil(all.length / 5); // Divide into 5 levels
            for (let i = 1; i <= 5; i++) {
                gameState.questions[i] = all.slice((i - 1) * per, i * per);
            }
        }
    } catch (e) {
        console.error("Failed to load questions from DB:", e);

        // Fallback if DB fails
        gameState.questions = {
            1: [{question:"2+2=?",options:["3","4","5","6"],correctAnswer:"4",answered:false}],
            2: [{question:"Capital of France?",options:["London","Paris","Berlin","Rome"],correctAnswer:"Paris",answered:false}],
            3: [{question:"5×5=?",options:["20","25","30","35"],correctAnswer:"25",answered:false}],
            4: [{question:"H₂O is?",options:["Air","Water","Salt","CO2"],correctAnswer:"Water",answered:false}],
            5: [{question:"Largest planet?",options:["Earth","Jupiter","Mars","Venus"],correctAnswer:"Jupiter",answered:false}]
        };
    }
}

// ======================
// CANVAS SETUP
// ======================
function resizeCanvas() {
    const ratio = CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT;
    let w = window.innerWidth * 0.95;
    let h = w / ratio;
    if (h > window.innerHeight * 0.85) { h = window.innerHeight * 0.85; w = h * ratio; }
    elements.canvas.style.width = w + 'px';
    elements.canvas.style.height = h + 'px';
    elements.canvas.width = CONFIG.CANVAS_WIDTH;
    elements.canvas.height = CONFIG.CANVAS_HEIGHT;
    ctx = elements.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
}

// ======================
// GAME LOGIC
// ======================
function resetGame() {
    gameState.playerX = 550;
    gameState.playerY = 650;
    gameState.bullets = [];
    gameState.enemies = [];
    gameState.enemySpawnTimer = 0;
    gameState.bulletTimer = 0;
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'gameScreen') draw();
}

function showQuiz() {
    const qs = gameState.questions[gameState.level] || [];
    const pending = qs.filter(q => !q.answered);
    if (!pending.length) {
        if (gameState.level < 5) {
            gameState.level++;
            resetGame();
            gameState.quizTimer = Date.now();
            showScreen('gameScreen');
        } else {
            endGame();
        }
        return;
    }

    // Pick the first pending question (we will keep asking it until correct)
    const q = pending[0];
    gameState.currentQuiz = { level: gameState.level, index: qs.indexOf(q) }; // remember which question we're asking
    gameState.quizMode = true;

    elements.quizLevel.textContent = gameState.level;
    elements.quizQuestion.textContent = q.question;
    elements.quizOptions.innerHTML = '';
    elements.quizFeedback.textContent = '';

    // helper to highlight correct answer (used on wrong)
    function highlightCorrect() {
        Array.from(elements.quizOptions.children).forEach(btn => {
            if (btn.dataset.option === q.correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }

    q.options.forEach(opt => {
        const btn = document.createElement('div');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.dataset.option = opt;

        btn.onclick = () => {
            // If already answered correctly, ignore clicks
            if (q.answered) return;

            if (opt === q.correctAnswer) {
                // Correct answer: mark answered and award points
                q.answered = true;
                gameState.score += 100 * gameState.level;
                btn.classList.add('correct');
                elements.quizFeedback.textContent = 'Correct!';
                elements.quizFeedback.className = 'quiz-feedback correct';

                elements.scoreDisplay.textContent = gameState.score;

                // Short delay, then exit quiz
                setTimeout(() => {
                    gameState.quizMode = false;
                    gameState.quizTimer = Date.now();
                    showScreen('gameScreen');
                }, 1500);
            } else {
                // Wrong answer: show wrong UI, highlight the correct answer,
                // DO NOT mark q.answered so it will be asked again.
                btn.classList.add('wrong');
                elements.quizFeedback.textContent = 'Wrong! The correct answer is highlighted.';
                elements.quizFeedback.className = 'quiz-feedback wrong';

                // highlight the correct option
                highlightCorrect();

                // After a short pause, remove wrong highlight and re-show same question
                // Show correct answer briefly, then return to game and re-ask later
setTimeout(() => {
  Array.from(elements.quizOptions.children).forEach(b => b.classList.remove('wrong'));
  elements.quizFeedback.textContent = 'Review the correct answer...';
  
  setTimeout(() => {
    // remove highlight and return to game
    Array.from(elements.quizOptions.children).forEach(b => b.classList.remove('correct'));
    elements.quizFeedback.textContent = '';
    gameState.quizMode = false;
    gameState.quizTimer = Date.now();

    // Resume game
    showScreen('gameScreen');

    // After 5 seconds, re-ask the same question
    setTimeout(() => {
      if (!q.answered && !gameState.gameOver) showQuiz();
    }, 5000);
  }, 1500);
}, 1200);

                }
        };

        elements.quizOptions.appendChild(btn);
    });

    showScreen('quizScreen');
}

function updatePlayer() {
    if (keys.ArrowLeft) gameState.playerX -= CONFIG.PLAYER_SPEED;
    if (keys.ArrowRight) gameState.playerX += CONFIG.PLAYER_SPEED;
    if (keys.ArrowUp) gameState.playerY -= CONFIG.PLAYER_SPEED;
    if (keys.ArrowDown) gameState.playerY += CONFIG.PLAYER_SPEED;
    if (isTouching) {
        const r = elements.canvas.getBoundingClientRect();
        gameState.playerX = ((touchX - r.left) / r.width) * CONFIG.CANVAS_WIDTH - 50;
        gameState.playerY = ((touchY - r.top) / r.height) * CONFIG.CANVAS_HEIGHT - 50;
    }
    gameState.playerX = Math.max(0, Math.min(CONFIG.CANVAS_WIDTH - 100, gameState.playerX));
    gameState.playerY = Math.max(0, Math.min(CONFIG.CANVAS_HEIGHT - 100, gameState.playerY));
}

function updateBullets() {
    if (Date.now() - gameState.bulletTimer > CONFIG.BULLET_INTERVAL) {
        gameState.bullets.push({x: gameState.playerX + 37, y: gameState.playerY});
        gameState.bulletTimer = Date.now();
    }
    gameState.bullets = gameState.bullets.filter(b => { b.y -= CONFIG.BULLET_SPEED; return b.y > -50; });
}

function updateEnemies() {
    if (Date.now() - gameState.enemySpawnTimer > CONFIG.ENEMY_SPAWN_INTERVAL) {
        gameState.enemies.push({x: Math.random() * (CONFIG.CANVAS_WIDTH - 80), y: -80});
        gameState.enemySpawnTimer = Date.now();
    }
    gameState.enemies.forEach(e => e.y += CONFIG.ENEMY_SPEED);
}

function checkCollisions() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const b = gameState.bullets[i];
        for (let j = gameState.enemies.length - 1; j >= 0; j--) {
            const e = gameState.enemies[j];
            if (b.x > e.x && b.x < e.x + 80 && b.y > e.y && b.y < e.y + 80) {
    // 💥 Play explosion sound
    sounds.explosion.currentTime = 0;
    sounds.explosion.play();

    gameState.bullets.splice(i, 1);
    gameState.enemies.splice(j, 1);
    gameState.score += 10;
    elements.scoreDisplay.textContent = gameState.score;
    break;
}

        }
    }
    gameState.enemies.forEach(e => {
        if (e.x < gameState.playerX + 100 && e.x + 80 > gameState.playerX && e.y < gameState.playerY + 100 && e.y + 80 > gameState.playerY) endGame();
    });
}

function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Background
    const bg = gameState.assets.backgrounds[gameState.level];
    if (bg) ctx.drawImage(bg, 0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

    // Player
    const player = gameState.assets.player;
    if (player) ctx.drawImage(player, gameState.playerX, gameState.playerY, 100, 100);

    // Bullets
    const bullet = gameState.assets.bullet;
    gameState.bullets.forEach(b => {
        if (bullet) ctx.drawImage(bullet, b.x, b.y, 25, 50);
    });

    // Enemies
    const enemy = gameState.assets.enemies[gameState.level];
    gameState.enemies.forEach(e => {
        if (enemy) ctx.drawImage(enemy, e.x, e.y, 80, 80);
    });
}

function gameLoop() {
    requestAnimationFrame(gameLoop);
    if (!elements.gameScreen.classList.contains('active')) return;
    if (!gameState.quizMode && !gameState.gameOver) {
        if (Date.now() - gameState.quizTimer >= CONFIG.QUIZ_INTERVAL) { showQuiz(); return; }
        updatePlayer();
        updateBullets();
        updateEnemies();
        checkCollisions();
    }
    draw();
}

// ======================
// INPUT & UI
// ======================
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

elements.canvas.addEventListener('touchstart', e => { e.preventDefault(); isTouching = true; const r = elements.canvas.getBoundingClientRect(); touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; });
elements.canvas.addEventListener('touchmove', e => { e.preventDefault(); if (e.touches[0]) { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }});
elements.canvas.addEventListener('touchend', () => isTouching = false);

['leftBtn','rightBtn','upBtn','downBtn'].forEach(id => {
    const key = id === 'leftBtn' ? 'ArrowLeft' : id === 'rightBtn' ? 'ArrowRight' : id === 'upBtn' ? 'ArrowUp' : 'ArrowDown';
    elements[id].ontouchstart = elements[id].onmousedown = e => { e.preventDefault(); keys[key] = true; };
    elements[id].ontouchend = elements[id].onmouseup = () => keys[key] = false;
});

elements.startBtn.onclick = () => {
    const name = elements.nameInput.value.trim();
    if (!name) return;
    gameState.playerName = name;
    elements.playerNameDisplay.textContent = name;
    elements.scoreDisplay.textContent = '0';
    elements.levelDisplay.textContent = '1';
    
    gameState.playernamer = name;
    showScreen('gameScreen');
    // 🎵 Start background sound
if (sounds.background.paused) {
    try {
        sounds.background.currentTime = 0;
        sounds.background.play().catch(err => console.warn("Autoplay blocked:", err));
    } catch (e) {
        console.warn("Audio playback error:", e);
    }
}

};



elements.leaderboardBtn.onclick = () => { displayLeaderboard(); showScreen('leaderboardScreen'); };
// View player's score and level button
elements.viewStatsBtn = document.getElementById('viewStatsBtn');
const statsPopup = document.getElementById('statsPopup');
const statsText = document.getElementById('statsText');
const closeStatsBtn = document.getElementById('closeStatsBtn');


elements.exitGameBtn.onclick = () => {
  showScreen("exitScreen");
};

closeStatsBtn.onclick = () => {
  statsPopup.classList.add('hidden');
};
// Restart game after Game Over
document.getElementById("restartBtn").onclick = () => {
  // Reset only dynamic elements (not name or score)
  gameState.gameOver = false;
  gameState.quizMode = false;
  gameState.bullets = [];
  gameState.enemies = [];
  gameState.enemySpawnTimer = 0;
  gameState.bulletTimer = 0;
  gameState.quizTimer = Date.now(); // restart timer so quiz doesn't trigger instantly

  // Resume background sound
  try {
    sounds.background.currentTime = 0;
    sounds.background.play();
  } catch (err) {
    console.warn("Audio resume error:", err);
  }

  // Return to game screen and resume gameplay
  showScreen("gameScreen");
};

// Back from leaderboard to Game Over screen
document.getElementById("backToGameOverBtn").onclick = () => {
  showScreen("gameOverScreen");
};


function endGame() {
    sounds.background.pause();
    sounds.background.currentTime = 0;

    gameState.gameOver = true;
    elements.finalScore.textContent = `Score: ${gameState.score} | Level ${gameState.level}`;
    saveScore(gameState.playerName, gameState.score);
    showScreen('gameOverScreen');
}
// ======================
// SAVE SCORE TO SERVER (TiDB Cloud via Node backend)
// ======================
async function saveScore(name, score) {
    try {
        const res = await fetch("https://space-invaders-cddi.onrender.comapi/auth/add-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                playerName: name,
                score: score,
                level: gameState.level
            })
        });
        const data = await res.json();
        if (!data.success) throw new Error("Server error");
        console.log("✅ Score saved successfully!");
    } catch (err) {
        console.error("❌ Failed to save score:", err.message);
    }
}

// ======================
// FETCH LEADERBOARD FROM SERVER
// ======================
async function displayLeaderboard() {
    try {
        const res = await fetch("https://space-invaders-cddi.onrender.com/leaderboard");
        const scores = await res.json();

        elements.leaderboardList.innerHTML = scores.length
            ? ""
            : "<p>No scores yet!</p>";

        scores.forEach((s, i) => {
            const div = document.createElement("div");
            div.className = `leaderboard-item rank-${i + 1}`;
            div.innerHTML = `<span>#${i + 1}</span><span>${s.player_name}</span><span>${s.score}</span>`;
            elements.leaderboardList.appendChild(div);
        });
    } catch (err) {
        console.error("❌ Failed to load leaderboard:", err.message);
        elements.leaderboardList.innerHTML = "<p>Error loading leaderboard!</p>";
    }
}


// ======================
// START
// ======================
async function init() {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Load assets + questions
    await Promise.all([loadAssets(), loadQuestions()]);

    // Show name screen
    showScreen('nameScreen');
    elements.nameInput.focus();

    // Start loop
    requestAnimationFrame(gameLoop);
}

init();
// Auto-fill name if available (from login)
const savedName = localStorage.getItem("playerName");
if (savedName && elements.nameInput) {
  elements.nameInput.value = savedName;
}


// ======================
// PLAYER STATS POPUP HANDLERS
// ======================
window.addEventListener("DOMContentLoaded", () => {
    const viewStatsBtn = document.getElementById("viewStatsBtn");
    const leaderboardBtn = document.getElementById("leaderboardBtn");
    const statsPopup = document.getElementById("statsPopup");
    const statsText = document.getElementById("statsText");
    const closeStatsBtn = document.getElementById("closeStatsBtn");

    if (viewStatsBtn) {
        viewStatsBtn.onclick = () => {
            statsText.textContent = `${gameState.playerName}, your final score is ${gameState.score} at Level ${gameState.level}!`;
            statsPopup.classList.remove("hidden");
        };
    }

    if (closeStatsBtn) {
        closeStatsBtn.onclick = () => statsPopup.classList.add("hidden");
    }
});