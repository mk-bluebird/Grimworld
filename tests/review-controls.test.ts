import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  validateDepth,
  runChecklist,
  selectExamples
} from "../src/assurance/review-controls.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("depth can span layers without numeric distance", () => {
  assert.equal(validateDepth({
    state: "known",
    reference: "viewer",
    extent: ["near", "middle", "far"],
    basis: "explicit_description"
  }), true);

  assert.equal(validateDepth({
    state: "known",
    reference: "viewer",
    extent: ["far", "near"],
    basis: "explicit_description"
  }), false);
});

test("missing review is not silently passed", async () => {
  const rows = await runChecklist({ automated: {}, human: {} });

  assert.equal(rows.length, 9);
  assert(rows.every(row => row.automated.outcome === "not_run"));
  assert(rows.every(row => row.human.outcome === "not_run"));
});

test("adapter failure becomes blocked", async () => {
  const rows = await runChecklist({
    automated: {
      text_only: async () => {
        throw new Error("Unavailable telemetry");
      }
    },
    human: {}
  });

  assert.equal(
    rows.find(row => row.id === "text_only")!.automated.outcome,
    "blocked"
  );
});

test("rotation reproduces exact selection and order", () => {
  const pool = ["mill", "orchard", "courtyard", "threshold"].map(id => {
    const text = `Reviewed synthetic example: ${id}`;
    return {
      id,
      revision: "1",
      text,
      sha256: createHash("sha256").update(text).digest("hex")
    };
  });

  const selection = {
    policy: "deterministic_rotation" as const,
    policyRevision: "rotation-v1",
    packRevision: "pack-v1",
    count: 2,
    selectionKey: "synthetic-case-07-run-03"
  };

  assert.deepEqual(
    selectExamples(pool, selection),
    selectExamples(pool, selection)
  );
});
