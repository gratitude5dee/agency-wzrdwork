import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/**
 * Test-safe Supabase URL used by proxy clients (Venice, Uniswap, Bankr).
 * The real URL is only needed at runtime; tests mock fetch and only need a
 * well-formed base so proxy URL generation does not produce "undefined/…".
 */
const TEST_SUPABASE_URL = "https://test-project.supabase.co";

export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(TEST_SUPABASE_URL),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
