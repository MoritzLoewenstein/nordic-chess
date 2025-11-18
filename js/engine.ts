/**
 * ChessEngine - Stockfish Engine Abstraction Layer
 * Handles all UCI protocol communication with Stockfish WASM engine
 * Runs in a Web Worker to avoid blocking the UI
 */

export interface BestMoveResponse {
	move: string;
	ponderMove?: string;
}

export interface EngineInfo {
	depth: number;
	seldepth?: number;
	score: number;
	nodes: number;
	nps: number;
	time: number;
	pv: string[];
	isMate?: boolean;
}

export class ChessEngine {
	private worker: Worker | null = null;
	private responseHandlers: Map<string, (response: string) => void> = new Map();
	private ready: boolean = false;
	private isSearching: boolean = false;
	private infoBuffer: EngineInfo[] = [];

	/**
	 * Initialize the Stockfish engine in a Web Worker
	 * @param workerPath - Path to stockfish worker file (auto-detected if not provided)
	 */
	async initialize(workerPath?: string): Promise<void> {
		// Auto-detect the lite multi-threaded engine file if not provided
		if (!workerPath) {
			try {
				const response = await fetch("/stockfish/");
				if (!response.ok) {
					throw new Error("Failed to load stockfish directory");
				}

				const html = await response.text();
				// Find the lite multi-threaded .js file
				const match = html.match(/href="(stockfish-17\.1-lite-[a-f0-9]+\.js)"/);
				if (!match) {
					throw new Error("Stockfish lite engine not found");
				}
				workerPath = `/stockfish/${match[1]}`;
			} catch (error) {
				console.error("Auto-detection failed:", error);
				throw error;
			}
		}

		return new Promise((resolve, reject) => {
			try {
				this.worker = new Worker(workerPath, {
					type: "module",
				});

				this.worker.onmessage = (event: MessageEvent<string>) => {
					const message = event.data as string;
					this.handleEngineMessage(message);

					if (message === "uciok") {
						this.ready = true;
						resolve();
					}
				};

				this.worker.onerror = (error: ErrorEvent) => {
					console.error("Engine worker error:", error.message);
					reject(error);
				};

				this.send("uci");
			} catch (error) {
				reject(error);
			}
		});
	}

	/**
	 * Send command to engine
	 */
	private send(command: string): void {
		if (!this.worker) throw new Error("Engine not initialized");
		this.worker.postMessage(command);
	}

	/**
	 * Handle incoming messages from engine
	 */
	private handleEngineMessage(message: string): void {
		if (message.startsWith("bestmove")) {
			this.isSearching = false;
			const handler = this.responseHandlers.get("bestmove");
			if (handler) handler(message);
		} else if (message.startsWith("info")) {
			const handler = this.responseHandlers.get("info");
			if (handler) handler(message);
		}
	}

	/**
	 * Register handler for engine responses
	 */
	private onResponse(
		type: "bestmove" | "info",
		handler: (response: string) => void,
	): void {
		this.responseHandlers.set(type, handler);
	}

	/**
	 * Parse "bestmove e2e4 ponder ..." response
	 */
	private parseBestMoveResponse(response: string): BestMoveResponse {
		const match = response.match(/bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
		return {
			move: match ? match[1] : "",
			ponderMove: match?.[2] ? match[2] : undefined,
		};
	}

	/**
	 * Parse "info depth 18 score cp 50 ..." response
	 */
	private parseInfoResponse(response: string): EngineInfo | null {
		const depthMatch = response.match(/depth\s+(\d+)/);
		const scoreMatch =
			response.match(/score\s+cp\s+(-?\d+)/) ||
			response.match(/score\s+mate\s+(-?\d+)/);
		const nodesMatch = response.match(/nodes\s+(\d+)/);
		const npsMatch = response.match(/nps\s+(\d+)/);
		const timeMatch = response.match(/time\s+(\d+)/);
		const pvMatch = response.match(/pv\s+(.*?)(?:\s+[a-z]+|$)/);

		if (!depthMatch || !scoreMatch) return null;

		const depth = parseInt(depthMatch[1], 10);
		let score = 0;
		let isMate = false;

		if (response.includes("mate")) {
			isMate = true;
			const mateIn = parseInt(scoreMatch[1], 10);
			score = mateIn > 0 ? 100000 - mateIn : -100000 - mateIn;
		} else {
			score = parseInt(scoreMatch[1], 10);
		}

		return {
			depth,
			score,
			nodes: nodesMatch ? parseInt(nodesMatch[1], 10) : 0,
			nps: npsMatch ? parseInt(npsMatch[1], 10) : 0,
			time: timeMatch ? parseInt(timeMatch[1], 10) : 0,
			pv: pvMatch ? pvMatch[1].split(/\s+/).filter((m) => m) : [],
			isMate,
		};
	}

	/**
	 * Get best move for a position
	 * @param fen - Position in FEN notation
	 * @param depth - Search depth (higher = stronger but slower)
	 * @param timeMs - Time limit in milliseconds
	 * @returns Best move in UCI format (e.g., "e2e4")
	 */
	async getBestMove(
		fen: string,
		depth?: number,
		timeMs: number = 3000,
	): Promise<string> {
		if (this.isSearching) {
			throw new Error("Engine is already searching");
		}

		this.isSearching = true;

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.responseHandlers.delete("bestmove");
				this.isSearching = false;
				reject(new Error("Engine search timeout"));
			}, timeMs + 1000);

