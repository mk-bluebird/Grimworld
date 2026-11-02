import assert from "node:assert/strict";
import { test } from "node:test";

import { composeSafeAlternative } from "../src/safety/safe-alternative.ts";
import { createEntityRegistry } from "../src/identity/entity-registry.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("unapproved alternative cannot dilute the refusal", async () => {
  const result = await composeSafeAlternative({
    decision: {
      kind: "refuse",
      policyRevision: "grimlore-safety-v1",
      boundaryText: "I can provide non-graphic ritual horror instead."
    },
    generateAlternative: async () => "Unreviewed candidate.",
    reviewAlternative: async () => ({
      verdict: "unrated",
      policyRevision: "grimlore-safety-v1"
    })
  });

  assert.equal(result.alternativeStatus, "withheld");
  assert.equal(
    result.text,
    "I can provide non-graphic ritual horror instead."
  );
});

test("legacy references resolve only when a redirect exists", () => {
  const references = ["widow", "counterpart", "far_doorway"];
  const currentIds = ["widow", "waiting_woman", "far_doorway"];

  const without = createEntityRegistry(currentIds, {});
  const withRedirect = createEntityRegistry(currentIds, {
    counterpart: "waiting_woman"
  });

  const count = (registry: ReturnType<typeof createEntityRegistry>) =>
    references.filter(id => registry.resolve(id).status === "dangling").length;

  assert.equal(count(without), 1);
  assert.equal(count(withRedirect), 0);
});

test("identity redirect cycles are rejected", () => {
  assert.throws(() => createEntityRegistry(["widow"], {
    old_a: "old_b",
    old_b: "old_a"
  }), /Redirect cycle/);
});
