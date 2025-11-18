# Stockfish Integration Implementation Plan

## Overview
This plan integrates the Stockfish lite multi-threaded chess engine into the NordicChess project with minimal chess-specific code changes. The engine will run in a Web Worker to avoid blocking the UI.

## Architecture Principles
- **Separation of Concerns**: Engine logic stays in a dedicated worker, UI stays in main thread
- **Minimal Chess Code**: Keep chess-specific logic isolated; delegate engine work to Stockfish
- **Standard Protocols**: Use UCI (Universal Chess Interface) protocol for engine communication
- **FEN Format**: Use existing FEN support for position representation

---

## Phase 1: Setup & Configuration

### 1.1 Install Dependencies
```bash
npm install stockfish
```

This adds the stockfish npm package (version 17.1.0) which includes:
- Lite multi-threaded WASM engine (~7MB)
- UCI protocol support
- Web Worker compatible files

### 1.2 Update Package Scripts
Add a public asset copy script to `package.json`:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build && npm run copy:stockfish",
    "copy:stockfish": "cp -r node_modules/stockfish/dist/lite .vite/tmp/public/stockfish",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "biome:check": "biome check .",
    "biome:write": "biome check --write .",
    "biome:ci": "biome ci ."
  }
}
```

**Note**: The actual copy mechanism depends on your build process. For Vite, consider:
- Using `vite-plugin-assets` or similar
- Or manually copying `node_modules/stockfish/dist/lite/*` to `public/stockfish/`

### 1.3 Configure Vite for WASM
Update `vite.config.ts`:
```typescript
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    }
  },
  optimizeDeps: {
    exclude: ['stockfish']
  }
})
```

These CORS headers are required for the multi-threaded WASM engine.

---

## Phase 2: Create Engine Abstraction Layer

### 2.1 Create `js/engine.ts` - Engine Manager
This module handles all Stockfish communication and abstracts UCI protocol details.

```typescript
// js/engine.ts
export class ChessEngine {
  private worker: Worker | null = null;
  private responseHandlers: Map<string, (response: string) => void> = new Map();
  private moveQueue: string[] = [];
  private ready: boolean = false;

  async initialize(workerPath: string = '/stockfish/stockfish-nnue-17.1-lite.js'): Promise<void> {
    return new Promise((resolve) => {
      this.worker = new Worker(workerPath, { type: 'module' });
      
      this.worker.onmessage = (event: MessageEvent) => {
        const message = event.data as string;
        
        if (message === 'uciok') {
          this.ready = true;
          resolve();
        }
        
        // Call any registered handlers for specific responses
        if (message.startsWith('bestmove')) {
          const handler = this.responseHandlers.get('bestmove');
          if (handler) handler(message);
        } else if (message.startsWith('info')) {
          const handler = this.responseHandlers.get('info');
          if (handler) handler(message);
        }
      };

      this.worker.onerror = (error: ErrorEvent) => {
        console.error('Engine worker error:', error);
      };

      this.send('uci');
    });
  }

  private send(command: string): void {
    if (!this.worker) throw new Error('Engine not initialized');
    this.worker.postMessage(command);
  }

  /**
   * Set a handler for specific response types
   */
  onResponse(type: 'bestmove' | 'info', handler: (response: string) => void): void {
    this.responseHandlers.set(type, handler);
  }

  /**
   * Get best move for a position
   * @param fen - Position in FEN notation
   * @param depth - Search depth (higher = stronger but slower)
   * @param timeMs - Time limit in milliseconds
   */
  async getBestMove(fen: string, depth?: number, timeMs?: number): Promise<string> {
    return new Promise((resolve) => {
      const handler = (response: string) => {
        // Extract move from "bestmove e2e4 ponder ..." format
        const match = response.match(/bestmove\s+(\S+)/);
        const move = match ? match[1] : '';
        this.responseHandlers.delete('bestmove');
        resolve(move);
      };

      this.onResponse('bestmove', handler);

      this.send(`position fen ${fen}`);
      
      let goCommand = 'go';
      if (depth) goCommand += ` depth ${depth}`;
      if (timeMs) goCommand += ` movetime ${timeMs}`;
      
      this.send(goCommand);
    });
  }

  /**
   * Evaluate a position
   */
  async evaluatePosition(fen: string, depth: number = 15): Promise<number> {
    return new Promise((resolve) => {
      let score = 0;

      const handler = (response: string) => {
        // Parse score from "info ... score cp 50 ..." or "... score mate 3 ..."
        const cpMatch = response.match(/score\s+cp\s+(-?\d+)/);
        const mateMatch = response.match(/score\s+mate\s+(-?\d+)/);
        
        if (cpMatch) {
          score = parseInt(cpMatch[1], 10);
        } else if (mateMatch) {
          // Mate score (represent as very high/low value)
          const mateIn = parseInt(mateMatch[1], 10);
          score = mateIn > 0 ? 100000 - mateIn : -100000 - mateIn;
        }
      };

      this.onResponse('info', handler);
      this.onResponse('bestmove', () => {
        this.responseHandlers.delete('info');
        resolve(score);
      });

      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /**
   * Check if a move is legal
   */
  isMoveLegal(fen: string, move: string): boolean {
    // Stockfish only returns legal moves, so this is a simplification
    // In practice, you'd need to parse legal moves from UCI output
    // For now, rely on move validation elsewhere
    return true;
  }

  /**
   * Get all legal moves for a position
   */
  async getLegalMoves(fen: string): Promise<string[]> {
    // Stockfish doesn't directly return legal moves
    // This would require parsing from "go" with a depth and collecting info output
    // For now, delegate to your existing move generation
    return [];
  }

  setThreads(count: number): void {
    this.send(`setoption name Threads value ${count}`);
  }

  setHashSize(sizeInMb: number): void {
    this.send(`setoption name Hash value ${sizeInMb}`);
  }

  terminate(): void {
    if (this.worker) {
      this.send('quit');
      this.worker.terminate();
      this.worker = null;
    }
  }
}
```

### 2.2 Create `js/engineManager.ts` - Singleton Manager
This provides a global, lazily-initialized engine instance.

```typescript
// js/engineManager.ts
import { ChessEngine } from './engine.js';

let engineInstance: ChessEngine | null = null;

export async function getEngine(): Promise<ChessEngine> {
  if (!engineInstance) {
    engineInstance = new ChessEngine();
    await engineInstance.initialize();
  }
  return engineInstance;
}

export function closeEngine(): void {
  if (engineInstance) {
    engineInstance.terminate();
    engineInstance = null;
  }
}
```

---

## Phase 3: Integration with Existing Chess Code

### 3.1 Extend `ChessPosition` Class
Update `js/chessgame.ts` to use the engine:

```typescript
// In chessgame.ts, add to ChessPosition class:

export class ChessPosition {
  // ... existing properties ...
  private engine: ChessEngine | null = null;

  constructor(fen?: string, engine?: ChessEngine) {
    // ... existing initialization ...
    this.engine = engine || null;
  }

  /**
   * Get engine evaluation of current position
   * Returns a score in centipawns (positive = white advantage)
   */
  async getEngineEvaluation(depth: number = 15): Promise<number> {
    if (!this.engine) return 0;
    const fen = this.toFen();
    return this.engine.evaluatePosition(fen, depth);
  }

  /**
   * Get best move from engine
   */
  async getEngineBestMove(depth?: number, timeMs?: number): Promise<string> {
    if (!this.engine) return '';
    const fen = this.toFen();
    return this.engine.getBestMove(fen, depth, timeMs);
  }

  /**
   * Generate FEN from current position
   * (add this method if not already present)
   */
  toFen(): string {
    // Use existing export logic from parser.ts
    return exportFen(
      this.board,
      this.color,
      this.castlingAvailability,
      this.enPassantSquare,
      this.halfMoveClock,
      this.fullMoveNumber
    );
  }
}
```

### 3.2 Add Move Validation via Engine
Update `js/validator.ts` or create engine-based validation:

```typescript
// Optional: enhance existing move validation
export async function validateMoveWithEngine(
  fen: string,
  move: string,
  engine: ChessEngine
): Promise<boolean> {
  // Get legal moves from engine output
  // This is advanced; for now, rely on local move generation
  return true;
}
```

---

## Phase 4: UI Integration

### 4.1 Update `js/main.ts` - Add Engine Support
```typescript
// Add imports
import { getEngine, closeEngine } from './engineManager.js';

let chess: ChessPosition;
let engine: ChessEngine;

window.addEventListener('load', async () => {
  // Initialize engine
  try {
    engine = await getEngine();
    console.log('Engine initialized');
  } catch (error) {
    console.error('Failed to initialize engine:', error);
  }

  loadFen(true);
  // ... rest of existing code ...

  // Add engine analysis button (optional)
  const analyzeBtn = document.getElementById('analyze') as HTMLElement;
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', analyzePosition);
  }
});

async function analyzePosition(): Promise<void> {
  if (!engine) return;
  
  // Show loading state
  const statusEl = document.getElementById('status') as HTMLElement;
  statusEl.innerText = 'Analyzing...';
  
  try {
    const bestMove = await chess.getEngineBestMove(18, 3000); // 3 seconds, depth 18
    const evaluation = await chess.getEngineEvaluation(18);
    
    statusEl.innerText = `Best: ${bestMove} | Eval: ${(evaluation / 100).toFixed(2)}`;
  } catch (error) {
    statusEl.innerText = 'Analysis failed';
  }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  closeEngine();
});
```

### 4.2 Update `index.html`
Add elements for engine info:

```html
<!-- Add to controls section -->
<div id="engine-info">
  <p id="status">Ready</p>
  <button type="button" id="analyze">Analyze</button>
