# Stockfish Engine - Quick Start Guide

## ⚡ 30-Second Setup

Already installed! The engine loads automatically when you start the app.

```bash
# Dev server (engine auto-loads)
npm run dev

# Production build
npm run build
npm run preview
```

Open http://localhost:5173/ and the engine initializes in the background.

## 🎮 Using the Engine

### Hint Button
```
1. Click "Hint" button
2. Engine analyzes for 1 second
3. Best move highlighted: blue (from) → green (to)
4. Evaluation shown in status bar
5. Highlight auto-clears after 3 seconds
```

### Analyze Button
```
1. Click "Analyze" button
2. Engine performs deep analysis (20 seconds)
3. Status bar shows: "Eval: +0.45 | Depth: 18"
4. Game remains fully playable
5. Click again to start new analysis
```

### Status Display
```
"Initializing..." → Loading engine (500-1000ms)
"Ready"          → Engine ready for analysis
"Analyzing..."   → Analysis in progress
"Eval: ..."      → Shows evaluation and depth
"Failed"         → Engine unavailable (game still works)
```

## 🔧 In Your Code

### Get the Engine
```typescript
import { getEngine } from './engineManager.js';

const engine = await getEngine();
```

### Analyze a Position
```typescript
// Best move (1 second)
const move = await engine.getBestMove(fen, 15, 1000);
// Result: "e2e4"

// Position evaluation (score in centipawns)
const score = await engine.evaluatePosition(fen, 15);
// Result: 45 (white +0.45 pawns better)

// Detailed analysis
const analysis = await engine.evaluatePositionDetailed(fen, 20);
// Result: Array with depth, score, nodes, pv for each depth
```

### Use with ChessPosition
```typescript
import { ChessPosition } from './chessgame.js';

// Position automatically has access to engine
const position = new ChessPosition(fen, engine);

// Get best move
const move = await position.getEngineBestMove(15, 1000);

// Evaluate position
const score = await position.getEngineEvaluation(20);

// Get detailed analysis
const analysis = await position.getEngineAnalysis(18);
```

### Configure Threads & Memory
```typescript
engine.setThreads(4);      // Use 4 CPU threads (default: all)
engine.setHashSize(256);   // 256 MB (default: 128 MB)
engine.clearHash();        // Clear analysis cache
```

## 📊 Performance

| Analysis Depth | Time | Speed |
|---|---|---|
| 10 | 0.2-0.5s | ⚡⚡⚡ Fast |
| 12 | 0.5-2s | ⚡⚡ Normal |
| 15 | 1-3s | ⚡ OK |
| 18 | 3-8s | 🐢 Slow |
| 20+ | 10-30s | 🐢🐢 Very slow |

**Hint button**: Uses depth 15 (1 second timeout)
**Analyze button**: Uses depth 20 (20 second timeout)

## 🧪 Testing

### Run Tests from Browser Console
```javascript
await testEngine()
```

**Output**:
```
✓ Engine initialization (234ms)
✓ Best move from starting position (523ms)
✓ Position evaluation (412ms)
✓ Detailed position analysis (1254ms)
... (6 more tests)

10/10 tests passed - 4234ms total
```

### Troubleshoot
```javascript
// Check if engine is ready
isEngineReady()  // Returns true/false

// Check if currently analyzing
isEngineSearching()  // Returns true/false

// Get engine instance (if ready)
getEngineIfReady()  // Returns engine or null
```

## 📁 Files

**New files** (4):
- `js/engine.ts` - Core engine abstraction
- `js/engineManager.ts` - Singleton manager
- `js/engine-test.ts` - Test suite
- `scripts/copy-stockfish.js` - Build helper

**Updated files** (6):
- `js/chessgame.ts` - Engine methods added
- `js/main.ts` - UI integration
- `index.html` - Hint/Analyze buttons
- `css/style.css` - Engine styling
- `package.json` - Stockfish dependency
- `vite.config.ts` - CORS config

## ✅ Architecture

