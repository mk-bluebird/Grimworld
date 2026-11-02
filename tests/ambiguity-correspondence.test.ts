import assert from "node:assert/strict";
import { test } from "node:test";

import { checkAmbiguity } from "../src/story/ambiguity-policy.ts";
import { structuralDiff } from "../src/correspondence/structural-diff.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("authoritative ritual explanation violates preserved ambiguity", () => {
  const result = checkAmbiguity([{
    subject: "clay_house_river_custom",
    topic: "purpose",
    state: "intentionally_open",
    allowAttributedSpeculation: true
  }], [{
    id: "invented-explanation",
    subject: "clay_house_river_custom",
    topic: "purpose",
    text: "The wax seals imprison drowned souls.",
    treatment: "authoritative_resolution"
  }]);

  assert.equal(result.status, "violated");
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]!.code, "MYSTERY_RESOLVED");
});

test("village projection exposes only its three declared changes", () => {
  const architecture = {
    bell_tower: "paired_bell_tower",
    mill: "paired_mill",
    houses: "paired_steep_gabled_cluster"
  };

  const before = {
    architecture,
    street_alignment: "near_bank_reference",
    tower: { lean: "toward_river", bell: "absent_from_belfry" }
  };

  const after = {
    architecture: structuredClone(architecture),
    street_alignment: "laterally_displaced",
    tower: {
      lean: "straight",
      bell: "outside_tower_without_visible_support"
    }
  };

  assert.deepEqual(
    structuralDiff(before, after).map(item => item.path),
    ["/street_alignment", "/tower/bell", "/tower/lean"]
  );
});

test("pointer escaping and unknown-versus-missing remain distinct", () => {
  assert.deepEqual(
    structuralDiff({ "a/b~c": null }, {}),
    [{
      kind: "removed",
      path: "/a~1b~0c",
      before: null
    }]
  );
});

test("object key order is irrelevant but array order is retained", () => {
  assert.deepEqual(structuralDiff({ a: 1, b: 2 }, { b: 2, a: 1 }), []);
  assert.equal(structuralDiff(["a", "b"], ["b", "a"]).length, 2);
});
