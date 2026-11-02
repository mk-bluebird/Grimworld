import assert from "node:assert/strict";
import { test } from "node:test";

import {
  renderAltText,
  type AltPlan
} from "../src/render/alt-text.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

const source = {
  entities: [{
    id: "widow",
    attributes: {
      identity: "Ferryman's widow."
    }
  }]
};

function plan(language = "en"): AltPlan {
  return {
    language,
    direction: "ltr",
    short: [{
      id: "subject",
      language,
      text: language === "fr"
        ? "La veuve d’un passeur."
        : "A ferryman’s widow.",
      evidence: [{
        pointer: "/entities/0/attributes/identity",
        quote: "Ferryman's widow."
      }]
    }],
    extended: []
  };
}

const approve = (fragment: { language: string }) => ({
  approved: true,
  reviewerId: "synthetic-test-reviewer",
  reviewedLanguage: fragment.language
});

test("localization preserves source keys and resolves English-key pointers", () => {
  const before = JSON.stringify(source);
  const result = renderAltText(source, plan("fr"), approve);

  assert.equal(result.status, "ready");
  if (result.status === "ready") {
    assert.equal(result.language, "fr");
    assert.equal(result.alt, "La veuve d’un passeur.");
  }

  assert.equal(JSON.stringify(source), before);
});

test("stale source evidence blocks rendering", () => {
  const changed = structuredClone(source);
  changed.entities[0]!.attributes.identity = "An unidentified figure.";

  const result = renderAltText(changed, plan(), approve);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "EVIDENCE_STALE");
  }
});

test("required fragments are never truncated", () => {
  const result = renderAltText(source, plan(), approve, 3);
  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "REQUIRED_FRAGMENT_TOO_LONG");
  }
});

test("missing approval is not silently accepted", () => {
  const result = renderAltText(source, plan(), () => ({
    approved: false,
    reviewerId: "synthetic-test-reviewer",
    reviewedLanguage: "en"
  }));

  assert.equal(result.status, "blocked");
  if (result.status === "blocked") {
    assert.equal(result.code, "REVIEW_REQUIRED");
  }
});
