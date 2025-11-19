import {
	BishopDirections,
	CASTLEBITS,
	COLORS,
	type Color,
	FILES,
	KingDirections,
	KnightDirections,
	MOVES,
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
} from "./constants.ts";
import type { ChessEngine } from "./engine.ts";
import { FileRank2Square, oppositeColor, Square2FileRank } from "./funcs.ts";
import { Castling2Fen, EnPassant2Fen, exportFen, importFen } from "./parser.ts";

interface _FenImportResult {
	board: number[];
	color: Color;
	castlingAvailability: number;
	enPassantSquare: number;
	halfMoveClock: number;
	fullMoveNumber: number;
}

type Move = [number, number];

class ChessPosition {
	error: string | boolean;
	board: number[];
	color: Color;
	castlingAvailability: number;
	enPassantSquare: number;
	halfMoveClock: number;
	fullMoveNumber: number;
	piecesValue: number[];
	piecesCount: number[];
	pieceList: (number | undefined)[];
	private engine: ChessEngine | null = null;

	constructor(fen?: string, engine?: ChessEngine) {
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

		this.engine = engine || null;
	}

	setEngine(engine: ChessEngine): void {
		this.engine = engine;
	}

	getField(_field: string): string {
		return "";
	}

	/**
	 * Export current position to FEN notation
	 */
	toFen(): string {
		return exportFen(
			this.board,
			this.color,
			this.castlingAvailability,
			this.enPassantSquare,
			this.halfMoveClock,
			this.fullMoveNumber,
		);
	}

	/**
	 * Get engine evaluation of current position
	 * @param depth - Search depth for analysis
	 * @returns Score in centipawns (positive = white advantage)
	 */
	async getEngineEvaluation(depth: number = 15): Promise<number> {
		if (!this.engine) return 0;
		return this.engine.evaluatePosition(this.toFen(), depth);
	}

	/**
	 * Get best move from engine for current position
	 * @param depth - Search depth
	 * @param timeMs - Time limit in milliseconds
	 * @returns Move in UCI format (e.g., "e2e4")
	 */
	async getEngineBestMove(depth?: number, timeMs?: number): Promise<string> {
		if (!this.engine) return "";
		return this.engine.getBestMove(this.toFen(), depth, timeMs || 3000);
	}

	/**
	 * Get detailed engine analysis for current position
	 * @param depth - Search depth
	 * @returns Array of analysis info at each depth level
	 */
	async getEngineAnalysis(depth: number = 15) {
		if (!this.engine) return [];
		return this.engine.evaluatePositionDetailed(this.toFen(), depth);
	}

