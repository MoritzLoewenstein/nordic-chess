import { importFen, Castling2Fen, EnPassant2Fen } from "./parser.js";
import { isValidSquareString, isValidPieceString } from "./validator.js";
import {
  FileRank2Square,
  Square2FileRank,
  SquareStr2Square,
  oppositeColor,
} from "./funcs.js";
import {
  FILES,
  RANKS,
  PIECES_CHAR,
  PIECES,
  SQUARES,
  COLORS,
  KnightDirections,
  RookDirections,
  BishopDirections,
  KingDirections,
  PieceDirections,
  PieceColor,
  PieceKnight,
  PieceRookQueen,
  PieceBishopQueen,
  PieceKing,
  PiecePawn,
} from "./constants.js";

class ChessPosition {
  constructor(fen) {
    if (!fen) fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const props = importFen(fen);
    this.error = typeof props === "string" ? props : false;
    this.board = props.board;
    this.color = props.color;
    this.castlingAvailability = props.castlingAvailability;
    this.enPassantSquare = props.enPassantSquare;
    this.halfMoveClock = props.halfMoveClock;
    this.fullMoveNumber = props.fullMoveNumber;
    // sum of piece value for each player
    this.piecesValue = new Array(2).fill(0);
    // count of each piece
    this.piecesCount = new Array(13).fill(0);
    // list of each piece
    this.pieceList = new Array(14 * 10);
  }

  getField(field) {
    return "";
  }

  move(move) {
    // empty src
    if (this.board[move[0]] === PIECES.EMPTY)
      throw Error(`No piece on Square ${move[0]}`);

    // todo check for move type / special moves
    const piece = this.board[move[0]];
    this.board[move[0]] = PIECES.EMPTY;
    this.board[move[1]] = piece;

    // switch side to play
    this.color = oppositeColor(this.color);
  }

  isGameOver() {
    return this.isCheckmate() || this.isRemis();
  }

  isCheckmate(color) {
    if (color === COLORS.BOTH) throw Error("Color must be black or white");
    // todo get king square of color
    const kingSquare = 0;
    if (!this.isSquareAttacked(kingSquare, oppositeColor(color))) {
      return false;
    }
    // todo get all possible moves for every piece of color
    // todo implement special moves (e.p., castling, promotion)
    // one move is array of length 2 with srcSquare & destSquare
    const allMoves = [];
    return allMoves.some((move) => {
      // make move
      let sq = this.board[move[1]];
      this.board[move[1]] = this.board[move[0]];
      this.board[move[0]] = PIECES.EMPTY;
      // is king still attacked?
      const kingAttacked = this.isSquareAttacked(
        kingSquare,
        oppositeColor(color)
      );
      // undo move
      this.board[move[0]] = this.board[move[1]];
      this.board[move[1]] = sq;
      return !kingAttacked;
    });
  }

  isRemis() {
    // check remis
    return false;
  }

  generatePositionTree(depth) {}

  evaluate() {}

  //* square and attacking color
  isSquareAttacked(sq, color) {
    if (color === COLORS.BOTH) throw Error("Color must be black or white");

    //* pawn
    if (color === COLORS.WHITE) {
      if (
        this.board[sq - 11] === PIECES.whitePawn ||
        this.board[sq - 9] === PIECES.whitePawn
      )
        return true;
    } else {
      if (
        this.board[sq + 11] === PIECES.blackPawn ||
        this.board[sq + 9] === PIECES.blackPawn
      )
        return true;
    }

    //* knight
    for (let i = 0; i < 8; i++) {
      let piece = this.board[sq + KnightDirections[i]];
      if (
        piece !== SQUARES.OFFBOARD &&
        PieceColor[piece] === color &&
        PieceKnight[piece]
      )
        return true;
    }

    //* rook & queen
    for (let i = 0; i < 4; i++) {
      let dir = RookDirections[i];
      let t_sq = sq + dir;
      let piece = this.board[t_sq];
      while (piece !== SQUARES.OFFBOARD) {
        if (piece !== PIECES.EMPTY) {
          if (PieceRookQueen[piece] && PieceColor[piece] === color) return true;
          break;
        }
        t_sq += dir;
        piece = this.board[t_sq];
      }
    }

    //* bishop & queen
    for (let i = 0; i < 4; i++) {
      let dir = BishopDirections[i];
      let t_sq = sq + dir;
      let piece = this.board[t_sq];
      while (piece !== SQUARES.OFFBOARD) {
        if (piece !== PIECES.EMPTY) {
          if (PieceColor[piece] === color && PieceBishopQueen[piece])
            return true;
          break;
        }
        t_sq += dir;
        piece = this.board[t_sq];
      }
    }

    //* king
    for (let i = 0; i < 8; i++) {
      let piece = this.board[sq + KingDirections[i]];
      if (
        piece !== SQUARES.OFFBOARD &&
        PieceColor[piece] === color &&
        PieceKing[piece]
      )
        return true;
    }

    return false;
  }