</div>
```

---

## Phase 5: Optional Enhancements

### 5.1 Real-time Position Analysis
Show evaluation as you play:

```typescript
// In main.ts, after each move:
async function playMove(index: number): void {
  // ... existing move logic ...
  
  // Analyze new position
  if (engine) {
    const eval = await chess.getEngineEvaluation(12);
    updateEvaluationBar(eval);
  }
}

function updateEvaluationBar(evaluation: number): void {
  const bar = document.getElementById('eval-bar') as HTMLElement;
  const percentage = Math.min(Math.max(evaluation / 200 + 50, 0), 100);
  bar.style.width = `${percentage}%`;
}
```

### 5.2 Chess Hints
Suggest best moves:

```typescript
// Add hint button
const hintBtn = document.getElementById('hint') as HTMLElement;
hintBtn.addEventListener('click', async () => {
  const move = await chess.getEngineBestMove(15, 1000); // 1 second analysis
  showMoveHint(move);
});
```

### 5.3 Engine Configuration UI
```html
<div id="engine-settings">
  <label>
    Threads:
    <input type="number" id="thread-count" value="4" min="1" max="8" />
  </label>
  <label>
    Hash Memory (MB):
    <input type="number" id="hash-size" value="128" min="16" max="512" />
  </label>
</div>

