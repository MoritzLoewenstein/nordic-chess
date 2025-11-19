import {
	COLORS,
	type Color,
	FILES,
	FILES_CHAR,
	PIECES,
	RANKS,
	RANKS_CHAR,
	Sq120ToSq64,
} from "./constants.ts";

//* utility functions to convert different board & piece representations *//

// 120 board index to file and rank
export function Square2FileRank(sq: number): [number, number] {
	sq = Sq120ToSq64[sq as keyof typeof Sq120ToSq64] as number;
	if (sq === 65) throw Error(`Invalid square ${sq}`);
	return [sq % 8, Math.floor(sq / 8)];
}

// file & rank to 120 board index
export function FileRank2Square(f: number, r: number): number {
	if (f === FILES.NONE || r === RANKS.NONE)
		throw Error(`Invalid file ${f} or rank ${r}`);
	return 21 + f + r * 10;
}

// square str to 120 board index
export function SquareStr2Square(str: string): number {
	return FileRank2Square(
		FILES[`${str.charAt(0).toUpperCase()}_` as keyof typeof FILES],
		RANKS[`_${str.charAt(1)}` as keyof typeof RANKS],
	);
}

export function Square2SquareStr(sq: number): string {
	const fr = Square2FileRank(sq);
	return `${FILES_CHAR[fr[0]]}${RANKS_CHAR[fr[1]]}`;
}

export function Str2Piece(str: string): number {
	switch (str) {
		case "p":
			return PIECES.blackPawn;
		case "r":
			return PIECES.blackRook;
		case "n":
			return PIECES.blackKnight;
		case "b":
			return PIECES.blackBishop;
		case "k":
			return PIECES.blackKing;
		case "q":
			return PIECES.blackQueen;
		case "P":
			return PIECES.whitePawn;
		case "R":
			return PIECES.whiteRook;
		case "N":
			return PIECES.whiteKnight;
		case "B":
			return PIECES.whiteBishop;
		case "K":
			return PIECES.whiteKing;
		case "Q":
			return PIECES.whiteQueen;
		default:
			return PIECES.EMPTY;
	}
}

export function oppositeColor(color: Color): Color {
	if (color === COLORS.BOTH) throw Error("No opposite color for BOTH");
	return (color === COLORS.WHITE ? COLORS.BLACK : COLORS.WHITE) as Color;
}
