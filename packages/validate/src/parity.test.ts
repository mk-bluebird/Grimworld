import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import Ajv2020 from "ajv/dist/2020.js";
import { Type, type TSchema } from "@sinclair/typebox";
import { TypeCompiler } from "@sinclair/typebox/compiler";

import {
  validateReferences
} from "../../../scripts/validate-references.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Document credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

const ATTRIBUTION =
  "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7";

type Obj = Record<string, unknown>;

const ROOT = process.cwd();
const SCHEMA_PATH = path.join(
  ROOT, "schemas/grimlore-relational-artwork.schema.json"
);
const SCENE_PATH = path.join(
  ROOT,
  "artworks/river-village-invitation/" +
    "river-village-invitation.scene.json"
);

function obj(value: unknown): Obj {
  assert(
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value),
    "Expected an object"
  );
  return value as Obj;
}

function list(value: unknown): unknown[] {
  assert(Array.isArray(value), "Expected an array");
  return value;
}

async function json(filename: string): Promise<unknown> {
  return JSON.parse(await readFile(filename, "utf8")) as unknown;
}

/**
 * Deliberately limited to this contract's keyword vocabulary.
 * Fail closed when the schema evolves beyond the supported subset.
 */
function toTypeBox(root: Obj): TSchema {
  const allowed = new Set([
    "$schema", "$id", "$defs", "$ref",
    "title", "description", "$comment",
    "type", "const", "enum",
    "properties", "required", "additionalProperties", "items"
  ]);

  function resolve(ref: string): unknown {
    assert(
      ref.startsWith("#/"),
      `Only local JSON Pointer references are supported: ${ref}`
    );

    let value: unknown = root;
    for (const token of ref.slice(2).split("/")) {
      const key = token.replace(/~1/g, "/").replace(/~0/g, "~");
      const current = obj(value);
      assert(
        Object.hasOwn(current, key),
        `Unresolved schema reference: ${ref}`
      );
      value = current[key];
    }
    return value;
  }

  function convert(
    input: unknown,
    activeRefs = new Set<string>()
  ): TSchema {
    if (input === true) return Type.Unknown();
    if (input === false) return Type.Never();

    const node = obj(input);

    for (const key of Object.keys(node)) {
      assert(allowed.has(key), `Unsupported schema keyword: ${key}`);
    }

    if ("$ref" in node) {
      // This adapter does not implement sibling assertions on $ref.
      assert(
        Object.keys(node).every(
          key => ["$ref", "title", "description", "$comment"].includes(key)
        ),
        "$ref sibling assertions require an adapter extension"
      );

      const ref = String(node.$ref);
      assert(!activeRefs.has(ref), `Recursive schema unsupported: ${ref}`);

      const next = new Set(activeRefs);
      next.add(ref);
      return convert(resolve(ref), next);
    }

    // The supplied contract uses standalone string enums/constants.
    if ("const" in node || "enum" in node) {
      assert(
        Object.keys(node).every(key =>
          ["const", "enum", "type", "title", "description", "$comment"]
            .includes(key)
        ),
        "Combined enum/const assertions require an adapter extension"
      );
      assert(
        node.type === undefined || node.type === "string",
        "Only string enum/const nodes are supported"
      );
      assert(
        !("const" in node && "enum" in node),
        "Combined const and enum are unsupported"
      );

      const values = "const" in node ? [node.const] : list(node.enum);
      assert(values.length > 0, "Empty enums are unsupported");
      assert(
        values.every(value => typeof value === "string"),
        "Only string enum/const values are supported"
      );

      const members = values.map(value => Type.Literal(value as string));
      return members.length === 1 ? members[0]! : Type.Union(members);
    }

    switch (node.type) {
      case "object": {
        const properties = node.properties === undefined
          ? {}
          : obj(node.properties);

        const required = new Set(
          node.required === undefined ? [] : list(node.required)
        );

        for (const name of required) {
          assert(
            typeof name === "string" && Object.hasOwn(properties, name),
            "Required undeclared properties need an adapter extension"
          );
        }

        const fields: Record<string, TSchema> = {};
        for (const [name, definition] of Object.entries(properties)) {
          const field = convert(definition, activeRefs);
          // defineProperty also safely handles a property named "__proto__".
          Object.defineProperty(fields, name, {
            value: required.has(name) ? field : Type.Optional(field),
            enumerable: true,
            configurable: true,
            writable: true
          });
        }

        const additional = node.additionalProperties;
        assert(
          additional === undefined || typeof additional === "boolean",
          "Schema-valued additionalProperties is unsupported"
        );

        return Type.Object(fields, {
          additionalProperties: additional ?? true
        });
      }

      case "array":
        assert(node.items !== undefined, "Array items are required");
        return Type.Array(convert(node.items, activeRefs));

      case "string":
        return Type.String();

      case "boolean":
        return Type.Boolean();

      case "number":
        return Type.Number();

      case "integer":
        return Type.Integer();

      case "null":
        return Type.Null();

      default:
        throw new Error(`Unsupported schema type: ${String(node.type)}`);
    }
  }

  return convert(root);
}