<script>
const threadInput = document.getElementById('thread-count') as HTMLInputElement;
threadInput.addEventListener('change', async () => {
  const engine = await getEngine();
  engine.setThreads(parseInt(threadInput.value, 10));
});

const hashInput = document.getElementById('hash-size') as HTMLInputElement;
hashInput.addEventListener('change', async () => {
  const engine = await getEngine();
  engine.setHashSize(parseInt(hashInput.value, 10));
});
</script>
```

---

## Phase 6: Error Handling & Optimization

### 6.1 Worker Error Handling
Update `js/engine.ts` error handling:

```typescript
this.worker.onerror = (error: ErrorEvent) => {
  console.error('Engine worker error:', error.message);
  // Fallback: disable engine features
  this.ready = false;
  // Emit event for UI to catch
  window.dispatchEvent(new CustomEvent('engineError', { detail: error }));
};
```

### 6.2 Memory Management
- Set appropriate hash size (default 128MB, lite engine is lighter)
- Limit thread count to available CPU cores
- Terminate worker on page unload

### 6.3 Timeout Handling
Add safeguards in `getBestMove`:

```typescript
async getBestMove(fen: string, depth?: number, timeMs: number = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      this.responseHandlers.delete('bestmove');
      reject(new Error('Engine timeout'));
    }, timeMs + 500);

    const handler = (response: string) => {
      clearTimeout(timeout);
      // ... existing logic ...
    };
    // ...
  });
}
```

---

## Implementation Checklist

- [ ] Install `npm install stockfish`
- [ ] Update `package.json` with asset copy script
- [ ] Configure `vite.config.ts` with CORS headers
- [ ] Create `js/engine.ts` (ChessEngine class)
- [ ] Create `js/engineManager.ts` (singleton)
- [ ] Update `js/chessgame.ts` with engine methods
- [ ] Update `js/main.ts` for initialization & UI
- [ ] Update `index.html` with engine info elements
- [ ] Add error handling and timeouts
- [ ] Test engine initialization
- [ ] Test move analysis
- [ ] Test multi-threading with `setThreads()`
- [ ] Add loading states in UI
- [ ] Performance optimization (memory, depth limits)
- [ ] Update TypeScript config if needed
- [ ] Add engine documentation

---

## File Structure After Implementation
```
js/
├── main.ts              (updated)
├── chessgame.ts         (updated)
├── constants.ts         (unchanged)
├── funcs.ts             (unchanged)
├── parser.ts            (unchanged)
├── validator.ts         (unchanged)
├── test.ts              (unchanged)
├── engine.ts            (new)
└── engineManager.ts     (new)

