/**
 * Diagnostic endpoint to capture exact module resolution errors.
 * Remove this after debugging is complete.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const results: Record<string, string> = {};

  // Test 1: Can we import the db lib?
  try {
    const dbLib = await import("./_lib/db.js");
    results["_lib/db"] = "OK";
    try {
      const db = dbLib.getDb();
      results["db_connection"] = db ? "OK (instance created)" : "null";
    } catch (e: any) {
      results["db_connection"] = `FAIL: ${e.message}`;
    }
  } catch (e: any) {
    results["_lib/db"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 2: Can we import the server app?
  try {
    await import("../server/dist/app.js");
    results["server/app"] = "OK";
  } catch (e: any) {
    results["server/app"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 3: Can we import services index?
  try {
    await import("../server/dist/services/index.js");
    results["server/services"] = "OK";
  } catch (e: any) {
    results["server/services"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 4: Can we import @paperclipai/shared?
  try {
    await import("@paperclipai/shared");
    results["@paperclipai/shared"] = "OK";
  } catch (e: any) {
    results["@paperclipai/shared"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 5: Can we import @paperclipai/db?
  try {
    await import("@paperclipai/db");
    results["@paperclipai/db"] = "OK";
  } catch (e: any) {
    results["@paperclipai/db"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 6: Can we import @paperclipai/plugin-sdk?
  try {
    await import("@paperclipai/plugin-sdk");
    results["@paperclipai/plugin-sdk"] = "OK";
  } catch (e: any) {
    results["@paperclipai/plugin-sdk"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 7: Can we import express?
  try {
    await import("express");
    results["express"] = "OK";
  } catch (e: any) {
    results["express"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 8: Can we import drizzle-orm?
  try {
    await import("drizzle-orm/postgres-js");
    results["drizzle-orm"] = "OK";
  } catch (e: any) {
    results["drizzle-orm"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  // Test 9: Can we import postgres?
  try {
    await import("postgres");
    results["postgres"] = "OK";
  } catch (e: any) {
    results["postgres"] = `FAIL: ${e.code || ""} ${e.message}`;
  }

  res.status(200).json({
    ok: true,
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ? "SET (hidden)" : "NOT SET",
      VERCEL_ENV: process.env.VERCEL_ENV,
    },
    results,
  });
}
