# 24 Game

A web-based implementation of the classic 24 game where players use 4 numbers and basic arithmetic operations to make 24.

## 🎮 How to Play

1. You'll be given 4 random numbers (1-9)
2. Use all 4 numbers exactly once with basic arithmetic operations (+, -, ×, ÷)
3. The goal is to create an expression that equals 24
4. Click a number, then an operator, then another number to combine them
5. Keep combining until you have one card with value 24!

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The game will open in your browser at `http://localhost:3000`

## 🛠️ Tech Stack

- **Frontend**: TypeScript, Vite
- **Styling**: Tailwind CSS
- **Game Logic**: Custom solver algorithm

## 🎯 Features

- ✅ Random number generation with guaranteed solutions
- ✅ Interactive card-based gameplay
- ✅ Undo functionality
- ✅ Timer tracking (total and round time)
- ✅ Streak-based scoring
- ✅ Hint system
- ✅ Responsive mobile-first design

## 🎨 Design

- **Mobile-first** responsive design
- **Flush grid layout** with no gaps between tiles
- **Fixed positions** - cards maintain their original positions
- **Clean interface** with minimal distractions

## 🧮 Algorithm

The game uses a custom solver that:
1. Generates all permutations of the 4 numbers
2. Tries all combinations of operators (+, -, ×, ÷)
3. Tests different grouping patterns (parentheses)
4. Ensures only solvable number sets are presented

## 📁 Project Structure

```
src/
├── main.ts          # Entry point
├── game24.ts        # Main game logic and UI
├── solver24.ts      # Algorithm to check for solutions
└── style.css        # Global styles and Tailwind imports
```

## 🚀 Deployment

Build for production:
```bash
npm run build
```

Deploy to any static hosting service (Vercel, Netlify, GitHub Pages).
