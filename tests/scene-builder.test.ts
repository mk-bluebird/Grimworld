/** SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { createSceneBuilder, type SceneBase, AuthoringError } from "../packages/authoring/src/scene-builder.ts";
import { diagnostic, authoringAccepted, type ValidationReport } from "../src/diagnostics/catalog.ts";

const base: SceneBase = {
  id: "test", provenance: { basis: "user_supplied_description", invented_lore: true },
  composition: { principal_subject: "a", focal_target: "a", eye_path: ["a"],
    depth_layers: { foreground: ["a"], middle_ground: [], background: [] }, negative_space: "River" },
  appearance: { medium: "oil", palette: {}, lights: [], surface_treatments: [] }
};
const entityData = { kind: "character", realm: "living" as const, placement: "near bank", attributes: {}, basis: "explicit_description" as const };
const clean = (): ValidationReport => ({ status: "complete", diagnostics: [], criticalChecks: [{ id: "fixture-check", outcome: "pass" }] });
// The callback here is a test double, not the production validation pipeline.
test("handles prevent foreign endpoints and duplicate IDs", () => {
  const a = createSceneBuilder(base, clean), b = createSceneBuilder(base, clean);
  const local = a.entity("a", entityData), foreign = b.entity("a", entityData);
  assert.throws(() => a.entity("a", entityData), AuthoringError);
  assert.throws(() => a.relatesTo("r", local, foreign,
    { predicate: "waits_for", qualifiers: {}, basis: "explicit_description" }), AuthoringError);
});
test("builder returns isolated snapshots and invokes validation", () => {
  let calls = 0;
  const builder = createSceneBuilder(base, () => { calls++; return clean(); });
  builder.entity("a", entityData);
  const first = builder.build(); assert(first.ok);
  first.scene.entities[0]!.attributes.changed = true;
  const second = builder.build(); assert(second.ok);
  assert.equal(second.scene.entities[0]!.attributes.changed, undefined);
  assert.equal(calls, 2);
});
test("warnings do not compensate for failed or blocked critical checks", () => {
  const warning = { ...clean(), diagnostics: [diagnostic("INTERPRETATION_REVIEW", "/relationships/0")] };
  assert.equal(authoringAccepted(warning), true);
  assert.equal(authoringAccepted({ ...warning, status: "worker_failed" }), false);
  assert.equal(authoringAccepted({ ...warning, criticalChecks: [{ id: "x", outcome: "blocked" }] }), false);
  assert.equal(authoringAccepted({ ...warning, diagnostics: [diagnostic("SUPPORT_REQUIRED", "/relationships/0")] }), false);
});
test("build does not return a scene after validation failure", () => {
  const builder = createSceneBuilder(base, () => ({ ...clean(), diagnostics: [diagnostic("REFERENCE_DANGLING", "/composition/focal_target")] }));
  builder.entity("a", entityData);
  assert.equal(builder.build().ok, false);
});
