/**
 * Copy Stockfish lite multi-threaded engine files to dist directory
 * Runs after Vite build to ensure dist folder exists
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, "../node_modules/stockfish/src");
const destDir = path.join(__dirname, "../dist/stockfish");

// Create destination directory if it doesn't exist
if (!fs.existsSync(destDir)) {
	fs.mkdirSync(destDir, { recursive: true });
}

// Files to copy: lite multi-threaded engine
// Matches pattern: stockfish-17.1-lite-[hash].js and .wasm (not single-threaded)
const liteLiteRegex = /^stockfish-17\.1-lite-[a-f0-9]+\.(js|wasm)$/;

try {
	const files = fs.readdirSync(sourceDir);
	let copiedCount = 0;

	files.forEach((file) => {
		if (liteLiteRegex.test(file)) {
			const sourceFile = path.join(sourceDir, file);
			const destFile = path.join(destDir, file);

			if (fs.statSync(sourceFile).isFile()) {
				fs.copyFileSync(sourceFile, destFile);
				console.log(`✓ Copied ${file}`);
				copiedCount++;
			}
		}
	});

	if (copiedCount === 0) {
		console.warn("⚠ No lite engine files found matching pattern");
		process.exit(1);
	}

	console.log(`\n✓ Stockfish lite multi-threaded engine copied to ${destDir}`);
} catch (error) {
	console.error("✗ Error copying Stockfish files:", error.message);
	process.exit(1);
}
