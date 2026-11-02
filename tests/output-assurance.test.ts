import assert from "node:assert/strict";
import { test } from "node:test";

import {
  selectOutputContract,
  measureSeparation,
  checkComposition,
  measureNegativeSpace
} from "../src/assurance/output-assurance.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("explicit routing corpus has no cross-contract substitutions", () => {
  const fixtures = [
    {
      requested: undefined,
      expected: "grimlore.description.v1"
    },
    {
      requested: "grimlore.description.v1",
      expected: "grimlore.description.v1"
    },
    {
      requested: "grimlore.relational.v2",
      expected: "grimlore.relational.v2"
    },
    { requested: "relational", expected: "reject" },
    { requested: null, expected: "reject" },
    { requested: {}, expected: "reject" }
  ];

  const matrix: Record<string, Record<string, number>> = {};

  for (const fixture of fixtures) {
    const result = selectOutputContract(fixture.requested, {
      defaultContract: "grimlore.description.v1"
    });

    const actual = result.ok ? result.contract : "reject";
    const row = matrix[fixture.expected] ??= {};
    row[actual] = (row[actual] ?? 0) + 1;

    assert.equal(actual, fixture.expected);
  }

  assert.equal(
    matrix["grimlore.description.v1"]!["grimlore.description.v1"],
    2
  );
  assert.equal(
    matrix["grimlore.relational.v2"]!["grimlore.relational.v2"],
    1
  );
  assert.equal(matrix.reject!.reject, 3);
});

test("endpoint requirements cannot be overridden", () => {
  assert.deepEqual(
    selectOutputContract("grimlore.description.v1", {
      defaultContract: "grimlore.relational.v2",
      requiredContract: "grimlore.relational.v2"
    }),
    { ok: false, code: "CONTRACT_CONFLICT" }
  );
});

test("separation scoring distinguishes unsupported from unreviewed", () => {
  const result = measureSeparation([
    {
      id: "c1",
      section: "observable_facts",
      text: "A wooden chair stands beside the doorway.",
      kind: "observational",
      evidence: "supported"
    },
    {
      id: "c2",
      section: "observable_facts",
      text: "Someone abandoned the chair after hearing the bell.",
      kind: "interpretive",
      evidence: "not_established"
    },
    {
      id: "c3",
      section: "observable_facts",
      text: "The handle is copper.",
      kind: "unreviewed",
      evidence: "unreviewed"
    }
  ]);

  assert.equal(result.adjudicatedLeakageRate, 0.5);
  assert.equal(result.reviewCoverage, 2 / 3);
  assert.equal(result.unadjudicatedFactClaimCount, 1);
  assert.deepEqual(result.leakingClaimIds, ["c2"]);
});

test("empty fact sections do not receive a perfect score", () => {
  const result = measureSeparation([]);
  assert.equal(result.adjudicatedLeakageRate, null);
  assert.equal(result.reviewCoverage, null);
});

test("eye path may revisit foreground unless forbidden", () => {
  const input = {
    entityIds: ["reeds", "door"],
    eyePath: ["reeds", "door", "reeds"],
    depthLayers: {
      foreground: ["reeds"],
      middle_ground: [],
      background: ["door"]
    }
  };

  assert.equal(checkComposition(input).ordering, "consistent");

  const restricted = checkComposition({
    ...input,
    traversal: "near_to_far"
  });

  assert.equal(restricted.ordering, "violated");
  assert.equal(
    restricted.diagnostics.filter(
      diagnostic => diagnostic.code === "DEPTH_BACKTRACK"
    ).length,
    1
  );
});

test("partial negative-space masks produce bounds", () => {
  const result = measureNegativeSpace({
    width: 2,
    height: 2,
    cells: [true, true, false, null],
    sourceBasis: "expert_annotation"
  });

  assert.equal(result.status, "partial");
  if (result.status === "indeterminate") return;

  assert.equal(result.fractionLowerBound, 0.5);
  assert.equal(result.fractionUpperBound, 0.75);
  assert.equal(result.perceptualQuietness, "not_evaluated");
});

test("missing geometry is not a pass", () => {
  assert.deepEqual(measureNegativeSpace(), {
    status: "indeterminate",
    reason: "GEOMETRY_ABSENT"
  });
});
