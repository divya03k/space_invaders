# 🚀 Space Invaders Quiz Edition - Web Version

A web-native space shooter game with quiz questions, built with HTML5 Canvas and JavaScript. Fully mobile-friendly with touch controls and button-based navigation.

## ✨ Features

- 🎮 **Space Shooter Gameplay** - Classic space invader mechanics
- 📝 **Quiz System** - Answer questions to progress through levels
- 📱 **Mobile-Friendly** - Touch controls and responsive design
- 🎯 **Button Navigation** - All interactions use buttons (no keyboard required)
- 🏆 **Leaderboard** - Local storage-based high scores
- 🎨 **Multi-Level** - 5 different levels with unique visuals
- 🔊 **Sound Effects** - Background music and explosion sounds

## 🚀 Quick Start

### Option 1: Direct File Access

1. Open `index.html` in your web browser
2. That's it! No build process needed.

### Option 2: Local Server (Recommended)

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx http-server

# Then open http://localhost:8000
```

## 📁 Project Structure

```
.
├── index.html          # Main HTML file
├── styles.css          # All styling
├── game.js             # Game logic and mechanics
├── questions.txt       # Quiz questions
├── assets/             # Game assets (images, sounds)
│   ├── level1/
│   ├── level2/
│   ├── level3/
│   ├── level4/
│   ├── level5/
│   ├── bullet.png
│   ├── background.ogg
│   └── explosion.wav
└── README.md           # This file
```

## 🎮 How to Play

1. **Enter Your Name** - Type your name and click "Start Game"
2. **Move Your Ship** - Use touch/mouse or arrow keys to move
3. **Auto-Shoot** - Bullets fire automatically
4. **Answer Quizzes** - Every 10 seconds, answer a quiz question
5. **Progress** - Answer all questions in a level to advance
6. **Survive** - Avoid enemy collisions!

## 🎯 Controls

### Desktop
- **Arrow Keys / WASD** - Move player
- **Mouse** - Click and drag to move player
- **L Key** - View leaderboard

### Mobile
- **Touch Screen** - Tap and drag to move player
- **Direction Buttons** - Use on-screen buttons
- **Quiz Buttons** - Tap to answer questions

## 📝 Adding Questions

Edit `questions.txt` with this format:
```
Question?|Option1|Option2|Option3|Option4|CorrectAnswer
```

Example:
```
What is 2+2?|3|4|5|6|4
```

## 🌐 Deployment

### GitHub Pages
1. Push to GitHub repository
2. Go to Settings → Pages
3. Select branch and folder (root)
4. Done!

### Netlify
1. Drag and drop the entire folder to [netlify.com](https://netlify.com)
2. Get instant URL!

### Any Static Host
- Upload all files to your web server
- No build process needed!

## 🎨 Customization

### Change Canvas Size
Edit `game.js`:
```javascript
const CONFIG = {
    CANVAS_WIDTH: 1200,
    CANVAS_HEIGHT: 800,
    // ...
};
```

### Adjust Game Speed
Edit `game.js`:
```javascript
const CONFIG = {
    PLAYER_SPEED: 5,
    ENEMY_SPEED: 3,
    BULLET_SPEED: 15,
    // ...
};
```

### Change Quiz Interval
```javascript
const CONFIG = {
    QUIZ_INTERVAL: 10000, // milliseconds
    // ...
};
```

## 🐛 Troubleshooting

### Assets not loading
- Check that `assets/` folder exists
- Verify file paths are correct
- Check browser console for errors

### Game not working
- Open browser console (F12)
- Check for JavaScript errors
- Ensure `questions.txt` is accessible

### Mobile controls not showing
- Check screen width (should be < 768px)
- Verify CSS is loaded correctly

## 📱 Browser Support

- ✅ Chrome/Edge (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## 🎉 Credits

- Built with HTML5 Canvas
- Pure JavaScript (no frameworks)
- Mobile-first design

---

**Enjoy the game!** 🚀

