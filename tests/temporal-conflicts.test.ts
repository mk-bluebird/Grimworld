import assert from "node:assert/strict";
import { test } from "node:test";

import {
  allen,
  INVERSE,
  pairwiseConflicts,
  sweepConflicts,
  type AllenRelation,
  type ComparableAssertion,
  type Interval
} from "../src/story/temporal-conflicts.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("finite interval universe exercises all thirteen relations", () => {
  const intervals: Interval[] = [];

  for (let start = 0; start < 5; start++) {
    for (let end = start + 1; end <= 5; end++) {
      intervals.push({ start, end });
    }
  }

  const seen = new Set<AllenRelation>();

  for (const a of intervals) {
    for (const b of intervals) {
      const relation = allen(a, b);
      seen.add(relation);
      assert.equal(allen(b, a), INVERSE[relation]);
    }
  }

  assert.equal(seen.size, 13);

  assert.equal(
    allen({ start: 0, end: 1 }, { start: 1, end: 2 }),
    "meets"
  );
  assert.equal(
    allen({ start: 0, end: 1 }, { start: 2, end: 3 }),
    "before"
  );
  assert.equal(
    allen({ start: 1, end: 2 }, { start: 0, end: 2 }),
    "finishes"
  );
});

function assertion(
  id: string,
  start: number,
  end: number,
  value: string
): ComparableAssertion {
  return {
    id,
    start,
    end,
    value,
    world: "living",
    subject: "widow",
    predicate: "lantern_state",
    epistemic: "canon",
    cardinality: "single"
  };
}

test("adjacency does not conflict; overlap does", () => {
  assert.deepEqual(sweepConflicts([
    assertion("a", 0, 1, "lit"),
    assertion("b", 1, 2, "unlit")
  ]), []);

  assert.deepEqual(sweepConflicts([
    assertion("a", 0, 2, "lit"),
    assertion("b", 1, 3, "unlit")
  ]), [["a", "b"]]);
});

test("new assertion adds every applicable conflict, not exactly one", () => {
  const base = [
    assertion("a", 0, 5, "lit"),
    assertion("b", 1, 4, "lit")
  ];

  assert.deepEqual(sweepConflicts(base), []);

  assert.deepEqual(sweepConflicts([
    ...base,
    assertion("c", 2, 3, "unlit")
  ]), [
    ["a", "c"],
    ["b", "c"]
  ]);
});

test("sweep equals pairwise oracle across generated corpora", () => {
  let state = 0x4752494d;

  function random(): number {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }

  for (let corpus = 0; corpus < 300; corpus++) {
    const values: ComparableAssertion[] = [];

    for (let index = 0; index < 30; index++) {
      const start = Math.floor(random() * 20);
      const item = assertion(
        `a${index}`,
        start,
        start + 1 + Math.floor(random() * 10),
        random() < 0.5 ? "lit" : "unlit"
      );

      item.world = random() < 0.5 ? "living" : "parallel";
      item.subject = random() < 0.5 ? "widow" : "counterpart";
      if (random() < 0.2) item.epistemic = "belief";
      if (random() < 0.1) item.cardinality = "multiple";
      values.push(item);
    }

    assert.deepEqual(
      sweepConflicts(values),
      pairwiseConflicts(values)
    );

    assert.deepEqual(
      sweepConflicts([...values].reverse()),
      sweepConflicts(values)
    );
  }
});
