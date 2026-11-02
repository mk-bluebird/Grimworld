import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizeAssertions,
  definiteConflicts,
  type Assertion
} from "../src/story/definite-conflicts.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

function row(id: string, value: string): Assertion {
  return {
    id,
    value,
    world: "living",
    subject: "widow",
    predicate: "lantern_state",
    epistemic: "canon",
    provenance: "authored",
    cardinality: "single",
    time: { kind: "interval", interval: { start: 0, end: 3 } }
  };
}

function detect(rows: Assertion[]) {
  const admitted = normalizeAssertions(rows);
  assert(admitted.ok);

  const result = definiteConflicts(admitted.input);
  assert.equal(result.status, "complete");
  if (result.status !== "complete") throw new Error("Incomplete result");

  return {
    ...result,
    conflicts: [...result.conflicts].sort(
      (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))
    )
  };
}

test("different worlds, multivalued predicates, and beliefs do not conflict", () => {
  for (const patch of [
    { world: "parallel" },
    { cardinality: "multiple" as const },
    { epistemic: "belief" as const }
  ]) {
    assert.deepEqual(
      detect([row("a", "lit"), { ...row("b", "unlit"), ...patch }])
        .conflicts,
      []
    );
  }
});

test("negative time and invisible predicate IDs are rejected", () => {
  const negative = row("a", "lit");
  negative.time = {
    kind: "interval",
    interval: { start: -1, end: 2 }
  };
  assert.equal(normalizeAssertions([negative]).ok, false);

  const invisible = row("a", "lit");
  invisible.predicate = "lantern\u200b_state";
  assert.equal(normalizeAssertions([invisible]).ok, false);
});

test("ticks are narrative units; adjacent ticks do not overlap", () => {
  const a = row("a", "lit");
  const b = row("b", "unlit");
  a.time = { kind: "tick", at: 1 };
  b.time = { kind: "tick", at: 2 };

  assert.deepEqual(detect([a, b]).conflicts, []);
});

test("possible-only truth cannot manufacture definite conflict or consistency", () => {
  const b = row("b", "unlit");
  b.time = {
    kind: "uncertain",
    definitely_true: null,
    possibly_true: { start: 0, end: 3 }
  };

  const result = detect([row("a", "lit"), b]);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.consistency, "indeterminate");
});

test("definite bounds must lie inside possible bounds", () => {
  const a = row("a", "lit");
  a.time = {
    kind: "uncertain",
    definitely_true: { start: 0, end: 3 },
    possibly_true: { start: 1, end: 2 }
  };

  assert.equal(normalizeAssertions([a]).ok, false);
});

test("adding k conflicts adds precisely those pairs", () => {
  const a = row("a", "lit");
  const b = row("b", "lit");
  assert.deepEqual(detect([a, b]).conflicts, []);

  assert.deepEqual(detect([a, b, row("c", "unlit")]).conflicts, [
    ["a", "c"],
    ["b", "c"]
  ]);
});

test("adding an unrelated key changes no conflict pairs", () => {
  const base = [row("a", "lit"), row("b", "unlit")];
  const unrelated = { ...row("c", "unlit"), subject: "counterpart" };

  assert.deepEqual(
    detect([...base, unrelated]).conflicts,
    detect(base).conflicts
  );
});

test("renaming assertion IDs preserves pairs modulo renaming", () => {
  assert.deepEqual(
    detect([row("renamed_a", "lit"), row("b", "unlit")]).conflicts,
    [["b", "renamed_a"]]
  );
});

test("output exhaustion is not a complete result", () => {
  const admitted = normalizeAssertions([
    row("a", "lit"), row("b", "unlit")
  ]);
  assert(admitted.ok);

  assert.deepEqual(definiteConflicts(admitted.input, 0), {
    status: "conflict_limit_exceeded",
    emittedConflictCount: 0
  });
});