function minimalScene(): Obj {
  return {
    id: "minimal",
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
    relationships: [],
    appearance: {
      medium: "Oil",
      palette: {},
      lights: [],
      surface_treatments: []
    },
    constraints: []
  };
}

type Segment = string | number;

function locations(
  value: unknown,
  current: Segment[] = []
): Segment[][] {
  const result = [current];

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      result.push(...locations(item, [...current, index]));
    });
  } else if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      result.push(...locations(item, [...current, key]));
    }
  }

  return result;
}

function at(value: unknown, segments: Segment[]): unknown {
  let current = value;
  for (const segment of segments) {
    current = (current as Record<string | number, unknown>)[segment];
  }
  return current;
}

function replace(
  value: unknown,
  segments: Segment[],
  replacement: unknown
): unknown {
  if (segments.length === 0) return structuredClone(replacement);

  const copy = structuredClone(value);
  const parent = at(copy, segments.slice(0, -1)) as
    Record<string | number, unknown>;

  parent[segments[segments.length - 1]!] = structuredClone(replacement);
  return copy;
}

function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

test("Ajv 2020 and TypeBox agree on fixtures and seeded mutations", async () => {
  const schema = obj(await json(SCHEMA_PATH));
  const supplied = await json(SCENE_PATH);

  assert.equal(
    schema.$schema,
    "https://json-schema.org/draft/2020-12/schema"
  );

  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  assert.equal(ajv.validateSchema(schema), true);
  const ajvCheck = ajv.compile(schema);
  const typeBoxCheck = TypeCompiler.Compile(toTypeBox(schema));

  const good = minimalScene();
  const entity = obj(list(good.entities)[0]);

  const fixtures: Array<{
    name: string;
    value: unknown;
    expected: boolean;
  }> = [
    { name: "supplied", value: supplied, expected: true },
    { name: "minimal", value: good, expected: true }
  ];

  for (const [key, value] of [
    ["realm", "afterlife"],
    ["basis", "unverified"],
    ["id", 42],
    ["unexpected", true]
  ] as const) {
    const copy = structuredClone(good);
    obj(list(copy.entities)[0])[key] = value;
    fixtures.push({
      name: `entity mutation ${key}`,
      value: copy,
      expected: false
    });
  }

  for (const key of Object.keys(entity)) {
    const copy = structuredClone(good);
    delete obj(list(copy.entities)[0])[key];
    fixtures.push({
      name: `missing entity.${key}`,
      value: copy,
      expected: false
    });
  }

  const missingRoot = structuredClone(good);
  delete missingRoot.appearance;
  fixtures.push({
    name: "missing appearance",
    value: missingRoot,
    expected: false
  });

  const openAttributes = structuredClone(good);
  obj(list(openAttributes.entities)[0]).attributes = {
    custom: { nested: [null, true, 12, "value"] }
  };
  fixtures.push({
    name: "open attributes",
    value: openAttributes,
    expected: true
  });

  const seed = 0x4752494d;
  const random = rng(seed);
  const samples = 3000;
  const replacements: unknown[] = [
    null, false, true, 0, 1.5, "", "afterlife",
    "explicit_description", [], {}, ["a"], { custom: true }
  ];

  const mismatches: unknown[] = [];
  let accepted = 0;
  let rejected = 0;

  function compare(name: string, value: unknown, expected?: boolean): void {
    const before = JSON.stringify(value);
    const a = Boolean(ajvCheck(value));
    const ajvErrors = structuredClone(ajvCheck.errors);
    const b = typeBoxCheck.Check(value);

    assert.equal(JSON.stringify(value), before, "Validator mutated input");

    if (a) accepted++;
    else rejected++;

    if (a !== b || (expected !== undefined && a !== expected)) {
      mismatches.push({
        name,
        expected,
        ajv: a,
        typebox: b,
        value,
        ajvErrors,
        typeboxErrors: [...typeBoxCheck.Errors(value)]
      });
    }
  }

  for (const fixture of fixtures) {
    compare(fixture.name, fixture.value, fixture.expected);
  }

  const bases = [good, supplied];
  const paths = bases.map(value => locations(value));

  for (let index = 0; index < samples; index++) {
    const baseIndex = index % bases.length;
    const base = bases[baseIndex];
    const available = paths[baseIndex]!;
    const selected = available[Math.floor(random() * available.length)]!;
    let candidate = structuredClone(base);

    if (index % 3 === 0 && selected.length > 0) {
      const parent = at(candidate, selected.slice(0, -1));
      const key = selected[selected.length - 1]!;

      if (Array.isArray(parent)) {
        parent.splice(Number(key), 1);
      } else {
        delete obj(parent)[String(key)];
      }
    } else if (index % 3 === 1) {
      const target = at(candidate, selected);
      if (target !== null && typeof target === "object" &&
          !Array.isArray(target)) {
        obj(target).__parity_extra = index;
      } else {
        candidate = replace(candidate, selected, { __parity_extra: index });
      }
    } else {
      candidate = replace(
        candidate,
        selected,
        replacements[Math.floor(random() * replacements.length)]
      );
    }

    compare(`mutation-${index}`, candidate);
  }

  const report = {
    attribution: ATTRIBUTION,
    seed,
    deterministicFixtures: fixtures.length,
    generatedMutations: samples,
    accepted,
    rejected,
    mismatchCount: mismatches.length,
    mismatches
  };

  const reportPath = path.join(
    ROOT, "output/validation/parity-report.json"
  );
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");

  assert.equal(
    mismatches.length,
    0,
    `Parity failure; inspect ${path.relative(ROOT, reportPath)}`
  );
});

