import {
	BOARD_SIZE_SAFE,
	CASTLEBITS,
	COLORS,
	type Color,
	FILES,
	FILES_CHAR,
	PIECES,
	PIECES_CHAR,
	RANKS,
	SQUARES,
	VARIANTS,
} from "./constants.ts";
import { FileRank2Square, Square2FileRank, Str2Piece } from "./funcs.ts";
import { isValidFen } from "./validator.ts";

interface FenImportResult {
	board: number[];
	color: Color;
	castlingAvailability: number;
	enPassantSquare: number;
	halfMoveClock: number;
	fullMoveNumber: number;
}

// todo pgn
//https://en.wikipedia.org/wiki/Portable_Game_Notation

// https://en.wikipedia.org/wiki/Forsyth%E2%80%93Edwards_Notation
export function importFen(fen: string): FenImportResult | string {
	try {
		isValidFen(fen.trim(), VARIANTS.UNKNOWN);
	} catch (err) {
		return (err as Error).message;
	}

	const fields = fen.split(" ");

	return {
		board: Fen2Board(fields[0]),
		color: fields[1] === "w" ? COLORS.WHITE : COLORS.BLACK,
		castlingAvailability: Fen2Castling(fields[2]),
		enPassantSquare: Fen2EnPassant(fields[3]),
		halfMoveClock: parseInt(fields[4], 10),
		fullMoveNumber: parseInt(fields[5], 10),
	};
}

export function exportFen(
	board: number[],
	color: Color,
	castlingAvailability: number,
	enPassant: number,
	halfMoveClock: number,
	fullMoveNumber: number,
): string {
	return [
		Board2Fen(board),
		color === COLORS.WHITE ? "w" : "b",
		Castling2Fen(castlingAvailability),
		enPassant,
		halfMoveClock,
		fullMoveNumber,
	].join(" ");
}

function Fen2EnPassant(enPassant: string): number {
	if (enPassant === "-") return 0;
	return FileRank2Square(
		FILES[`${enPassant.charAt(0).toUpperCase()}_` as keyof typeof FILES],
		RANKS[`_${enPassant.charAt(1)}` as keyof typeof RANKS],
	);
}

export function EnPassant2Fen(enPassant: number): string {
	if (enPassant === 0) return "-";
	const arr = Square2FileRank(enPassant);
	return `${FILES_CHAR[arr[0]]}${arr[1]}`;
}

function Fen2Castling(castling: string): number {
	let castlingAvailability = 0;
	castling.split("").forEach((val) => {
		switch (val) {
			case "K":
				castlingAvailability |= CASTLEBITS.WKCA;
				break;
			case "Q":
				castlingAvailability |= CASTLEBITS.WQCA;
				break;
			case "k":
				castlingAvailability |= CASTLEBITS.BKCA;
				break;
			case "q":
				castlingAvailability |= CASTLEBITS.BQCA;
				break;
		}
	});
	return castlingAvailability;
}

export function Castling2Fen(castlingAvailability: number): string {
	let str = "";
	if (castlingAvailability & CASTLEBITS.WKCA) str += "K";
	if (castlingAvailability & CASTLEBITS.WQCA) str += "Q";
	if (castlingAvailability & CASTLEBITS.BKCA) str += "k";
	if (castlingAvailability & CASTLEBITS.BQCA) str += "q";
	if (str === "") return "-";
	return str;
}

function Fen2Board(pieces: string): number[] {
	const board = new Array(BOARD_SIZE_SAFE).fill(SQUARES.OFFBOARD);
	// Fen is starting at rank 8
	const ranks = pieces.split("/").reverse();
	ranks.forEach((rank, rankIndex) => {
		const digits = rank.split("");
		let fileIndex = 0;
		let charPos = 0;
		while (fileIndex <= FILES.H_) {
			const digit = parseInt(digits[charPos], 10);
			if (Number.isNaN(digit)) {
				board[FileRank2Square(fileIndex, rankIndex)] = Str2Piece(
					digits[charPos],
				);
				fileIndex++;
			} else {
				let counter = 0;
				while (counter < digit) {
					board[FileRank2Square(fileIndex + counter, rankIndex)] = PIECES.EMPTY;
					counter++;
				}
				fileIndex += digit;
			}
			charPos++;
		}
	});
	return board;
}

function Board2Fen(board: number[]): string {
	// Convert 120-square board representation to FEN board string
	// The board uses 0x88 representation with border squares marked as OFFBOARD
	// Ranks go from 8 to 1 (reverse order in the loop)
	const ranks: string[] = [];

	for (let rank = RANKS._8; rank >= RANKS._1; rank--) {
		let rankStr = "";
		let emptyCount = 0;

		for (let file = FILES.A_; file <= FILES.H_; file++) {
			const square = FileRank2Square(file, rank);
			const piece = board[square];

			if (piece === PIECES.EMPTY) {
				emptyCount++;
			} else {
				// Add empty square count if any
				if (emptyCount > 0) {
					rankStr += emptyCount.toString();
					emptyCount = 0;
				}
				// Add piece character
				rankStr += PIECES_CHAR[piece];
			}
		}

		// Add remaining empty squares at end of rank
		if (emptyCount > 0) {
			rankStr += emptyCount.toString();
		}

		ranks.push(rankStr);
	}

	return ranks.join("/");
}
