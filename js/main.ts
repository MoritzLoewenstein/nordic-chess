import { ChessPosition } from "./chessgame.js";
import { FILES_CHAR, PIECES, PieceColor, RANKS_CHAR } from "./constants.js";
import {
	FileRank2Square,
	oppositeColor,
	Square2SquareStr,
	SquareStr2Square,
} from "./funcs.js";

type Move = [number, number];

let chess: ChessPosition;
let playerMoves: Move[] = [];
const playerMovesEventListeners: ((e: Event) => void)[] = [];

window.addEventListener("load", () => {
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

	const testBtn = document.getElementById("test") as HTMLElement;
	testBtn.addEventListener("click", () => {
		chess.color = oppositeColor(chess.color);
	});

	cleanActiveSquareEventListeners();
});

function loadFen(loadDefault: boolean = false): void {
	// ts syntax: let fen = (<HTMLInputElement>document.getElementById("fen")).value;
	const fenInput = document.getElementById("fen") as HTMLInputElement;
	const fen = loadDefault ? "" : fenInput.value;
	const errorDiv = document.getElementById("error") as HTMLElement;
	errorDiv.innerText = "";
	chess = new ChessPosition(fen);
	if (typeof chess.error === "string") {
		errorDiv.innerText = chess.error;
		return;
	}
	removeAllPieces();
	removeSpecialSquareClasses();
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
	chess.printAttackedSquares();
	chess.prettyPrint();
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

function _setProbabilities(whiteToWin: number): void {
	const el = document.getElementById("prob-white") as HTMLElement;
	el.style.width = `${whiteToWin * 30}vw`;
}

function _getRandomInt(max: number): number {
	return Math.floor(Math.random() * Math.floor(max));
}

function playMove(index: number): void {
	removeSpecialSquareClasses();
	removeAllMoveEventListeners();
	const move = playerMoves[index];
	chess.move(move);
	const el = document.getElementById(Square2SquareStr(move[1])) as HTMLElement;
	el.addEventListener("click", setSquareActive);
	movePiece(Square2SquareStr(move[0]), Square2SquareStr(move[1]));
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
