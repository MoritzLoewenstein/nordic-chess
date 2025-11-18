import { defineConfig } from "vite";

export default defineConfig({
	root: ".",
	server: {
		port: 5173,
		open: true,
		headers: {
			"Cross-Origin-Opener-Policy": "same-origin",
			"Cross-Origin-Embedder-Policy": "require-corp",
		},
	},
	optimizeDeps: {
		exclude: ["stockfish"],
	},
});