  // movegen for 1 specific square
  getPossibleSquares(sq) {
    const piece = this.board[sq];
    const colorOfPiece = PieceColor[piece];
    if (piece === SQUARES.OFFBOARD) throw Error("Square is offboard");
    if (piece === PIECES.EMPTY) throw Error("Square is empty");

    //* Pawns *//
    if (PiecePawn[piece]) {
      const directions = [10, 20, 11, 9];
      const conditions = [
        // 1 step forward
        (move) =>
          this.board[sq + move] !== SQUARES.OFFBOARD &&
          this.board[sq + move] === PIECES.EMPTY,
        // 2 steps forward
        (move) =>
          ((colorOfPiece === COLORS.WHITE &&
            Square2FileRank(sq)[1] === RANKS._2) ||
            (colorOfPiece === COLORS.BLACK &&
              Square2FileRank(sq)[1] === RANKS._7)) &&
          this.board[sq + move / 2] === PIECES.EMPTY &&
          this.board[sq + move] === PIECES.EMPTY,
        // capture forward right
        (move) =>
          this.board[sq + move] !== SQUARES.OFFBOARD &&
          this.board[sq + move] !== PIECES.EMPTY &&
          PieceColor[this.board[sq + move]] === oppositeColor(colorOfPiece),
        // capture forward left
        (move) =>
          this.board[sq + move] !== SQUARES.OFFBOARD &&
          this.board[sq + move] !== PIECES.EMPTY &&
          PieceColor[this.board[sq + move]] === oppositeColor(colorOfPiece),
      ];
      const squares = [];
      const mult = PieceColor[piece] === COLORS.WHITE ? 1 : -1;
      directions.map((dir, index) => {
        if (conditions[index](mult * dir)) {
          const move = [sq, sq + mult * dir];
          // promotion
          if (
            (PieceColor[this.board[sq]] === COLORS.WHITE &&
              Square2FileRank(sq + mult * dir)[1] === RANKS._8) ||
            (PieceColor[this.board[sq]] === COLORS.BLACK &&
              Square2FileRank(sq + mult * dir)[1] === RANKS._1)
          ) {
            //move.push();
          }
          // todo en passant
          squares.push(move);
        }
      });
      return squares;
    }

    //* Knights *//
    if (PieceKnight[piece]) {
      return KnightDirections.filter(
        (dir) =>
          this.board[sq + dir] === PIECES.EMPTY ||
          PieceColor[this.board[sq + dir]] === oppositeColor(colorOfPiece)
      ).map((dir) => [sq, sq + dir]);
    }
    return [];
  }

  printAttackedSquares() {
    console.log("\nAttacked:\n");

    for (let rank = RANKS._8; rank >= RANKS._1; rank--) {
      let line = rank + 1 + "  ";
      for (let file = FILES.A_; file <= FILES.H_; file++) {
        let sq = FileRank2Square(file, rank);
        let piece = this.isSquareAttacked(sq, this.color) ? "X" : "-";
        line += " " + piece + " ";
      }
      console.log(line);
    }
  }

  prettyPrint() {
    console.log("\nBoard:\n");
    for (let rank = RANKS._8; rank >= RANKS._1; rank--) {
      let line = `${rank + 1}  `;
      for (let file = FILES.A_; file <= FILES.H_; file++) {
        let sq = FileRank2Square(file, rank);
        let piece = this.board[sq];
        line += " " + PIECES_CHAR[piece] + " ";
      }
      console.log(line);
    }
    console.log("\n    a  b  c  d  e  f  g  h\n");
    console.log(
      `${this.color === COLORS.WHITE ? "White" : "Black"} moves next\n`
    );
    console.log(`Castling: ${Castling2Fen(this.castlingAvailability)}\n`);
    console.log(`En Passant Square: ${EnPassant2Fen(this.enPassantSquare)} \n`);
    console.log(`halfMoveClock: ${this.halfMoveClock}\n`);
    console.log(`fullMoveNumber: ${this.fullMoveNumber}\n`);
  }
}

// minimax algorithm with alpha-beta pruning
// initial call: minimax(position, n, -Infinity, +Infinity, true)
function minimax(position, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || position.isGameOver()) return position.evaluate();

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    // loop through children
    for (let pos of position.children) {
      const ev = minimax(pos, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) {
        break;
      }
    }
    return maxEval;
  } else {
    let minEval = +Infinity;
    for (let pos of position.children) {
      const ev = minimax(pos, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) {
        break;
      }
    }
    return minEval;
  }
}

export { ChessPosition };
