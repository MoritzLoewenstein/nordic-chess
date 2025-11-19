# NordicChess

A web-based chess application with integrated Stockfish engine for analysis and move suggestions.

## What is NordicChess?

NordicChess is a chess application that lets you:

- Play chess with a clean, intuitive interface
- Get move suggestions from the Stockfish engine
- Analyze positions with real-time evaluations
- Import/export game positions using FEN notation
- Flip the board for either player's perspective

## Quick Start

1. **Open the app**: Open [chess.monilo.org](https://chess.monilo.org)
2. **Engine loads automatically** in the background
3. **Start playing**:
   - Click squares to select and move pieces
   - Click **Hint** to see the engine's best move
   - Click **Analyze** for deeper position analysis

## Installation (for developers)

```bash
npm install
npm run dev      # Development server
npm run build    # Production build
```

## Features

- Full chess game with all pieces and special moves (castling, en passant)
- Import/export positions using FEN notation
- Hint button: Best move suggestion (1 second analysis)
- Analyze button: Deep position analysis (Depth: 20)

### Missing Features

- Promotion (Pawns reaching 8th rank)

## How to Use

**Make moves**: Click a piece, then click where you want it to go.

**Get hints**: Click the Hint button to see the best move (highlighted in blue→green).

**Analyze**: Click Analyze to get deeper inspection with evaluation scores.

**Status display**:

- "Initializing..." = Engine loading
- "Ready" = Engine ready for analysis
- "Analyzing..." = Analysis in progress
- "Eval: +0.45" = Position evaluation (white advantage)

## Game Rules

**Piece moves**:

- Pawns: Move forward 1 square (2 from starting position), capture diagonally
- Knights: Move in L-shape (2+1 squares)
- Bishops: Move diagonally any distance
- Rooks: Move horizontally/vertically any distance
- Queens: Combine rook + bishop movement
- Kings: Move 1 square in any direction

**Special moves**:

- Castling: King and rook swap positions under certain conditions
- En Passant: Pawn captures another pawn en passant after 2-square advance
- Promotion: Pawn reaching the 8th rank becomes a queen/rook/bishop/knight (not implemented yet)

## Performance

| Task               | Time   |
| ------------------ | ------ |
| Page load          | <1s    |
| Hint (depth 15)    | 1-3s   |
| Analyze (depth 20) | 10-30s |
| Memory             | ~200MB |

## Documentation

- **docs/ARCHITECTURE.md**: Complete technical documentation

## License

- NordicChess: MIT
- Stockfish: GPLv3

## Links

- GitHub: https://github.com/MoritzLoewenstein/nordic-chess
- Stockfish: https://github.com/official-stockfish/Stockfish
- Stockfish.js: https://github.com/nmrugg/stockfish.js

---

Ready to play? Load the app and click "Hint" or "Analyze" to see the engine in action!
