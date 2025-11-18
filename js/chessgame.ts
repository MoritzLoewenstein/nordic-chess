import {
	BishopDirections,
	COLORS,
	FILES,
	KingDirections,
	KnightDirections,
	PIECES,
	PIECES_CHAR,
	PieceBishopQueen,
	PieceColor,
	PieceKing,
	PieceKnight,
	PiecePawn,
	PieceRookQueen,
	RANKS,
	RookDirections,
	SQUARES,
} from "./constants.js";
import { FileRank2Square, oppositeColor, Square2FileRank } from "./funcs.js";
import { Castling2Fen, EnPassant2Fen, importFen } from "./parser.js";

interface _FenImportResult {
	board: number[];
	color: number;
	castlingAvailability: number;
	enPassantSquare: number;
	halfMoveClock: number;
	fullMoveNumber: number;
}

type Move = [number, number];

class ChessPosition {
	error: string | boolean;
	board: number[];
	color: number;
	castlingAvailability: number;
	enPassantSquare: number;
	halfMoveClock: number;
	fullMoveNumber: number;
	piecesValue: number[];
	piecesCount: number[];
	pieceList: (number | undefined)[];

	constructor(fen?: string) {
		if (!fen) fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
		const props = importFen(fen);

		if (typeof props === "string") {
			this.error = props;
			this.board = [];
			this.color = 0;
			this.castlingAvailability = 0;
			this.enPassantSquare = 0;
			this.halfMoveClock = 0;
			this.fullMoveNumber = 0;
			this.piecesValue = [];
			this.piecesCount = [];
			this.pieceList = [];
		} else {
			this.error = false;
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
	}

	getField(_field: string): string {
		return "";
	}

	move(move: Move): void {
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

	isGameOver(): boolean {
		return this.isCheckmate() || this.isRemis();
	}

	isCheckmate(color?: COLORS): boolean {
		if (color === undefined) color = this.color;
		if (color === COLORS.BOTH) throw Error("Color must be black or white");
		// todo get king square of color
		const kingSquare = 0;
		if (!this.isSquareAttacked(kingSquare, oppositeColor(color))) {
			return false;
		}
		// todo get all possible moves for every piece of color
		// todo implement special moves (e.p., castling, promotion)
		// one move is array of length 2 with srcSquare & destSquare
		const allMoves: Move[] = [];
		return !allMoves.some((move) => {
			// make move
			const sq = this.board[move[1]];
			this.board[move[1]] = this.board[move[0]];
			this.board[move[0]] = PIECES.EMPTY;
			// is king still attacked?
			const kingAttacked = this.isSquareAttacked(
				kingSquare,
				oppositeColor(color),
			);
			// undo move
			this.board[move[0]] = this.board[move[1]];
			this.board[move[1]] = sq;
			return !kingAttacked;
		});
	}

	isRemis(): boolean {
		// check remis
		return false;
	}

	generatePositionTree(_depth: number): void {}

	evaluate(): number {
		return 0;
	}

	//* square and attacking color
	isSquareAttacked(sq: number, color: number): boolean {
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
			const piece = this.board[sq + KnightDirections[i]];
			if (
				piece !== SQUARES.OFFBOARD &&
				PieceColor[piece] === color &&
				PieceKnight[piece]
			)
				return true;
		}

		//* rook & queen
		for (let i = 0; i < 4; i++) {
			const dir = RookDirections[i];
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
			const dir = BishopDirections[i];
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
			const piece = this.board[sq + KingDirections[i]];
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
	getPossibleSquares(sq: number): Move[] {
		const piece = this.board[sq];
		const colorOfPiece = PieceColor[piece];
		if (piece === SQUARES.OFFBOARD) throw Error("Square is offboard");
		if (piece === PIECES.EMPTY) throw Error("Square is empty");

		//* Pawns *//
		if (PiecePawn[piece]) {
			const directions = [10, 20, 11, 9];
			const conditions = [
				// 1 step forward
				(move: number) =>
					this.board[sq + move] !== SQUARES.OFFBOARD &&
					this.board[sq + move] === PIECES.EMPTY,
				// 2 steps forward
				(move: number) =>
					((colorOfPiece === COLORS.WHITE &&
						Square2FileRank(sq)[1] === RANKS._2) ||
						(colorOfPiece === COLORS.BLACK &&
							Square2FileRank(sq)[1] === RANKS._7)) &&
					this.board[sq + move / 2] === PIECES.EMPTY &&
					this.board[sq + move] === PIECES.EMPTY,
				// capture forward right
				(move: number) =>
					this.board[sq + move] !== SQUARES.OFFBOARD &&
					this.board[sq + move] !== PIECES.EMPTY &&
					PieceColor[this.board[sq + move]] === oppositeColor(colorOfPiece),
				// capture forward left
				(move: number) =>
					this.board[sq + move] !== SQUARES.OFFBOARD &&
					this.board[sq + move] !== PIECES.EMPTY &&
					PieceColor[this.board[sq + move]] === oppositeColor(colorOfPiece),
			];
			const squares: Move[] = [];
			const mult = PieceColor[piece] === COLORS.WHITE ? 1 : -1;
			directions.forEach((dir, index) => {
				if (conditions[index](mult * dir)) {
					const move: Move = [sq, sq + mult * dir];
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
					PieceColor[this.board[sq + dir]] === oppositeColor(colorOfPiece),
			).map((dir) => [sq, sq + dir]);
		}
		return [];
	}

	printAttackedSquares(): void {
		console.log("\nAttacked:\n");

		for (let rank = RANKS._8; rank >= RANKS._1; rank--) {
			let line = `${rank + 1}  `;
			for (let file = FILES.A_; file <= FILES.H_; file++) {
				const sq = FileRank2Square(file, rank);
				const piece = this.isSquareAttacked(sq, this.color) ? "X" : "-";
				line += ` ${piece} `;
			}
			console.log(line);
		}
	}

	prettyPrint(): void {
		console.log("\nBoard:\n");
		for (let rank = RANKS._8; rank >= RANKS._1; rank--) {
			let line = `${rank + 1}  `;
			for (let file = FILES.A_; file <= FILES.H_; file++) {
				const sq = FileRank2Square(file, rank);
				const piece = this.board[sq];
				line += ` ${PIECES_CHAR[piece]} `;
			}
			console.log(line);
		}
		console.log("\n    a  b  c  d  e  f  g  h\n");
		console.log(
			`${this.color === COLORS.WHITE ? "White" : "Black"} moves next\n`,
		);
		console.log(`Castling: ${Castling2Fen(this.castlingAvailability)}\n`);
		console.log(`En Passant Square: ${EnPassant2Fen(this.enPassantSquare)} \n`);
		console.log(`halfMoveClock: ${this.halfMoveClock}\n`);
		console.log(`fullMoveNumber: ${this.fullMoveNumber}\n`);
	}
}

// minimax algorithm with alpha-beta pruning
// initial call: minimax(position, n, -Infinity, +Infinity, true)
function _minimax(
	position: ChessPosition,
	depth: number,
	_alpha: number,
	_beta: number,
	maximizingPlayer: boolean,
): number {
	if (depth === 0 || position.isGameOver()) return position.evaluate();

	if (maximizingPlayer) {
		const maxEval = -Infinity;
		// loop through children
		// for (let pos of position.children) {
		//   const ev = minimax(pos, depth - 1, alpha, beta, false);
		//   maxEval = Math.max(maxEval, ev);
		//   alpha = Math.max(alpha, ev);
		//   if (beta <= alpha) {
		//     break;
		//   }
		// }
		return maxEval;
	} else {
		const minEval = +Infinity;
		// for (let pos of position.children) {
		//   const ev = minimax(pos, depth - 1, alpha, beta, true);
		//   minEval = Math.min(minEval, ev);
		//   beta = Math.min(beta, ev);
		//   if (beta <= alpha) {
		//     break;
		//   }
		// }
		return minEval;
	}
}

export { ChessPosition };