	move(move: Move): void {
		// empty src
		if (this.board[move[0]] === PIECES.EMPTY)
			throw Error(`No piece on Square ${move[0]}`);

		const piece = this.board[move[0]];
		const destination = this.board[move[1]];
		const moveType = this.getMoveType(move);

		// Handle en passant capture
		if (moveType === MOVES.EnPassant) {
			const capturedPawnSq =
				this.color === COLORS.WHITE
					? move[1] - 10 // captured pawn is one rank below
					: move[1] + 10; // captured pawn is one rank above
			this.board[capturedPawnSq] = PIECES.EMPTY;
		}

		// Handle castling - move rook
		if (moveType === MOVES.KingSideCastling) {
			const rookSrc =
				this.color === COLORS.WHITE
					? FileRank2Square(FILES.H_, RANKS._1) // h1
					: FileRank2Square(FILES.H_, RANKS._8); // h8
			const rookDst =
				this.color === COLORS.WHITE
					? FileRank2Square(FILES.F_, RANKS._1) // f1
					: FileRank2Square(FILES.F_, RANKS._8); // f8
			this.board[rookDst] = this.board[rookSrc];
			this.board[rookSrc] = PIECES.EMPTY;
		} else if (moveType === MOVES.QueenSideCastling) {
			const rookSrc =
				this.color === COLORS.WHITE
					? FileRank2Square(FILES.A_, RANKS._1) // a1
					: FileRank2Square(FILES.A_, RANKS._8); // a8
			const rookDst =
				this.color === COLORS.WHITE
					? FileRank2Square(FILES.D_, RANKS._1) // d1
					: FileRank2Square(FILES.D_, RANKS._8); // d8
			this.board[rookDst] = this.board[rookSrc];
			this.board[rookSrc] = PIECES.EMPTY;
		}

		// Move the piece
		this.board[move[0]] = PIECES.EMPTY;
		this.board[move[1]] = piece;

		// Update castling availability
		if (PieceKing[piece]) {
			// King moved - lose both castling rights
			if (this.color === COLORS.WHITE) {
				this.castlingAvailability &= ~CASTLEBITS.WKCA;
				this.castlingAvailability &= ~CASTLEBITS.WQCA;
			} else {
				this.castlingAvailability &= ~CASTLEBITS.BKCA;
				this.castlingAvailability &= ~CASTLEBITS.BQCA;
			}
		} else if (PieceRookQueen[piece] && !PieceBishopQueen[piece]) {
			// Rook moved - lose castling right on that side
			const srcFile = Square2FileRank(move[0])[0];
			if (this.color === COLORS.WHITE) {
				if (srcFile === FILES.H_) this.castlingAvailability &= ~CASTLEBITS.WKCA;
				else if (srcFile === FILES.A_)
					this.castlingAvailability &= ~CASTLEBITS.WQCA;
			} else {
				if (srcFile === FILES.H_) this.castlingAvailability &= ~CASTLEBITS.BKCA;
				else if (srcFile === FILES.A_)
					this.castlingAvailability &= ~CASTLEBITS.BQCA;
			}
		}

		// Opponent's castling rights lost if rook captured
		if (destination !== PIECES.EMPTY && PieceRookQueen[destination]) {
			const capturedFile = Square2FileRank(move[1])[0];
			const capturedColor = PieceColor[destination];
			if (capturedColor === COLORS.WHITE) {
				if (capturedFile === FILES.H_)
					this.castlingAvailability &= ~CASTLEBITS.WKCA;
				else if (capturedFile === FILES.A_)
					this.castlingAvailability &= ~CASTLEBITS.WQCA;
			} else {
				if (capturedFile === FILES.H_)
					this.castlingAvailability &= ~CASTLEBITS.BKCA;
				else if (capturedFile === FILES.A_)
					this.castlingAvailability &= ~CASTLEBITS.BQCA;
			}
		}

		// Update en passant square
		let newEnPassantSq = 0;
		if (PiecePawn[piece]) {
			const srcRank = Square2FileRank(move[0])[1];
			const dstRank = Square2FileRank(move[1])[1];
			const dstFile = Square2FileRank(move[1])[0];
			// Check if pawn moved 2 squares
			if (Math.abs(dstRank - srcRank) === 2) {
				// En passant square is between source and destination
				const epRank = (srcRank + dstRank) / 2;
				newEnPassantSq = FileRank2Square(dstFile, epRank);
			}
		}
		this.enPassantSquare = newEnPassantSq;

		// Reset halfMoveClock on pawn move or capture
		if (PiecePawn[piece] || destination !== PIECES.EMPTY) {
			this.halfMoveClock = 0;
		} else {
			this.halfMoveClock++;
		}

		// Increment fullMoveNumber after black moves
		if (this.color === COLORS.BLACK) {
			this.fullMoveNumber++;
		}

		// switch side to play
		this.color = oppositeColor(this.color);
	}

	/**
	 * Determine move type (normal, en passant, or castling)
	 */
	private getMoveType(move: Move): number {
		const piece = this.board[move[0]];

		if (PieceKing[piece]) {
			const srcFile = Square2FileRank(move[0])[0];
			const dstFile = Square2FileRank(move[1])[0];
			// Kingside castling: king moves 2 squares to the right
			if (Math.abs(dstFile - srcFile) === 2) {
				if (dstFile > srcFile) {
					return MOVES.KingSideCastling;
				} else {
					return MOVES.QueenSideCastling;
				}
			}
		}

		if (PiecePawn[piece]) {
			// En passant: pawn capture but destination is empty
			if (this.board[move[1]] === PIECES.EMPTY) {
				const dstFile = Square2FileRank(move[1])[0];
				const srcFile = Square2FileRank(move[0])[0];
				// Diagonal move to empty square = en passant
				if (dstFile !== srcFile) {
					return MOVES.EnPassant;
				}
			}
		}

		return MOVES.NORMAL;
	}

