/**
 * Engine Manager - Singleton pattern for Stockfish engine
 * Ensures only one engine instance exists across the application
 */

import { ChessEngine } from "./engine.ts";

let engineInstance: ChessEngine | null = null;
let initializationPromise: Promise<ChessEngine> | null = null;

/**
 * Get or create the global engine instance
 * Lazy initialization - engine is only created when first requested
 * @returns Promise resolving to the engine instance
 */
export async function getEngine(): Promise<ChessEngine> {
	// If already initialized, return immediately
	if (engineInstance?.isReady()) {
		return engineInstance;
	}

	// If initialization is in progress, wait for it
	if (initializationPromise) {
		return initializationPromise;
	}

	// Start new initialization
	initializationPromise = (async () => {
		try {
			const engine = new ChessEngine();
			await engine.initialize();
			engineInstance = engine;
			return engine;
		} catch (error) {
			console.error("Failed to initialize engine:", error);
			initializationPromise = null;
			throw error;
		}
	})();

	return initializationPromise;
}

/**
 * Get the current engine instance without initializing
 * @returns The engine instance or null if not initialized
 */
export function getEngineIfReady(): ChessEngine | null {
	return engineInstance?.isReady() ? engineInstance : null;
}

/**
 * Close the engine and clean up resources
 */
export async function closeEngine(): Promise<void> {
	if (initializationPromise) {
		try {
			const engine = await initializationPromise;
			engine.terminate();
		} catch (_e) {
			// Initialization may have failed
		}
		initializationPromise = null;
	}

	if (engineInstance) {
		engineInstance.terminate();
		engineInstance = null;
	}
}

/**
 * Check if engine is initialized and ready
 */
export function isEngineReady(): boolean {
	return engineInstance?.isReady();
}

/**
 * Check if engine is currently searching
 */
export function isEngineSearching(): boolean {
	return engineInstance?.isSearching_();
}