```
Game UI (main.ts)
    ↓
ChessPosition (chess logic)
    ↓
EngineManager (global instance)
    ↓
ChessEngine (UCI protocol)
    ↓
Web Worker (Stockfish WASM)
```

**Why Web Worker?** Stockfish analysis is CPU-intensive. Web Worker keeps chess board interactive.

## 🎯 Use Cases

### 1. Learning Helper
```typescript
// Get hint for player
const bestMove = await position.getEngineBestMove(15, 1000);
showHint(bestMove);
```

### 2. Game Analysis
```typescript
// Analyze entire game move-by-move
const game = ["e2e4", "c7c5", "g1f3", ...];
for (const move of game) {
  const eval = await position.getEngineEvaluation(20);
  addAnalysis(move, eval);
  position.move(move);
}
```

### 3. Puzzle Solver
```typescript
// Check if move is engine-approved
const bestMove = await position.getEngineBestMove(18, 2000);
if (playerMove === bestMove) {
  console.log("Perfect!");
}
```

### 4. Strength Handicap
```typescript
// Weaker engine (faster, less analysis)
const easyMove = await engine.getBestMove(fen, 8, 200);

// Stronger engine (slower, deeper)
const hardMove = await engine.getBestMove(fen, 25, 5000);
```

## 🚀 Advanced Usage

### Batch Analysis
```typescript
const positions = [fen1, fen2, fen3, ...];
const evaluations = await Promise.all(
  positions.map(fen => engine.evaluatePosition(fen, 15))
);
```

### Real-time Evaluation
```typescript
// Show evaluation as player moves pieces
async function updateEval() {
  const score = await chess.getEngineEvaluation(15);
  updateEvaluationBar(score);
}
```

### Opening Book + Engine
```typescript
// Could combine with opening book
if (position.isOpeningPosition()) {
  return lookupOpening(fen);
} else {
  return engine.getBestMove(fen, depth, time);
}
```

## 🐛 Error Handling

```typescript
try {
  const move = await engine.getBestMove(fen, 15, 1000);
  // Success
} catch (error) {
  console.error('Analysis failed:', error);
  // Fallback: game still playable
}
```

**Graceful degradation**: If engine unavailable, game is 100% playable. No errors shown to user.

## 📚 Full Documentation

- **ENGINE_IMPLEMENTATION.md** - Technical details
- **INTEGRATION_SUMMARY.md** - Complete overview
- **STOCKFISH_INTEGRATION_PLAN.md** - Design document

## 🔗 Resources

- [Stockfish GitHub](https://github.com/official-stockfish/Stockfish)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js)
- [UCI Protocol](https://www.wbec-ridderkerk.nl/html/UCIProtocol.html)
- [Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)

## 💡 Tips

1. **Faster analysis**: Lower depth (10-12 instead of 15-20)
2. **Better hints**: Higher depth (18-20) with longer time
3. **Mobile**: Lite engine is already optimized for mobile
4. **Multiple searches**: Can run 1-2 second searches frequently
5. **Transposition table**: Leave hash at default (128MB) unless memory constrained

## ⚙️ Configuration

### Change default depth in code
```typescript
// In main.ts
const HINT_DEPTH = 12;      // Default 15
const ANALYZE_DEPTH = 18;   // Default 20
const ANALYZE_TIME = 10000;  // Default 20000 (milliseconds)
```

### Reduce memory usage
```typescript
engine.setHashSize(64);     // Default 128MB
engine.setThreads(2);       // Default: all cores
```

### Manual engine path
```typescript
const engine = await getEngine('/path/to/stockfish.js');
```

## 🎓 Learning Resources

**For chess**: Stockfish is one of the strongest engines (~2500 ELO). Use for:
- Finding mistakes in your games
- Solving chess puzzles
- Preparing openings
- Understanding positions

**For coding**: See engine.ts for:
- Web Worker patterns
- Promise-based async operations
- UCI protocol implementation
- TypeScript interfaces

---

**Ready to go!** Click "Hint" or "Analyze" to use the engine.
