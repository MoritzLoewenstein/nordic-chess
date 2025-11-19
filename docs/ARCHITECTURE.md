# NordicChess Technical Documentation

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

Output is in dist/ and can be statically hosted.

### Deployment Requirements

#### CORS Headers

Multi-threading requires specific CORS headers on production:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
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

### Linting & Formatting

```bash
npm run biome:check    # Check code
npm run biome:write    # Auto-format
npm run biome:ci       # CI check
```

## Known Limitations

### Completed Features

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

1. **CORS requirements**

   - Multi-threading requires specific headers
   - Single-threaded fallback not implemented
   - Production deployment must configure headers

2. **Memory on constrained devices**

   - Hash size (128 MB default) may be too large
   - Mobile phones may have <512 MB available
   - Solution: `engine.setHashSize(32)` or less

3. **Worker support required**
   - Won't work on very old browsers
   - All modern browsers support Web Workers

### Potential Future Improvements

- [ ] Pawn promotion move generation (UI selection)
- [ ] Move legality checking (king left in check)
- [ ] Stalemate & threefold repetition detection
- [ ] Engine strength handicap levels
- [ ] PGN import with annotations
- [ ] Move tree visualization
- [ ] Evaluation graph during game
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
- [FEN Notation](https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation)