public/
└── stockfish/           (auto-copied from node_modules)
    ├── stockfish-nnue-17.1-lite-*.js
    └── stockfish-nnue-17.1-lite-*.wasm

index.html              (updated)
vite.config.ts          (updated)
package.json            (updated)
tsconfig.json           (may need tsconfig updates)
```

---

## Performance Expectations

| Engine Feature | Time | Notes |
|---|---|---|
| Initialization | 500-1000ms | One-time cost |
| Depth 12 analysis | 0.5-2s | Mobile-friendly |
| Depth 18 analysis | 2-5s | Reasonable for hints |
| Depth 25+ analysis | 10s+ | Use for game AI |

The lite engine is ~1000 ELO weaker than the full engine but uses 10x less memory, making it ideal for web browsers.

---

## UCI Protocol Quick Reference

Key commands used in this implementation:

```
uci                          → Initialize engine
position fen [FEN]           → Set board position
go depth [n]                 → Analyze for depth n
go movetime [ms]             → Analyze for time ms
setoption name Threads value n  → Set threads
quit                         → Shutdown
```

Response formats:
- `bestmove e2e4 ponder ...` → Best move found
- `info depth 18 score cp 50` → Analysis info
- `uciok`                    → Engine ready

---

## Potential Future Enhancements

1. **Move ordering visualization**: Show top 3-5 engine suggestions
2. **PGN import with analysis**: Load and analyze full games
3. **Opening book integration**: Add opening preparation
4. **Endgame tablebase support**: Perfect play in endgames
5. **Engine strength levels**: Limit engine strength for handicapping
6. **Game export with analysis**: Include engine evaluations in PGN
7. **Cloud engine option**: Switch between local and cloud analysis

---

## Testing Strategy

```typescript
// js/test.ts additions

async function testEngine(): Promise<void> {
  const engine = await getEngine();
  
  // Test 1: Engine initialization
  console.assert(engine !== null, 'Engine initialized');
  
  // Test 2: Best move analysis
  const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  const move = await engine.getBestMove(startFen, 10, 1000);
  console.assert(/^[a-h][1-8][a-h][1-8]$/.test(move), 'Valid move format', move);
  
  // Test 3: Position evaluation
  const eval = await engine.evaluatePosition(startFen, 12);
  console.assert(Math.abs(eval) < 100, 'Starting position near equal', eval);
}
```

