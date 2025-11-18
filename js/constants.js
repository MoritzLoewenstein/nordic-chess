//* General *//

//chess variants with default board and figures
export const VARIANTS = {
  UNKNOWN: 0,
  DEFAULT: 1,
  CHESS960: 2,
};

// FEN String of starting postition
export const FEN_START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export const PIECES_CHAR = ".PNBRQKpnbrqk";

export const FILES_CHAR = "abcdefgh";

export const RANKS_CHAR = "12345678";

// board size with border
export const BOARD_SIZE_SAFE = 120;

// board size without border
export const BOARD_SIZE = 64;

// integer representation of pieces
export const PIECES = {
  EMPTY: 0,
  whitePawn: 1,
  whiteKnight: 2,
  whiteBishop: 3,
  whiteRook: 4,
  whiteQueen: 5,
  whiteKing: 6,
  blackPawn: 7,
  blackKnight: 8,
  blackBishop: 9,
  blackRook: 10,
  blackQueen: 11,
  blackKing: 12,
};

export const FILES = {
  A_: 0,
  B_: 1,
  C_: 2,
  D_: 3,
  E_: 4,
  F_: 5,
  G_: 6,
  H_: 7,
  NONE: 8,
};

export const RANKS = {
  _1: 0,
  _2: 1,
  _3: 2,
  _4: 3,
  _5: 4,
  _6: 5,
  _7: 6,
  _8: 7,
  NONE: 8,
};

export const COLORS = { WHITE: 0, BLACK: 1, BOTH: 2 };

export const CASTLEBITS = { WKCA: 1, WQCA: 2, BKCA: 4, BQCA: 8 };

export const MOVES = {
  NORMAL: 0,
  EnPassant: 1,
  KingSideCastling: 2,
  QueenSideCastling: 3,
};

// prettier-ignore
export const SQUARES = {
  A1: 21, B1: 22, C1: 23, D1: 24, E1: 25, F1: 26, G1: 27, H1: 28,
  A8: 91, B8: 92, C8: 93, D8: 94, E8: 95, F8: 96, G8: 97, H8: 98,
  NO_SQ: 99,
  OFFBOARD: 100,
};

//* Piece properties index by PIECE *//

// prettier-ignore
export const PieceBig = [
  // empty
  false,
  // white
  false,
  true, true, true, true, true,
  // black
  false,
  true, true, true, true, true,
];

// prettier-ignore
export const PieceMaj = [
  // empty
  false,
  // white
  false, false, false,
  true, true, true,
  // black
  false, false, false,
  true, true, true,
];

// prettier-ignore
export const PieceMin = [
  // empty
  false,
  // white
  false,
  true, true,
  false, false, false,
  // black
  false,
  true, true,
  false, false, false,
];

// prettier-ignore
export const PieceVal = [
  // empty
  0,
  // white
  100, 325, 325, 550, 1000, 50000,
  // black
  100, 325, 325, 550, 1000, 50000,
];

// prettier-ignore
export const PieceColor = [
  // empty
  COLORS.BOTH,
  // white
  COLORS.WHITE, COLORS.WHITE, COLORS.WHITE, COLORS.WHITE, COLORS.WHITE, COLORS.WHITE,
  // black
  COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, COLORS.BLACK, COLORS.BLACK,
];

// prettier-ignore
export const PiecePawn = [
  // empty
  false,
  // white
  true,
  false, false, false, false, false,
  // black
  true,
  false, false, false, false, false
];

// prettier-ignore
export const PieceKnight = [
  // empty
  false,
  // white
  false,
  true,
  false, false, false, false,
  // black
  false,
  true,
  false, false, false, false,
];

// prettier-ignore
export const PieceKing = [
  // empty
  false,
  // white
  false, false, false, false, false,
  true,
  // black
  false, false, false, false, false,
  true,
];

// prettier-ignore
export const PieceRookQueen = [
  // empty
  false,
  // white
  false, false, false,
  true, true,
  false,
  // black
  false, false, false,
  true, true,
  false,
];

// prettier-ignore
export const PieceBishopQueen = [
  // empty
  false,
  // white
  false, false,
  true,
  false,
  true,
  false,
  // black
  false, false,
  true,
  false,
  true,
  false,
];

// prettier-ignore
export const PieceSlides = [
  // empty
  false,
  // white
  false, false,
  true, true, true,
  false,
  // black
  false, false,
  true, true, true,
  false,
];

// Piece Directions on 120 board
export const KnightDirections = [-8, -19, -21, -12, 8, 19, 21, 12];
export const RookDirections = [-1, -10, 1, 10];
export const BishopDirections = [-9, -11, 11, 9];
export const KingDirections = [-1, -10, 1, 10, -9, -11, 11, 9];
export const PieceDirections = [
  // empty
  [],
  // white
  [],
  KnightDirections,
  BishopDirections,
  RookDirections,
  KingDirections,
  KingDirections,
  // black
  [],
  KnightDirections,
  BishopDirections,
  RookDirections,
  KingDirections,
  KingDirections,
];

// prettier-ignore
// 120 Board for easy offboard detection
export const Sq120ToSq64 = [
  65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
  65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
  65,  0,  1,  2,  3,  4,  5,  6,  7, 65,
  65,  8,  9, 10, 11, 12, 13, 14, 15, 65,
  65, 16, 17, 18, 19, 20, 21, 22, 23, 65,
  65, 24, 25, 26, 27, 28, 29, 30, 31, 65,
  65, 32, 33, 34, 35, 36, 37, 38, 39, 65,
  65, 40, 41, 42, 43, 44, 45, 46, 47, 65,
  65, 48, 49, 50, 51, 52, 53, 54, 55, 65,
  65, 56, 57, 58, 59, 60, 61, 62, 63, 65,
  65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
  65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
];

// prettier-ignore
export const Sq64ToSq120 = [
  21, 22, 23, 24, 25, 26, 27, 28,
  31, 32, 33, 34, 35, 36, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48,
  51, 52, 53, 54, 55, 56, 57, 58,
  61, 62, 63, 64, 65, 66, 67, 68,
  71, 72, 73, 74, 75, 76, 77, 78,
  81, 82, 83, 84, 85, 86, 87, 88,
  91, 92, 93, 94, 95, 96, 97, 98,
];