	isGameOver(): boolean {
		return this.isCheckmate() || this.isRemis();
	}

	isCheckmate(color?: Color): boolean {
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
					squares.push(move);
				}
			});

			// En passant captures
			if (this.enPassantSquare !== 0) {
				const epFile = Square2FileRank(this.enPassantSquare)[0];
				const pawnFile = Square2FileRank(sq)[0];
				const pawnRank = Square2FileRank(sq)[1];

				// Pawn must be on correct rank and adjacent file
				const correctRank =
					(colorOfPiece === COLORS.WHITE && pawnRank === RANKS._5) ||
					(colorOfPiece === COLORS.BLACK && pawnRank === RANKS._4);
				const adjacentFile = Math.abs(epFile - pawnFile) === 1;

				if (correctRank && adjacentFile) {
					// Can capture en passant
					const captureSquare =
						colorOfPiece === COLORS.WHITE
							? this.enPassantSquare + 10 // pawn we're capturing is one rank behind
							: this.enPassantSquare - 10; // pawn we're capturing is one rank ahead
					if (
						this.board[captureSquare] !== PIECES.EMPTY &&
						PiecePawn[this.board[captureSquare]] &&
						PieceColor[this.board[captureSquare]] ===
							oppositeColor(colorOfPiece)
					) {
						squares.push([sq, this.enPassantSquare]);
					}
				}
			}

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

		//* Bishops *//
		if (PieceBishopQueen[piece] && !PieceRookQueen[piece]) {
			const squares: Move[] = [];
			for (let i = 0; i < 4; i++) {
				const dir = BishopDirections[i];
				let t_sq = sq + dir;
				let t_piece = this.board[t_sq];
				while (t_piece !== SQUARES.OFFBOARD) {
					if (t_piece === PIECES.EMPTY) {
						squares.push([sq, t_sq]);
					} else if (PieceColor[t_piece] === oppositeColor(colorOfPiece)) {
						squares.push([sq, t_sq]);
						break;
					} else {
						break;
					}
					t_sq += dir;
					t_piece = this.board[t_sq];
				}
			}
			return squares;
		}

		//* Rooks *//
		if (PieceRookQueen[piece] && !PieceBishopQueen[piece]) {
			const squares: Move[] = [];
			for (let i = 0; i < 4; i++) {
				const dir = RookDirections[i];
				let t_sq = sq + dir;
				let t_piece = this.board[t_sq];
				while (t_piece !== SQUARES.OFFBOARD) {
					if (t_piece === PIECES.EMPTY) {
						squares.push([sq, t_sq]);
					} else if (PieceColor[t_piece] === oppositeColor(colorOfPiece)) {
						squares.push([sq, t_sq]);
						break;
					} else {
						break;
					}
					t_sq += dir;
					t_piece = this.board[t_sq];
				}
			}
			return squares;
		}

		//* Queens *//
		if (PieceRookQueen[piece] && PieceBishopQueen[piece]) {
			const squares: Move[] = [];
			// Rook directions
			for (let i = 0; i < 4; i++) {
				const dir = RookDirections[i];
				let t_sq = sq + dir;
				let t_piece = this.board[t_sq];
				while (t_piece !== SQUARES.OFFBOARD) {
					if (t_piece === PIECES.EMPTY) {
						squares.push([sq, t_sq]);
					} else if (PieceColor[t_piece] === oppositeColor(colorOfPiece)) {
						squares.push([sq, t_sq]);
						break;
					} else {
						break;
					}
					t_sq += dir;
					t_piece = this.board[t_sq];
				}
			}
			// Bishop directions
			for (let i = 0; i < 4; i++) {
				const dir = BishopDirections[i];
				let t_sq = sq + dir;
				let t_piece = this.board[t_sq];
				while (t_piece !== SQUARES.OFFBOARD) {
					if (t_piece === PIECES.EMPTY) {
						squares.push([sq, t_sq]);
					} else if (PieceColor[t_piece] === oppositeColor(colorOfPiece)) {
						squares.push([sq, t_sq]);
						break;
					} else {
						break;
					}
					t_sq += dir;
					t_piece = this.board[t_sq];
				}
			}
			return squares;
		}

		//* Kings *//
		if (PieceKing[piece]) {
			const squares: Move[] = KingDirections.filter(
				(dir) =>
					this.board[sq + dir] !== SQUARES.OFFBOARD &&
					(this.board[sq + dir] === PIECES.EMPTY ||
						PieceColor[this.board[sq + dir]] === oppositeColor(colorOfPiece)),
			).map((dir) => [sq, sq + dir]);

			// Castling moves
			if (colorOfPiece === COLORS.WHITE) {
				// Kingside castling (O-O)
				if (
					this.castlingAvailability & CASTLEBITS.WKCA &&
					this.board[FileRank2Square(FILES.F_, RANKS._1)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.G_, RANKS._1)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.H_, RANKS._1)] ===
						PIECES.whiteRook &&
					!this.isSquareAttacked(sq, COLORS.BLACK) && // King not in check
					!this.isSquareAttacked(
						FileRank2Square(FILES.F_, RANKS._1),
						COLORS.BLACK,
					) && // King doesn't pass through attacked square
					!this.isSquareAttacked(
						FileRank2Square(FILES.G_, RANKS._1),
						COLORS.BLACK,
					) // King doesn't end in check
				) {
					squares.push([sq, FileRank2Square(FILES.G_, RANKS._1)]);
				}

				// Queenside castling (O-O-O)
				if (
					this.castlingAvailability & CASTLEBITS.WQCA &&
					this.board[FileRank2Square(FILES.B_, RANKS._1)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.C_, RANKS._1)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.D_, RANKS._1)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.A_, RANKS._1)] ===
						PIECES.whiteRook &&
					!this.isSquareAttacked(sq, COLORS.BLACK) && // King not in check
					!this.isSquareAttacked(
						FileRank2Square(FILES.D_, RANKS._1),
						COLORS.BLACK,
					) && // King doesn't pass through attacked square
					!this.isSquareAttacked(
						FileRank2Square(FILES.C_, RANKS._1),
						COLORS.BLACK,
					) // King doesn't end in check
				) {
					squares.push([sq, FileRank2Square(FILES.C_, RANKS._1)]);
				}
			} else {
				// Black kingside castling (O-O)
				if (
					this.castlingAvailability & CASTLEBITS.BKCA &&
					this.board[FileRank2Square(FILES.F_, RANKS._8)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.G_, RANKS._8)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.H_, RANKS._8)] ===
						PIECES.blackRook &&
					!this.isSquareAttacked(sq, COLORS.WHITE) && // King not in check
					!this.isSquareAttacked(
						FileRank2Square(FILES.F_, RANKS._8),
						COLORS.WHITE,
					) && // King doesn't pass through attacked square
					!this.isSquareAttacked(
						FileRank2Square(FILES.G_, RANKS._8),
						COLORS.WHITE,
					) // King doesn't end in check
				) {
					squares.push([sq, FileRank2Square(FILES.G_, RANKS._8)]);
				}

				// Black queenside castling (O-O-O)
				if (
					this.castlingAvailability & CASTLEBITS.BQCA &&
					this.board[FileRank2Square(FILES.B_, RANKS._8)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.C_, RANKS._8)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.D_, RANKS._8)] === PIECES.EMPTY &&
					this.board[FileRank2Square(FILES.A_, RANKS._8)] ===
						PIECES.blackRook &&
					!this.isSquareAttacked(sq, COLORS.WHITE) && // King not in check
					!this.isSquareAttacked(
						FileRank2Square(FILES.D_, RANKS._8),
						COLORS.WHITE,
					) && // King doesn't pass through attacked square
					!this.isSquareAttacked(
						FileRank2Square(FILES.C_, RANKS._8),
						COLORS.WHITE,
					) // King doesn't end in check
				) {
					squares.push([sq, FileRank2Square(FILES.C_, RANKS._8)]);
				}
			}

			return squares;
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
