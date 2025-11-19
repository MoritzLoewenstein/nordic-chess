import { ChessPosition } from "./chessgame.ts";
import { FILES_CHAR, PIECES, PieceColor, RANKS_CHAR } from "./constants.ts";
import type { ChessEngine } from "./engine.ts";
import { closeEngine, getEngine, isEngineReady } from "./engineManager.ts";
import {
	FileRank2Square,
	oppositeColor,
	Square2FileRank,
	Square2SquareStr,
	SquareStr2Square,
} from "./funcs.ts";

type Move = [number, number];

let chess: ChessPosition;
let engine: ChessEngine | null = null;
let playerMoves: Move[] = [];
const playerMovesEventListeners: ((e: Event) => void)[] = [];

window.addEventListener("load", async () => {
	// Initialize engine
	try {
		engine = await getEngine();
		updateEngineStatus("Ready");
	} catch {
		updateEngineStatus("Engine unavailable");
	}

	loadFen(true);
	const setFenBtn = document.getElementById("set-fen") as HTMLElement;
	setFenBtn.addEventListener("click", () => loadFen());

	const flipBoardBtn = document.getElementById("flip-board") as HTMLElement;
	flipBoardBtn.addEventListener("click", () => flipBoard());

	const newGameBtn = document.getElementById("new-game") as HTMLElement;
	newGameBtn.addEventListener("click", () => loadFen(true));

	const infoExpand = document.getElementById("info-expand") as HTMLElement;
	infoExpand.addEventListener("click", () => {
		const info = document.getElementById("info") as HTMLElement;
		info.classList.toggle("expanded");
		infoExpand.classList.toggle("expanded");
	});

	// Add engine hint button if available
	const hintBtn = document.getElementById("hint");
	if (hintBtn) {
		hintBtn.addEventListener("click", () => getHint());
	}

	// Add analyze button if available
	const analyzeBtn = document.getElementById("analyze");
	if (analyzeBtn) {
		analyzeBtn.addEventListener("click", () => analyzePosition());
	}

	cleanActiveSquareEventListeners();
});

// Cleanup on page unload
window.addEventListener("beforeunload", async () => {
	await closeEngine();
});

function loadFen(loadDefault: boolean = false): void {
	// ts syntax: let fen = (<HTMLInputElement>document.getElementById("fen")).value;
	const fenInput = document.getElementById("fen") as HTMLInputElement;
	const fen = loadDefault ? "" : fenInput.value;
	const errorDiv = document.getElementById("error") as HTMLElement;
	errorDiv.innerText = "";
	chess = new ChessPosition(fen, engine || undefined);
	if (typeof chess.error === "string") {
		errorDiv.innerText = chess.error;
		return;
	}
	removeAllPieces();
	removeSpecialSquareClasses();
	updateTurnIndicator();
	fenInput.value = "";
	const piecesStr = [
		"",
		"wP",
		"wN",
		"wB",
		"wR",
		"wQ",
		"wK",
		"bP",
		"bN",
		"bB",
		"bR",
		"bQ",
		"bK",
	];
	for (let rank = 0; rank < 8; rank++) {
		for (let file = 0; file < 8; file++) {
			const pieceNum = chess.board[FileRank2Square(file, rank)];
			if (pieceNum !== 0)
				setPiece(`${FILES_CHAR[file]}${RANKS_CHAR[rank]}`, piecesStr[pieceNum]);
		}
	}
	cleanActiveSquareEventListeners();
}

function setPiece(square: string, piece: string): void {
	const el = document.getElementById(square) as HTMLElement;
	el.style.backgroundImage = `url(images/${piece}.svg)`;
}

function movePiece(squareSrc: string, squareDst: string): void {
	const srcEl = document.getElementById(squareSrc) as HTMLElement;
	const dstEl = document.getElementById(squareDst) as HTMLElement;
	const img = srcEl.style.backgroundImage;
	dstEl.style.backgroundImage = img;
	srcEl.style.backgroundImage = "none";
}

