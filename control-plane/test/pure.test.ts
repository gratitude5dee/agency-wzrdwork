import test from "node:test";
import assert from "node:assert/strict";

import {
  collectSecretIdentifiers,
  decryptSecretValue,
  encryptSecretValue,
  resolveSecretRefs,
} from "../src/secrets.ts";
import { redactJsonValue, redactText } from "../src/redaction.ts";
import {
  isHeartbeatDue,
  nextIntervalIso,
  shouldRetryWakeup,
} from "../src/utils.ts";

test("encryptSecretValue round-trips with decryptSecretValue", () => {
  const key = Buffer.alloc(32, 7);
  const plaintext = "super-secret-token";
  const encrypted = encryptSecretValue(plaintext, key);
  const decrypted = decryptSecretValue(
    {
      algorithm: encrypted.algorithm,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      ciphertext: encrypted.ciphertext,
    },
    key,
  );

  assert.equal(decrypted, plaintext);
  assert.equal(encrypted.algorithm, "aes-256-gcm");
  assert.match(encrypted.valueSha256, /^[a-f0-9]{64}$/);
});

test("collectSecretIdentifiers and resolveSecretRefs support kind and legacy type bindings", () => {
  const config = {
    env: {
      OPENAI_API_KEY: { kind: "secret_ref", secretName: "openai_api_key" },
      GITHUB_TOKEN: { type: "secret_ref", secretId: "github_token" },
      SAFE_VALUE: { type: "plain", value: "hello" },
    },
  };

  const identifiers = Array.from(collectSecretIdentifiers(config).values()).flatMap(
    (entry) => entry.candidates,
  );
  assert.deepEqual(
    identifiers.sort(),
    ["github_token", "openai_api_key"],
  );

  const resolved = resolveSecretRefs(
    config,
    new Map([
      ["openai_api_key", "sk-openai"],
      ["github_token", "ghp-token"],
    ]),
  ) as Record<string, unknown>;

  const env = resolved.env as Record<string, unknown>;
  assert.equal(env.OPENAI_API_KEY, "sk-openai");
  assert.equal(env.GITHUB_TOKEN, "ghp-token");
  assert.equal(env.SAFE_VALUE, "hello");
});

test("redaction removes sensitive values from text and JSON payloads", () => {
  const sensitive = ["sk-secret", "ghp-token"];
  assert.equal(
    redactText("Bearer sk-secret and ghp-token", sensitive),
    "Bearer [REDACTED] and [REDACTED]",
  );

  const payload = redactJsonValue(
    {
      stdout: "token=sk-secret",
      nested: {
        header: "ghp-token",
      },
    },
    sensitive,
  ) as Record<string, unknown>;

  assert.equal(payload.stdout, "token=[REDACTED]");
  assert.deepEqual(payload.nested, { header: "[REDACTED]" });
});

test("heartbeat due calculation and retry logic stay decision-complete", () => {
  assert.equal(
    isHeartbeatDue({ activeWakeupRequestId: "wake-1" }, new Date()),
    false,
  );
  assert.equal(isHeartbeatDue({}, new Date()), true);

  const now = new Date("2026-03-20T12:00:00.000Z");
  const next = nextIntervalIso(30, now);
  assert.equal(next, "2026-03-20T12:00:30.000Z");
  assert.equal(
    isHeartbeatDue({ nextHeartbeatAt: "2026-03-20T12:00:31.000Z" }, now),
    false,
  );
  assert.equal(
    isHeartbeatDue({ nextHeartbeatAt: "2026-03-20T11:59:59.000Z" }, now),
    true,
  );

  assert.equal(shouldRetryWakeup(1, 2), true);
  assert.equal(shouldRetryWakeup(2, 2), false);
});
