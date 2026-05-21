import { describe, expect, it } from "vitest";

import {
  API,
  ISSUE_TREE_CONTROL_MODES,
  ISSUE_TREE_HOLD_RELEASE_POLICY_STRATEGIES,
  createIssueTreeHoldSchema,
  issueTreeControlModeSchema,
  issueTreeHoldReleasePolicySchema,
  previewIssueTreeControlSchema,
  releaseIssueTreeHoldSchema,
} from "../../packages/shared/dist/index.js";

describe("issue tree control shared contracts", () => {
  it("exports stable API handles for issue tree control routes", () => {
    expect(API.issueTreeControl).toBe("/api/issues/:issueId/tree-control");
    expect(API.issueTreeHolds).toBe("/api/issues/:issueId/tree-holds");
  });

  it("keeps control modes and release policies aligned with validators", () => {
    expect(ISSUE_TREE_CONTROL_MODES).toEqual(["pause", "resume", "cancel", "restore"]);
    expect(ISSUE_TREE_HOLD_RELEASE_POLICY_STRATEGIES).toEqual(["manual", "after_active_runs_finish"]);
    for (const mode of ISSUE_TREE_CONTROL_MODES) {
      expect(issueTreeControlModeSchema.parse(mode)).toBe(mode);
    }
    expect(issueTreeHoldReleasePolicySchema.parse({})).toEqual({ strategy: "manual" });
  });

  it("validates preview, create, and release payloads", () => {
    expect(previewIssueTreeControlSchema.parse({
      mode: "pause",
      releasePolicy: { strategy: "after_active_runs_finish", note: "Let active runs complete." },
    })).toEqual({
      mode: "pause",
      releasePolicy: { strategy: "after_active_runs_finish", note: "Let active runs complete." },
    });

    expect(createIssueTreeHoldSchema.parse({
      mode: "cancel",
      reason: "Duplicate subtree",
      metadata: { source: "test" },
    })).toEqual({
      mode: "cancel",
      reason: "Duplicate subtree",
      metadata: { source: "test" },
    });

    expect(releaseIssueTreeHoldSchema.parse({
      reason: "Work resumed",
      releasePolicy: { strategy: "manual" },
    })).toEqual({
      reason: "Work resumed",
      releasePolicy: { strategy: "manual" },
    });

    expect(() => createIssueTreeHoldSchema.parse({ mode: "archive" })).toThrow();
  });
});