			const handler = (response: string) => {
				clearTimeout(timeout);
				this.responseHandlers.delete("bestmove");
				this.isSearching = false;
				try {
					const result = this.parseBestMoveResponse(response);
					resolve(result.move);
				} catch (error) {
					reject(error);
				}
			};

			try {
				this.onResponse("bestmove", handler);
				this.send(`position fen ${fen}`);

				let goCommand = "go";
				if (depth) {
					goCommand += ` depth ${depth}`;
				} else {
					goCommand += ` movetime ${timeMs}`;
				}

				this.send(goCommand);
			} catch (error) {
				clearTimeout(timeout);
				this.responseHandlers.delete("bestmove");
				this.isSearching = false;
				reject(error);
			}
		});
	}

	/**
	 * Evaluate a position with detailed analysis info
	 * @param fen - Position in FEN notation
	 * @param depth - Search depth
	 * @returns Array of engine info objects from all depth levels
	 */
	async evaluatePositionDetailed(
		fen: string,
		depth: number = 15,
	): Promise<EngineInfo[]> {
		if (this.isSearching) {
			throw new Error("Engine is already searching");
		}

		this.isSearching = true;
		this.infoBuffer = [];

		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				this.responseHandlers.delete("bestmove");
				this.responseHandlers.delete("info");
				this.isSearching = false;
				reject(new Error("Engine evaluation timeout"));
			}, 30000);

			const infoHandler = (response: string) => {
				const info = this.parseInfoResponse(response);
				if (info) {
					this.infoBuffer.push(info);
				}
			};

			const bestMoveHandler = () => {
				clearTimeout(timeout);
				this.responseHandlers.delete("bestmove");
				this.responseHandlers.delete("info");
				this.isSearching = false;
				resolve(this.infoBuffer);
			};

			try {
				this.onResponse("info", infoHandler);
				this.onResponse("bestmove", bestMoveHandler);

				this.send(`position fen ${fen}`);
				this.send(`go depth ${depth}`);
			} catch (error) {
				clearTimeout(timeout);
				this.responseHandlers.delete("bestmove");
				this.responseHandlers.delete("info");
				this.isSearching = false;
				reject(error);
			}
		});
	}

	/**
	 * Evaluate a position, returning only the final score
	 * @param fen - Position in FEN notation
	 * @param depth - Search depth
	 * @returns Score in centipawns (positive = white better)
	 */
	async evaluatePosition(fen: string, depth: number = 15): Promise<number> {
		try {
			const infos = await this.evaluatePositionDetailed(fen, depth);
			if (infos.length === 0) return 0;
			return infos[infos.length - 1].score;
		} catch (error) {
			console.error("Evaluation error:", error);
			return 0;
		}
	}

	/**
	 * Stop current search
	 */
	stopSearch(): void {
		if (this.isSearching) {
			this.send("stop");
		}
	}

	/**
	 * Set engine thread count
	 */
	setThreads(count: number): void {
		if (count < 1) count = 1;
		if (count > 128) count = 128;
		this.send(`setoption name Threads value ${count}`);
	}

	/**
	 * Set engine hash table size in MB
	 */
	setHashSize(sizeInMb: number): void {
		if (sizeInMb < 1) sizeInMb = 1;
		if (sizeInMb > 512) sizeInMb = 512;
		this.send(`setoption name Hash value ${sizeInMb}`);
	}

	/**
	 * Clear engine's transposition table
	 */
	clearHash(): void {
		this.send("setoption name Clear Hash");
	}

	/**
	 * Check if engine is ready
	 */
	isReady(): boolean {
		return this.ready;
	}

	/**
	 * Check if engine is currently searching
	 */
	isSearching_(): boolean {
		return this.isSearching;
	}

	/**
	 * Terminate the engine worker
	 */
	terminate(): void {
		if (this.worker) {
			try {
				this.send("quit");
			} catch (_e) {
				// Engine may already be closed
			}
			this.worker.terminate();
			this.worker = null;
			this.ready = false;
			this.isSearching = false;
		}
	}
}