/**
 * Handle castling: move rook in addition to king
 */
function handleCastling(move: [number, number], color: number): void {
	const srcFile = Square2FileRank(move[0])[0];
	const dstFile = Square2FileRank(move[1])[0];

	// Check if this is a castling move (king moving 2 files)
	if (Math.abs(dstFile - srcFile) !== 2) return;

	let rookSrcSquare: string;
	let rookDstSquare: string;

	if (dstFile > srcFile) {
		// Kingside castling: rook from h-file to f-file
		rookSrcSquare = color === 0 ? "h1" : "h8";
		rookDstSquare = color === 0 ? "f1" : "f8";
	} else {
		// Queenside castling: rook from a-file to d-file
		rookSrcSquare = color === 0 ? "a1" : "a8";
		rookDstSquare = color === 0 ? "d1" : "d8";
	}

	movePiece(rookSrcSquare, rookDstSquare);
}

function removeAllPieces(): void {
	for (let rank = 0; rank < 8; rank++) {
		for (let file = 0; file < 8; file++) {
			const el = document.getElementById(
				`${FILES_CHAR[file]}${RANKS_CHAR[rank]}`,
			) as HTMLElement;
			el.style.backgroundImage = "none";
		}
	}
}

function flipBoard(): void {
	document
		.querySelectorAll("#board, #board-rows, #board-columns, .square")
		.forEach((el) => {
			el.classList.toggle("flipped");
		});
}

/**
 * Update evaluation bar based on engine score (centipawns)
 * Positive = white better, Negative = black better
 */
function setProbabilities(score: number): void {
	const whiteToWin = score / 100;
	const normalizedScore = 1 / (1 + Math.exp(-score / 150));
	const el = document.getElementById("prob-white") as HTMLElement;
	el.style.width = `${normalizedScore * 30}vw`;
	// Update evaluation text
	const evalText = document.getElementById("eval-text");
	const evalScore = whiteToWin.toFixed(2);
	const evalStr = score > 0 ? `+${evalScore}` : evalScore;
	evalText.textContent = `Eval: ${evalStr}`;
}

function _getRandomInt(max: number): number {
	return Math.floor(Math.random() * Math.floor(max));
}

function playMove(index: number): void {
	removeSpecialSquareClasses();
	removeAllMoveEventListeners();
	const move = playerMoves[index];
	const colorBeforeMove = chess.color;
	chess.move(move);
	const el = document.getElementById(Square2SquareStr(move[1])) as HTMLElement;
	el.addEventListener("click", setSquareActive);
	movePiece(Square2SquareStr(move[0]), Square2SquareStr(move[1]));
	// Handle castling rook movement
	handleCastling(move, colorBeforeMove);
	updateTurnIndicator();
	cleanActiveSquareEventListeners();
}

// move => [src, dest, type, index, special1, special2 ]
function setSquareActive(e: Event): void {
	removeSpecialSquareClasses();
	removeAllMoveEventListeners();

	const target = e.target as HTMLElement;
	const square = SquareStr2Square(target.id);
	const piece = chess.board[square];
	if (piece === PIECES.EMPTY) throw Error("Square is empty");
	if (PieceColor[piece] !== chess.color)
		throw Error("Piece of incorrect color");

	// all possible squares
	playerMoves = chess.getPossibleSquares(square);
	playerMoves.forEach((move, index) => {
		const dstEl = document.getElementById(
			Square2SquareStr(move[1]),
		) as HTMLElement;
		dstEl.removeEventListener("click", setSquareActive);
		playerMovesEventListeners[index] = () => playMove(index);
		const sq = Square2SquareStr(move[1]);
		console.log(sq);
		dstEl.addEventListener("click", playerMovesEventListeners[index]);
	});
	// active
	target.classList.add("active");
	// free
	playerMoves
		.map((move) => move[1])
		.filter((sq) => chess.board[sq] === PIECES.EMPTY)
		.map(Square2SquareStr)
		.forEach((sq) => {
			const el = document.getElementById(sq) as HTMLElement;
			el.classList.add("possible");
		});
	// capturable
	playerMoves
		.map((move) => move[1])
		.filter(
			(sq) => PieceColor[chess.board[sq]] === oppositeColor(PieceColor[piece]),
		)
		.map(Square2SquareStr)
		.forEach((sq) => {
			const el = document.getElementById(sq) as HTMLElement;
			el.classList.add("capturable");
		});
}

