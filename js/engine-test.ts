/**
 * Engine Integration Tests
 * Run these tests to verify Stockfish integration
 * Call from browser console: window.testEngine()
 */

import { ChessPosition } from "./chessgame.ts";
import { closeEngine, getEngine, isEngineReady } from "./engineManager.ts";

interface TestResult {
	name: string;
	passed: boolean;
	message: string;
	duration?: number;
}

const results: TestResult[] = [];

function log(message: string, style: string = ""): void {
	console.log(
		`%c[ENGINE TEST] ${message}`,
		style || "color: #5e81ac; font-weight: bold",
	);
}

function logPass(message: string): void {
	console.log(`%c✓ ${message}`, "color: #a3be8c; font-weight: bold");
}

function logError(message: string): void {
	console.log(`%c✗ ${message}`, "color: #bf616a; font-weight: bold");
}

async function test(
	name: string,
	fn: () => Promise<boolean>,
): Promise<TestResult> {
	const startTime = performance.now();
	try {
		const passed = await fn();
		const duration = performance.now() - startTime;

		if (passed) {
			logPass(`${name} (${duration.toFixed(0)}ms)`);
			results.push({ name, passed: true, message: "OK", duration });
			return { name, passed: true, message: "OK", duration };
		} else {
			logError(`${name} - Assertion failed`);
			results.push({ name, passed: false, message: "Assertion failed" });
			return { name, passed: false, message: "Assertion failed" };
		}
	} catch (error) {
		const duration = performance.now() - startTime;
		const message = error instanceof Error ? error.message : String(error);
		logError(`${name} - ${message} [${duration}]`);
		results.push({ name, passed: false, message });
		return { name, passed: false, message };
	}
}

export async function runEngineTests(): Promise<void> {
	log(
		"Starting Stockfish Integration Tests...",
		"color: #5e81ac; font-size: 14px",
	);
	console.log("");

	results.length = 0;

	// Test 1: Engine initialization
	await test("Engine initialization", async () => {
		const engine = await getEngine();
		return engine !== null && isEngineReady();
	});

	// Test 2: Engine readiness check
	await test("Engine readiness check", async () => {
		return isEngineReady();
	});

	// Test 3: Best move analysis - starting position
	await test("Best move from starting position", async () => {
		const engine = await getEngine();
		const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
		const move = await engine.getBestMove(startFen, 12, 2000);

		// Should be a valid move in UCI format
		return /^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(move);
	});

	// Test 4: Position evaluation
	await test("Position evaluation", async () => {
		const engine = await getEngine();
		const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
		const score = await engine.evaluatePosition(startFen, 12);

		// Starting position should be near equal (within 50 centipawns)
		return Math.abs(score) < 50;
	});

	// Test 5: Detailed analysis
	await test("Detailed position analysis", async () => {
		const engine = await getEngine();
		const startFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
		const infos = await engine.evaluatePositionDetailed(startFen, 12);

		// Should have multiple depth levels
		return infos.length > 0 && infos[infos.length - 1].depth === 12;
	});

	// Test 6: ChessPosition integration
	await test("ChessPosition engine integration", async () => {
		const engine = await getEngine();
		const position = new ChessPosition(
			"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
			engine,
		);

		const move = await position.getEngineBestMove(10, 1000);
		return /^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(move);
	});

	// Test 7: FEN export
	await test("FEN position export", async () => {
		const position = new ChessPosition();
		const fen = position.toFen();

		// Should contain all 6 FEN fields
		const fields = fen.split(" ");
		return fields.length === 6;
	});

	// Test 8: Engine evaluation via ChessPosition
	await test("ChessPosition engine evaluation", async () => {
		const engine = await getEngine();
		const position = new ChessPosition(
			"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
			engine,
		);

		const score = await position.getEngineEvaluation(10);
		return typeof score === "number" && Math.abs(score) < 100;
	});

	// Test 9: Thread setting
	await test("Engine thread configuration", async () => {
		const engine = await getEngine();
		engine.setThreads(2);
		engine.setHashSize(64);

		// Just verify no error is thrown
		return true;
	});

	// Test 10: Multiple moves from same position
	await test("Multiple move analyses", async () => {
		const engine = await getEngine();
		const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

		const move1 = await engine.getBestMove(fen, 10, 500);
		const move2 = await engine.getBestMove(fen, 10, 500);

		// Both should be valid moves
		return (
			/^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(move1) &&
			/^[a-h][1-8][a-h][1-8]([qrbn])?$/.test(move2)
		);
	});

	// Summary
	console.log("");
	log("Test Summary", "color: #5e81ac; font-size: 14px; font-weight: bold");

	const passed = results.filter((r) => r.passed).length;
	const failed = results.filter((r) => !r.passed).length;
	const total = results.length;
	const duration = results.reduce((sum, r) => sum + (r.duration || 0), 0);

	console.log(
		`%c${passed}/${total} tests passed (${failed} failed) - ${duration.toFixed(0)}ms total`,
		passed === total
			? "color: #a3be8c; font-weight: bold"
			: "color: #bf616a; font-weight: bold",
	);

	if (failed > 0) {
		console.log("\nFailed tests:");
		results
			.filter((r) => !r.passed)
			.forEach((r) => {
				console.log(`  - ${r.name}: ${r.message}`);
			});
	}

	// Cleanup
	await closeEngine();
}

// Attach to window for browser console access
declare global {
	interface Window {
		testEngine: () => Promise<void>;
	}
}

if (typeof window !== "undefined") {
	window.testEngine = runEngineTests;
}

export default runEngineTests;
