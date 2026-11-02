import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  renameEntity,
  restoreRename
} from "../scripts/rename-entity.ts";

import {
  createContinuityValidator
} from "../src/story/continuity.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

test("rename preserves identity references and parsed-data recovery", () => {
  const original = {
    schema_version: "2.0.0",
    entities: [{ id: "counterpart" }],
    composition: {
      principal_subject: "counterpart",
      focal_target: "counterpart",
      eye_path: ["counterpart"],
      depth_layers: {
        foreground: [],
        middle_ground: [],
        background: ["counterpart"]
      }
    },
    relationships: [{
      id: "pair",
      subject: "widow",
      object: "counterpart",
      supports: ["entity:counterpart", "relationship:other"]
    }],
    constraints: []
  };

  const migrated = renameEntity(
    original, "counterpart", "waiting_woman"
  );

  const relationships = migrated.scene.relationships as Array<{
    object: string;
    supports: string[];
  }>;

  assert.equal(relationships[0]!.object, "waiting_woman");
  assert.deepEqual(relationships[0]!.supports, [
    "entity:waiting_woman",
    "relationship:other"
  ]);

  assert.equal(migrated.scene.schema_version, "2.0.0");
  assert.deepEqual(restoreRename(migrated.record), original);
  assert.equal(original.entities[0]!.id, "counterpart");
});

test("continuity detects overlap but permits change and belief", async () => {
  const schema = JSON.parse(await readFile(
    "schemas/story-continuity.schema.json",
    "utf8"
  ));

  const validate = createContinuityValidator(schema);

  const base = {
    schema_version: "1.0.0",
    story_id: "river-village-invitation",
    branch_id: "hypothetical-test",
    entities: [
      { id: "widow", kind: "character", label: "The widow" }
    ],
    scenes: ["threshold", "crossing"],
    predicates: [{
      id: "lantern_state",
      value_type: "string",
      cardinality: "single"
    }],
    assertions: [
      {
        id: "a1",
        subject: "widow",
        predicate: "lantern_state",
        value: "lit",
        world: "living",
        epistemic: "canon",
        start: 0,
        end: 2,
        source_scene: "threshold"
      },
      {
        id: "a2",
        subject: "widow",
        predicate: "lantern_state",
        value: "unlit",
        world: "living",
        epistemic: "canon",
        start: 1,
        end: 3,
        source_scene: "crossing"
      }
    ]
  };

  const conflict = validate(base).filter(d => d.code === "CONFLICT");
  assert.equal(conflict.length, 1);
  assert.deepEqual(conflict[0]!.assertionIds, ["a1", "a2"]);

  const changedOverTime = structuredClone(base);
  changedOverTime.assertions[1]!.start = 2;
  assert.deepEqual(validate(changedOverTime), []);

  const belief = structuredClone(base) as typeof base & {
    assertions: Array<(typeof base.assertions)[number] & {
      holder?: string;
    }>;
  };

  belief.assertions[1]!.epistemic = "belief";
  belief.assertions[1]!.holder = "widow";
  assert.deepEqual(validate(belief), []);
});