function removeAllMoveEventListeners(): void {
	playerMoves.forEach((move, index) => {
		const el = document.getElementById(
			Square2SquareStr(move[1]),
		) as HTMLElement;
		el.removeEventListener("click", playerMovesEventListeners[index]);
	});
}

// can be further optimized to only add event listeners to the current color
function cleanActiveSquareEventListeners(): void {
	document.querySelectorAll(".square").forEach((square) => {
		const el = square as HTMLElement;
		if (el.style.backgroundImage !== "none") {
			el.addEventListener("click", setSquareActive);
		}
	});
}

function removeSpecialSquareClasses(): void {
	document.querySelectorAll(".square").forEach((el) => {
		el.classList.remove("active", "possible", "capturable");
	});
}

/**
 * Update engine status display
 */
function updateEngineStatus(status: string): void {
	const statusEl = document.getElementById("engine-status");
	if (statusEl) {
		statusEl.textContent = status;
	}
}

/**
 * Update turn indicator to show whose side to move
 */
function updateTurnIndicator(): void {
	const indicator = document.getElementById("turn-indicator");
	if (indicator) {
		if (chess.color === 0) {
			// White to move
			indicator.textContent = "White to move";
			indicator.classList.remove("black-turn");
			indicator.classList.add("white-turn");
		} else {
			// Black to move
			indicator.textContent = "Black to move";
			indicator.classList.remove("white-turn");
			indicator.classList.add("black-turn");
		}
	}
}

/**
 * Get hint move from engine and highlight it
 */
async function getHint(): Promise<void> {
	if (!engine || !isEngineReady()) {
		alert("Engine not ready");
		return;
	}

	updateEngineStatus("Analyzing...");

	try {
		const move = await chess.getEngineBestMove(15, 1000); // 1 second
		if (move) {
			showMoveHint(move);
			updateEngineStatus("Hint ready");
		}
	} catch (error) {
		console.error("Hint error:", error);
		updateEngineStatus("Analysis failed");
	}
}

/**
 * Show hint by highlighting the suggested move
 */
function showMoveHint(moveUci: string): void {
	if (moveUci.length < 4) return;

	const fromSquare = moveUci.substring(0, 2);
	const toSquare = moveUci.substring(2, 4);

	// Highlight the hint move
	const fromEl = document.getElementById(fromSquare) as HTMLElement;
	const toEl = document.getElementById(toSquare) as HTMLElement;

	if (fromEl && toEl) {
		fromEl.classList.add("hint-from");
		toEl.classList.add("hint-to");

		// Clear hint after 3 seconds
		setTimeout(() => {
			fromEl.classList.remove("hint-from");
			toEl.classList.remove("hint-to");
		}, 3000);
	}
}

/**
 * Analyze current position and display evaluation
 */
async function analyzePosition(): Promise<void> {
	if (!engine || !isEngineReady()) {
		alert("Engine not ready");
		return;
	}

	updateEngineStatus("Deep analysis (20 seconds)...");

	try {
		const analysis = await chess.getEngineAnalysis(20);
		if (analysis.length > 0) {
			const lastInfo = analysis[analysis.length - 1];
			const score = (lastInfo.score / 100).toFixed(2);
			const eval_ = lastInfo.score > 0 ? `+${score}` : score;
			updateEngineStatus(`Eval: ${eval_} | Depth: ${lastInfo.depth}`);
			setProbabilities(lastInfo.score);
		}
	} catch (error) {
		console.error("Analysis error:", error);
		updateEngineStatus("Analysis failed");
	}
}
