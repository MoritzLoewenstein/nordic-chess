# NordicChess Architecture & Technical Documentation

Complete technical reference for developers, architects, and maintainers.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [File Structure](#file-structure)
3. [Core Components](#core-components)
4. [Engine Integration](#engine-integration)
5. [API Reference](#api-reference)
6. [Build & Deployment](#build--deployment)
7. [Development Guide](#development-guide)
8. [Performance](#performance)
9. [Known Limitations](#known-limitations)

---

## System Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────┐
│           UI Layer (Browser)                             │
│  ├─ index.html (structure)                              │
│  ├─ css/style.css (styling)                             │
│  └─ main.ts (UI logic & game controller)                │
└─────────────────────────────────────────────────────────┘
                         ↓↑
┌─────────────────────────────────────────────────────────┐
│      Business Logic Layer                                │
│  ├─ chessgame.ts (ChessPosition class)                  │
│  ├─ parser.ts (FEN parsing)                             │
│  ├─ validator.ts (move validation)                      │
│  ├─ funcs.ts (utility functions)                        │
│  └─ constants.ts (game constants)                       │
└─────────────────────────────────────────────────────────┘
                         ↓↑
┌─────────────────────────────────────────────────────────┐
│      Engine Abstraction Layer                            │
│  ├─ engineManager.ts (singleton pattern)                │
│  └─ engine.ts (UCI protocol handler)                    │
└─────────────────────────────────────────────────────────┘
                         ↓↑
┌─────────────────────────────────────────────────────────┐
│      Worker & WASM Layer                                │
│  └─ Web Worker (Stockfish WASM)                         │
└─────────────────────────────────────────────────────────┘
```

### Design Principles

- **Separation of Concerns**: Chess logic, UI, and engine are isolated
- **Minimal Chess-Specific Code**: Use Stockfish for analysis, local code for board state
- **Async/Await**: All engine operations are non-blocking promises
- **Web Worker**: CPU-intensive work runs off the main thread
- **Type Safety**: Full TypeScript for all code

---

## File Structure

### Project Layout

```
NordicChess/
├── public/
│   └── stockfish/              # Engine files (auto-copied)
│
├── js/
│   ├── main.ts                 # Entry point & UI controller
│   ├── chessgame.ts            # ChessPosition class (game logic)
│   ├── parser.ts               # FEN parsing
│   ├── validator.ts            # Move validation
│   ├── funcs.ts                # Utility functions
│   ├── constants.ts            # Game constants
│   ├── engine.ts               # ChessEngine class (UCI protocol)
│   ├── engineManager.ts        # Singleton engine manager
│   ├── engine-test.ts          # Test suite
│   └── test.ts                 # Other tests
│
├── css/
│   └── style.css               # Styling
│
├── scripts/
│   └── copy-stockfish.js       # Build helper
│
├── docs/
│   └── ARCHITECTURE.md         # This file
│
├── index.html                  # Main HTML
├── package.json                # Dependencies & scripts
├── vite.config.ts              # Vite configuration
├── tsconfig.json               # TypeScript configuration
├── biome.json                  # Code formatter config
│
└── dist/                       # Build output (auto-generated)
```

---

## Core Components

### 1. ChessPosition (js/chessgame.ts)

The main class representing a chess position.

```typescript
class ChessPosition {
  board: Piece[][]; // 8x8 board
  color: "w" | "b"; // Active color
  castlingAvailability: string; // Castling rights
  enPassantSquare: string | null; // En passant target
  halfMoveClock: number; // 50-move rule
  fullMoveNumber: number; // Move number

  private engine: ChessEngine | null; // Engine reference

  // Methods
  toFen(): string;
  move(move: [number, number]): void;
  getPossibleSquares(sq: number): [number, number][];

  // Engine methods
  setEngine(engine: ChessEngine): void;
  getEngineBestMove(depth?: number, timeMs?: number): Promise<string>;
  getEngineEvaluation(depth?: number): Promise<number>;
  getEngineAnalysis(depth?: number): Promise<EngineInfo[]>;
}
```

**Key Responsibilities**:

- Maintain board state
- Generate legal moves
- Handle piece movement
- Export to FEN format
- Delegate analysis to engine

### 2. ChessEngine (js/engine.ts)

Abstraction layer for Stockfish engine communication.

```typescript
class ChessEngine {
  private worker: Worker | null;
  private responseHandlers: Map<string, Function>;
  private ready: boolean;

  // Initialization
  initialize(workerPath?: string): Promise<void>;

  // Analysis
  getBestMove(fen: string, depth?: number, timeMs?: number): Promise<string>;
  evaluatePosition(fen: string, depth?: number): Promise<number>;
  evaluatePositionDetailed(fen: string, depth?: number): Promise<EngineInfo[]>;

  // Configuration
  setThreads(count: number): void;
  setHashSize(sizeInMb: number): void;
  clearHash(): void;

  // Lifecycle
  terminate(): void;
}
```

**Key Responsibilities**:

- UCI protocol handling
- Web Worker communication
- Response parsing
- Configuration management
- Proper cleanup

### 3. Engine Manager (js/engineManager.ts)

Singleton pattern for global engine instance.

```typescript
// Exported functions
async getEngine(path?: string): Promise<ChessEngine>
function closeEngine(): void
function isEngineReady(): boolean
function isEngineSearching(): boolean
function getEngineIfReady(): ChessEngine | null
```

**Key Responsibilities**:

- Lazy initialization (load only when needed)
- Global instance management
- Prevent multiple engine instances
- Resource cleanup

### 4. Main Controller (js/main.ts)

Game controller and UI integration.

**Key Functions**:

- `loadFen(setup?: boolean)`: Load position
- `flipBoard()`: Flip perspective
- `playMove(index: number)`: Handle move input
- `getHint()`: Get engine suggestion
- `analyzePosition()`: Deep analysis
- `showMoveHint(move: string)`: Highlight move

**Event Handlers**:

- Board squares: Click to select/move
- Hint button: Get 1-second suggestion
- Analyze button: Get 20-second analysis
- FEN input: Load custom position
- Flip button: Change perspective

---

## Engine Integration

### UCI Protocol Overview

UCI (Universal Chess Interface) is the standard protocol for chess engines.

**Key Commands**:

```
uci                           → Initialize engine
position fen [FEN]            → Set board position
go depth [n]                  → Analyze for depth n
go movetime [ms]              → Analyze for time ms
go depth [n] movetime [ms]    → Analyze with both limits
setoption name [key] value [v] → Set configuration
quit                          → Shutdown engine
```

**Key Responses**:

```
uciok                                    → Engine ready
bestmove e2e4 ponder d7d5                → Best move found
info depth 18 score cp 50 pv e2e4 c7c5  → Analysis info
```

### EngineInfo Interface

```typescript
interface EngineInfo {
  depth: number; // Search depth
  seldepth?: number; // Selective depth
  time: number; // Time in milliseconds
  nodes: number; // Nodes searched
  nps?: number; // Nodes per second
  score: number; // Position score (centipawns)
  scoreMate?: number; // Mate in N moves (if applicable)
  pv: string[]; // Principal variation (best line)
}
```

### Request/Response Cycle

```typescript
// User clicks "Hint"
await position.getEngineBestMove(15, 1000);

// → ChessEngine sends:
//   position fen rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
//   go depth 15 movetime 1000

// → Engine analyzes for 1 second or depth 15
// → Stockfish returns: bestmove e2e4 ponder d7d5

// → Engine extracts: "e2e4"
// → Returns to caller
```

### Web Worker Pattern

Why Web Worker?

- Stockfish WASM is CPU-intensive (can take 10+ seconds)
- Main thread must stay responsive for UI interactions
- Worker runs on separate thread, doesn't block board

Architecture:

```
main.ts (Main Thread)
    ↓ postMessage("position fen ... \n go depth 15")
js/engine.ts (Communicator)
    ↓ passes through
Web Worker (Background Thread)
    ↓ runs
Stockfish WASM (Binary Engine)
    ↓ analyzes
Web Worker (Returns result)
    ↓ postMessage("bestmove e2e4")
js/engine.ts (Parses)
    ↓ resolves promise
main.ts (Updates UI)
```

---

## API Reference

### ChessPosition API

#### Constructor

```typescript
new ChessPosition(fen?: string, engine?: ChessEngine)
```

#### Properties

```typescript
board: Piece[][];           // Board state [row][col]
color: 'w' | 'b';          // White or black to move
castlingAvailability: string;  // "KQkq" format
enPassantSquare: string | null;  // e.g., "e3"
halfMoveClock: number;      // Moves since last pawn/capture
fullMoveNumber: number;     // Current move number
```

#### Methods

**Game Logic**:

```typescript
// Make a move
move(moveStr: string): Piece | null

// Get all legal moves in uci notation
getAvailableMoves(): string[]

// Export to FEN
toFen(): string

// Set engine for this position
setEngine(engine: ChessEngine): void
```

**Engine Analysis**:

```typescript
// Get best move (async)
async getEngineBestMove(depth?: number, timeMs?: number): Promise<string>
// Example: await position.getEngineBestMove(15, 1000) → "e2e4"

// Get position evaluation (async)
async getEngineEvaluation(depth?: number): Promise<number>
// Example: await position.getEngineEvaluation(20) → 45 (centipawns)

// Get detailed analysis (async)
async getEngineAnalysis(depth?: number): Promise<EngineInfo[]>
// Returns array of analysis at each depth
```

### ChessEngine API

#### Constructor & Initialization

```typescript
const engine = new ChessEngine();
await engine.initialize(workerPath?: string);
```

#### Analysis Methods

```typescript
// Get best move with depth and/or time limit
async getBestMove(
  fen: string,
  depth?: number,
  timeMs?: number
): Promise<string>

// Get position score in centipawns
async evaluatePosition(
  fen: string,
  depth?: number
): Promise<number>

// Get full analysis at each depth
async evaluatePositionDetailed(
  fen: string,
  depth?: number
): Promise<EngineInfo[]>
```

#### Configuration

```typescript
// Set number of threads (default: all cores)
setThreads(count: number): void

// Set hash table size in MB (default: 128)
setHashSize(sizeInMb: number): void

// Clear analysis cache
clearHash(): void

// Send raw UCI command
private send(command: string): void

// Register response handler
private onResponse(
  type: 'bestmove' | 'info',
  handler: (response: string) => void
): void
```

#### Lifecycle

```typescript
// Cleanup and terminate worker
terminate(): void
```

### Engine Manager API

```typescript
// Get or initialize engine
async getEngine(path?: string): Promise<ChessEngine>

// Get engine if ready (no initialization)
function getEngineIfReady(): ChessEngine | null

// Close engine and cleanup
function closeEngine(): void

// Check if engine is loaded
function isEngineReady(): boolean

// Check if engine is currently analyzing
function isEngineSearching(): boolean
```

---

## Build & Deployment

### Development Setup

```bash
npm install
npm run dev
```

Server runs on http://localhost:5173 with:

- Hot Module Replacement (HMR)
- CORS headers for multi-threading
- Engine auto-detection

### Production Build

```bash
npm run build
```

Process:

1. Vite transpiles TypeScript to JavaScript
2. Minifies CSS
3. Creates optimized bundle in `dist/`

**Output**:

```
dist/
├── index.html                    (~9 KB)
├── stockfish/                    (~7 MB)
├── assets/
│   ├── index-[hash].css         (~3 KB)
│   └── index-[hash].js          (~18 KB)
```

**Total size**: ~7.5 MB (mostly engine WASM)

### Deployment Requirements

#### CORS Headers

Multi-threading requires specific CORS headers on production:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**Nginx Example**:

```nginx
location / {
  add_header "Cross-Origin-Opener-Policy" "same-origin";
  add_header "Cross-Origin-Embedder-Policy" "require-corp";
  proxy_pass http://backend;
}
```

**Apache Example**:

```apache
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"
```

**Node.js Example**:

```javascript
app.use((req, res, next) => {
  res.header("Cross-Origin-Opener-Policy", "same-origin");
  res.header("Cross-Origin-Embedder-Policy", "require-corp");
  next();
});
```

#### Vite Configuration

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  optimizeDeps: {
    exclude: ["stockfish"],
  },
});
```

---

## Development Guide

### Adding a New Feature

Example: Add a "Move Suggest" button that shows top 3 moves

1. **Add UI element** (`index.html`):

```html
<button type="button" id="suggest-moves">Suggest Moves</button>
```

2. **Add handler** (`js/main.ts`):

```typescript
async function suggestMoves(): Promise<void> {
  const analysis = await chess.getEngineAnalysis(18);
  const topMoves = analysis.slice(0, 3);

  topMoves.forEach((info, i) => {
    const move = info.pv[0];
    const score = (info.score / 100).toFixed(2);
    console.log(`${i + 1}. ${move}: ${score}`);
  });
}

// Attach handler
document
  .getElementById("suggest-moves")
  ?.addEventListener("click", suggestMoves);
```

3. **Add styling** (`css/style.css`):

```css
#suggest-moves {
  /* styling */
}
```

### Code Style

- **TypeScript**: Prefer strict types, avoid `any`
- **Naming**: `camelCase` for functions/variables, `PascalCase` for classes
- **Async**: Use `async/await`, not `.then()`
- **Errors**: Use try/catch blocks, provide user-friendly messages
- **Comments**: Explain "why", not "what" (code explains itself)

### Testing

Run tests from browser console:

```javascript
await testEngine();
```

Tests cover:

- Engine initialization
- Best move analysis
- Position evaluation
- ChessPosition integration
- FEN export/import
- Configuration options

### TypeScript Configuration

Current setup (`tsconfig.json`):

- Target: ES2020
- Module: ESNext
- Strict mode enabled
- Source maps for debugging

### Linting & Formatting

```bash
npm run biome:check    # Check code
npm run biome:write    # Auto-format
npm run biome:ci       # CI check
```

---

## Performance

### Engine Load Time

```
First Load: 500-1000ms (engine WASM downloads and initializes)
Subsequent: 0ms (cached)
```

### Analysis Speed

| Depth | Time     | Use Case           |
| ----- | -------- | ------------------ |
| 10    | 0.2-0.5s | Instant feedback   |
| 12    | 0.5-2s   | Quick hints        |
| 15    | 1-3s     | Default hint       |
| 18    | 3-8s     | Deep analysis      |
| 20+   | 10-30s   | Very deep analysis |

**Factors affecting speed**:

- CPU cores (more = faster)
- Hash size (more memory can improve speed)
- Position complexity

### Memory Usage

```
Engine instance:     ~50-100 MB (WASM + overhead)
Hash table:          ~128 MB (default, configurable)
Board state:         <1 MB
Total typical:       ~200 MB
```

**Mobile optimization**:

- Use lite engine (already configured)
- Reduce hash: `engine.setHashSize(64)`
- Reduce threads: `engine.setThreads(2)`

### Threading

```
Default: Uses all CPU cores
Scaling: ~40-60% faster per additional thread
Example on 8-core CPU: 7-8x faster than single-threaded
```

### Optimization Tips

1. **Shallow analysis for quick feedback**: Use depth 10-12
2. **Deep analysis for puzzles**: Use depth 20-25
3. **Cache positions**: Run same position multiple times without reload
4. **Batch analysis**: Analyze multiple positions in parallel
5. **Reduce memory**: Lower hash size on memory-constrained devices

---

## Known Limitations

### Completed Features ✓

1. **Castling (kingside & queenside)**

   - Full legal move generation with validation
   - Checks: king not in check, doesn't pass through check, doesn't end in check
   - Rook movement handled automatically
   - Castling rights update on king/rook movement

2. **En Passant**

   - Full legal move generation
   - Automatic opponent pawn capture
   - Correct halfMoveClock handling

3. **Move State Management**
   - FEN-compatible halfMoveClock updates
   - fullMoveNumber incrementing
   - Castling availability tracking
   - En passant square updates

### Engine Limitations

1. **No opening book** (yet)

   - Could be added as future enhancement
   - Stockfish includes basic opening knowledge

2. **No endgame tablebases**

   - Would require additional ~1 GB download
   - Lite engine handles most endgames well

3. **No multi-PV analysis**
   - Can't directly get top 5 moves
   - Can infer from analysis output

### Implementation Limitations

1. **Auto-detection depends on directory listing**

   - Works in dev and most servers
   - Can fail if server disables directory listing
   - Workaround: Provide manual path to `getEngine('/path/to/engine')`

2. **CORS requirements**

   - Multi-threading requires specific headers
   - Single-threaded fallback not implemented
   - Production deployment must configure headers

3. **Memory on constrained devices**

   - Hash size (128 MB default) may be too large
   - Mobile phones may have <512 MB available
   - Solution: `engine.setHashSize(32)` or less

4. **Worker support required**
   - Won't work on very old browsers
   - All modern browsers support Web Workers

### Potential Future Improvements

- [ ] Pawn promotion move generation (UI selection)
- [ ] Move legality checking (king left in check)
- [ ] Stalemate & threefold repetition detection
- [ ] Opening book integration
- [ ] Engine strength handicap levels
- [ ] PGN import with annotations
- [ ] Move tree visualization
- [ ] Evaluation graph during game
- [ ] Engine vs Engine matches
- [ ] Cloud-based deep analysis
- [ ] Endgame tablebase support
- [ ] Disable buttons while analyzing
- [ ] Save analysis to game

---

## Testing

### Unit Tests

Located in `js/engine-test.ts` and `js/test.ts`

Run from browser console:

```javascript
await testEngine();
```

### Manual Testing Checklist

- [ ] Page loads without errors
- [ ] Engine status shows "Initializing..." then "Ready"
- [ ] Hint button highlights a valid move
- [ ] Analyze button updates status with evaluation
- [ ] Can play moves with mouse clicks
- [ ] Flip board works correctly
- [ ] FEN import/export works
- [ ] Engine unloads cleanly on page unload

### Browser Testing

- Chrome/Edge 90+
- Firefox 88+
- Safari 15+

### Performance Testing

```bash
npm run build
npm run preview
# Open in DevTools Network tab to check:
# - Engine file download time
# - Engine file size
# - Analysis timing
```

---

## Troubleshooting

### Engine not initializing

**Symptoms**: Console shows "Engine unavailable"

**Solutions**:

1. Check browser console (F12) for errors
2. Verify CORS headers in dev server config
3. Check Network tab for failed requests
4. Ensure `stockfish-*.wasm` loads successfully

### Slow analysis

**Symptoms**: Hint/Analyze buttons take too long

**Solutions**:

1. Reduce depth (use 12-15 instead of 20)
2. Reduce time limit
3. Close other CPU-intensive programs
4. Check CPU usage (Activity Monitor / Task Manager)
5. Reduce thread count: `engine.setThreads(2)`

### Out of memory errors

**Symptoms**: Browser crashes or becomes unresponsive

**Solutions**:

1. Reduce hash size: `engine.setHashSize(32)`
2. Close other browser tabs
3. Restart browser
4. Use desktop instead of mobile

### Move highlighting not visible

**Symptoms**: Hint button doesn't show move highlight

**Solutions**:

1. Check CSS is loaded (Network tab)
2. Verify element IDs match in HTML and CSS
3. Check z-index conflicts with other elements
4. Inspect hint elements in DevTools

---

## References

### Official Documentation

- [Stockfish GitHub](https://github.com/official-stockfish/Stockfish)
- [Stockfish.js](https://github.com/nmrugg/stockfish.js)
- [UCI Protocol](https://www.wbec-ridderkerk.nl/html/UCIProtocol.html)
- [MDN Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
- [FEN Notation](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation)

### Chess Resources

- [Chess.com Learn](https://www.chess.com/learn)
- [Lichess Guides](https://lichess.org/learn)
- [Chess Rules](https://www.fide.com/handbook)

### TypeScript & Web

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [MDN JavaScript Reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference)
- [Vite Documentation](https://vitejs.dev/)

---

## Contributing

### Getting Started

1. Fork the repository
2. Clone locally: `git clone [url]`
3. Install: `npm install`
4. Run dev: `npm run dev`
5. Read this file to understand architecture
6. Make changes
7. Test: `npm run biome:check` and `await testEngine()`
8. Submit PR

### Code Review Checklist

- [ ] Follows TypeScript best practices
- [ ] No `any` types
- [ ] Functions are well-documented
- [ ] Error handling is in place
- [ ] Code is formatted (`biome:write`)
- [ ] Tests pass
- [ ] No console errors
- [ ] Works in multiple browsers

---

## Summary

NordicChess is a well-architected chess application with:

- **Clean layered architecture**: UI → Game logic → Engine abstraction → WASM
- **Type-safe**: Full TypeScript with strict mode
- **Non-blocking**: Web Worker keeps UI responsive
- **Extensible**: Easy to add features
- **Well-tested**: Comprehensive test suite
- **Production-ready**: Deployed with proper CORS configuration

For questions or issues, check the troubleshooting section or review the relevant code files.