test("referential defects each produce one intended diagnostic", () => {
  const clean = minimalScene();
  assert.deepEqual(validateReferences(clean), []);

  const dangling = structuredClone(clean);
  dangling.relationships = [{
    id: "r1",
    subject: "a",
    predicate: "observes",
    object: "missing",
    qualifiers: {},
    basis: "explicit_description"
  }];
  assert.deepEqual(
    validateReferences(dangling).map(d => d.code),
    ["DANGLING_ID"]
  );

  const duplicate = structuredClone(clean);
  list(duplicate.entities).push(
    structuredClone(list(duplicate.entities)[0])
  );
  assert.deepEqual(
    validateReferences(duplicate).map(d => d.code),
    ["DUPLICATE_ID"]
  );

  const orphan = structuredClone(clean);
  list(orphan.entities).push({
    ...structuredClone(obj(list(orphan.entities)[0])),
    id: "unused"
  });
  assert.deepEqual(
    validateReferences(orphan, { reportOrphans: true }).map(d => d.code),
    ["ORPHAN_ENTITY"]
  );

  const cycle = structuredClone(clean);
  list(cycle.entities).push({
    ...structuredClone(obj(list(cycle.entities)[0])),
    id: "b"
  });
  cycle.relationships = [
    {
      id: "r1", subject: "a", predicate: "observes", object: "b",
      qualifiers: {}, basis: "explicit_description"
    },
    {
      id: "r2", subject: "b", predicate: "observes", object: "a",
      qualifiers: {}, basis: "explicit_description"
    }
  ];

  assert.deepEqual(validateReferences(cycle), []);
  assert.deepEqual(
    validateReferences(cycle, { reportCycles: true }).map(d => d.code),
    ["CYCLIC_RELATIONSHIP"]
  );
});
