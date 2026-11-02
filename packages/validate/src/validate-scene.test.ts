import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";

import {
  createSceneValidator,
  SceneValidationError,
  type ValidatedScene
} from "./validate-scene.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

async function validator() {
  const schema: unknown = JSON.parse(await readFile(
    "schemas/grimlore-relational-artwork.schema.json",
    "utf8"
  ));
  return createSceneValidator(schema);
}

function scene() {
  return {
    schema_version: "2.0.0",
    id: "test",
    provenance: {
      basis: "user_supplied_description",
      invented_lore: true
    },
    composition: {
      principal_subject: "a",
      focal_target: "a",
      eye_path: ["a"],
      depth_layers: {
        foreground: ["a"],
        middle_ground: [],
        background: []
      },
      negative_space: "Open sky"
    },
    entities: [{
      id: "a",
      kind: "character",
      realm: "living",
      placement: "Foreground",
      attributes: {},
      basis: "explicit_description"
    }],
    relationships: [{
      id: "r",
      subject: "a",
      predicate: "suggests",
      object: "a",
      qualifiers: {},
      basis: "derived_interpretation",
      supports: ["entity:a"]
    }],
    appearance: {
      medium: "Oil",
      palette: {},
      lights: [],
      surface_treatments: []
    },
    constraints: [{
      id: "c",
      statement: "Preserve the suggested relationship.",
      basis: "derived_interpretation",
      supports: ["relationship:r"]
    }]
  };
}

test("qualified cross-kind support is valid", async () => {
  const v = await validator();
  assert.equal(v.validate(scene()).ok, true);
});

test("independent semantic findings accumulate", async () => {
  const v = await validator();
  const input = scene();

  input.composition.focal_target = "missing-entity";
  input.relationships[0]!.supports = [
    "relationship:r",
    "entity:missing-support"
  ];

  const result = v.validate(input);
  assert.equal(result.ok, false);

  if (!result.ok) {
    const codes = new Set(result.diagnostics.map(item => item.code));
    assert(codes.has("DANGLING_ENTITY"));
    assert(codes.has("SELF_SUPPORT"));
    assert(codes.has("SUPPORT_MISSING"));
  }
});

test("cross-kind support cycle is rejected", async () => {
  const v = await validator();
  const input = scene();

  input.relationships[0]!.supports = ["constraint:c"];

  const result = v.validate(input);
  assert.equal(result.ok, false);

  if (!result.ok) {
    assert.equal(
      result.diagnostics.filter(d => d.code === "SUPPORT_CYCLE").length,
      1
    );
  }
});

test("tokens are runtime checked and snapshots are isolated", async () => {
  const v = await validator();
  const input = scene();
  const result = v.validate(input);

  assert(result.ok);

  input.id = "changed-after-validation";
  assert.equal(v.read(result.scene).id, "test");

  assert.throws(
    () => v.read({} as ValidatedScene),
    SceneValidationError
  );

  const other = await validator();
  assert.throws(
    () => other.read(result.scene),
    SceneValidationError
  );
});

test("missing supports is a structural failure", async () => {
  const v = await validator();
  const input = scene() as unknown as Record<string, unknown>;

  const relationships = input.relationships as
    Array<Record<string, unknown>>;
  delete relationships[0]!.supports;

  const result = v.validate(input);
  assert.equal(result.ok, false);

  if (!result.ok) {
    assert(result.diagnostics.every(d => d.phase === "structure"));
  }
});

test("generated JSON inputs obey the public result/error contract", async () => {
  const v = await validator();
  let state = 0x4752494d;

  function random(): number {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  }

  function value(depth: number): unknown {
    const choice = Math.floor(random() * (depth > 0 ? 7 : 5));

    switch (choice) {
      case 0: return null;
      case 1: return random() < 0.5;
      case 2: return Math.floor(random() * 1000);
      case 3: return "";
      case 4: return "entity:a";
      case 5:
        return Array.from(
          { length: Math.floor(random() * 4) },
          () => value(depth - 1)
        );
      default:
        return {
          a: value(depth - 1),
          b: value(depth - 1)
        };
    }
  }

  for (let i = 0; i < 2000; i++) {
    try {
      const result = v.validate(value(4));

      assert.equal(typeof result.ok, "boolean");
      assert(Array.isArray(result.diagnostics));

      if (result.ok) {
        assert.equal(result.diagnostics.length, 0);
        assert.equal(typeof v.read(result.scene), "object");
      } else {
        assert(result.diagnostics.length > 0);
      }
    } catch (error) {
      assert(error instanceof SceneValidationError);
    }
  }
});
