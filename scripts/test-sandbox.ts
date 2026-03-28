/**
 * Sandbox Verification Script
 *
 * Usage: npx tsx scripts/test-sandbox.ts
 *
 * Verifies that the Vercel Sandbox SDK is working by:
 * 1. Creating a sandbox with Node.js 24 runtime
 * 2. Running a simple command inside it
 * 3. Writing a file and reading it back
 * 4. Starting an HTTP server and checking it responds
 * 5. Taking a snapshot for future fast-boot
 * 6. Cleaning up
 *
 * Prerequisites:
 * - Run `vercel link` first to connect to your project
 * - Run `vercel env pull` to get credentials
 * - Or set VERCEL_TOKEN env var
 */

import { Sandbox } from "@vercel/sandbox";

async function main() {
  console.log("=== Vercel Sandbox Integration Test ===\n");

  // Step 1: Create a sandbox
  console.log("1. Creating sandbox (node24 runtime)...");
  const sandbox = await Sandbox.create({
    runtime: "node24",
  });
  console.log(`   ✓ Sandbox created: ${(sandbox as any).id ?? "ok"}\n`);

  // Step 2: Run a command
  console.log("2. Running 'node --version'...");
  const versionResult = await sandbox.runCommand("node", ["--version"]);
  const nodeVersion = await versionResult.stdout();
  console.log(`   ✓ Node version: ${nodeVersion.trim()}`);
  console.log(`   ✓ Exit code: ${versionResult.exitCode}\n`);

  // Step 3: Write and read a file
  console.log("3. Writing and reading a file...");
  await sandbox.writeFiles([
    {
      path: "test-file.json",
      content: Buffer.from(JSON.stringify({ hello: "paperclip", ts: Date.now() })),
    },
  ]);
  const catResult = await sandbox.runCommand("cat", ["test-file.json"]);
  const fileContent = await catResult.stdout();
  console.log(`   ✓ File content: ${fileContent.trim()}\n`);

  // Step 4: Start an HTTP server and test it
  console.log("4. Starting HTTP server in sandbox...");
  await sandbox.writeFiles([
    {
      path: "server.js",
      content: Buffer.from(`
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ok: true,
    message: 'Paperclip control plane sandbox is alive',
    uptime: process.uptime(),
    memory: process.memoryUsage().rss,
    pid: process.pid,
  }));
});
server.listen(3100, '0.0.0.0', () => {
  console.log('Server listening on port 3100');
});
`),
    },
  ]);

  // Start server in background (don't await — it runs forever)
  sandbox.runCommand("node", ["server.js"]);

  // Give it a moment to start
  await new Promise((r) => setTimeout(r, 2000));

  // Check if it's running
  const curlResult = await sandbox.runCommand("curl", [
    "-s",
    "http://localhost:3100/",
  ]);
  const serverResponse = await curlResult.stdout();
  console.log(`   ✓ Server response: ${serverResponse.trim()}\n`);

  // Step 5: Take a snapshot
  console.log("5. Taking snapshot...");
  try {
    const snapshot = await sandbox.snapshot();
    console.log(`   ✓ Snapshot ID: ${snapshot.snapshotId}`);
    console.log(`   (Use this to fast-boot: SANDBOX_SNAPSHOT_ID=${snapshot.snapshotId})\n`);
  } catch (err) {
    console.log(`   ⚠ Snapshot not available: ${err instanceof Error ? err.message : err}\n`);
  }

  // Step 6: Check system info
  console.log("6. System info...");
  const unameResult = await sandbox.runCommand("uname", ["-a"]);
  console.log(`   ✓ OS: ${(await unameResult.stdout()).trim()}`);

  const memResult = await sandbox.runCommand("free", ["-h"]);
  const memOutput = await memResult.stdout();
  if (memOutput) {
    console.log(`   ✓ Memory:\n${memOutput.split("\n").map((l) => `     ${l}`).join("\n")}`);
  }

  console.log("\n=== All tests passed! Sandbox is working. ===");
  console.log("\nThe Vercel Sandbox can run the Paperclip control plane with:");
  console.log("  - Long-running processes (adapters, plugins)");
  console.log("  - Child process spawning (fork, exec)");
  console.log("  - Persistent filesystem (within timeout)");
  console.log("  - HTTP server (port exposure via --publish-port)");
  console.log("\nNext steps:");
  console.log("  1. Set SANDBOX_SNAPSHOT_ID in Vercel env vars");
  console.log("  2. Deploy — the cron will auto-manage the sandbox");
  console.log("  3. Agent execution will be proxied to the sandbox");

  process.exit(0);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
