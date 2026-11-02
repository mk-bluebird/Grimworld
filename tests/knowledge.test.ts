import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { createKnowledgeAnalyzer } from "../src/story/knowledge.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

async function analyzer() {
  const schema = JSON.parse(await readFile(
    "schemas/narrative-scene.schema.json",
    "utf8"
  ));
  return createKnowledgeAnalyzer(schema);
}

function fixture() {
  return {
    schema_version: "1.0.0",
    scene_id: "synthetic-threshold",
    prose: "She waits.",
    annotations: [
      "viewpoint",
      "desire_or_pressure",
      "obstacle",
      "action_or_choice",
      "consequence",
      "continuing_question_or_resolution"
    ].map(requirement => ({
      requirement,
      status: "unclear",
      evidence: [],
      rationale: "Synthetic graph test; narrative assessment withheld."
    })),
    characters: ["widow"],
    facts: ["door_code"],
    events: ["learn", "act"],
    initial_information: [],
    acquisitions: [{
      character: "widow",
      fact: "door_code",
      event: "learn"
    }],
    uses: [{
      character: "widow",
      fact: "door_code",
      event: "act"
    }],
    before: [] as Array<{ from: string; to: string }>,
    causes: [] as Array<{ from: string; to: string }>
  };
}

test("planted premature knowledge is detected", async () => {
  const analyze = await analyzer();
  const scene = fixture();
  scene.before = [{ from: "act", to: "learn" }];

  const result = analyze(scene);
  assert.equal(result.knowledgeStatus, "evaluated");
  assert.equal(result.knowledge[0]!.status, "premature");
});

test("earlier acquisition establishes availability", async () => {
  const analyze = await analyzer();
  const scene = fixture();
  scene.before = [{ from: "learn", to: "act" }];

  assert.equal(analyze(scene).knowledge[0]!.status, "available");
});

test("unordered acquisition remains indeterminate", async () => {
  const analyze = await analyzer();
  assert.equal(analyze(fixture()).knowledge[0]!.status, "indeterminate");
});

test("effect ordered before cause produces exactly one causal finding", async () => {
  const analyze = await analyzer();
  const scene = fixture();

  scene.before = [{ from: "act", to: "learn" }];
  scene.causes = [{ from: "learn", to: "act" }];

  const result = analyze(scene);
  assert.equal(
    result.diagnostics.filter(
      item => item.code === "EFFECT_BEFORE_CAUSE"
    ).length,
    1
  );
});

test("temporal cycle blocks knowledge analysis", async () => {
  const analyze = await analyzer();
  const scene = fixture();

  scene.before = [
    { from: "learn", to: "act" },
    { from: "act", to: "learn" }
  ];

  const result = analyze(scene);
  assert.equal(result.knowledgeStatus, "blocked");
  assert.deepEqual(result.knowledge, []);
  assert.equal(
    result.diagnostics.filter(item => item.code === "TEMPORAL_CYCLE").length,
    1
  );
});

test("present annotations require exact supporting text", async () => {
  const analyze = await analyzer();
  const scene = fixture();

  scene.annotations[0] = {
    requirement: "viewpoint",
    status: "present",
    evidence: [],
    rationale: "Proposed viewpoint annotation."
  };

  assert.equal(
    analyze(scene).diagnostics.filter(
      item => item.code === "EVIDENCE_REQUIRED"
    ).length,
    1
  );
});
