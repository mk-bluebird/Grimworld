import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Document credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type Basis =
  | "explicit_description"
  | "derived_interpretation"
  | "implementation_choice";

export type Ambiguity<T extends Exclude<Json, null>> =
  | {
      state: "known";
      value: T;
      basis: Basis;
    }
  | {
      state: "unknown" | "not_applicable" | "intentionally_open";
      reason: string;
      basis: Basis;
    };

export interface Correspondence {
  id: string;
  subject: string;
  object: string;
  scope: "listed_attributes";
  preserve: string[];
  alter: Array<{
    key: string;
    operation: "replace" | "mirror";
    from: Json;
    to: Json;
  }>;
  mirror_axis?:
    | "character_sagittal"
    | "image_vertical"
    | "image_horizontal";
  exceptions: string[];
  basis: Basis;
}

export interface EntityProjection {
  id: string;
  attributes: Record<string, Json>;
}

export interface Diagnostic {
  code:
    | "UNSUPPORTED_SCOPE"
    | "ENTITY_MISMATCH"
    | "RULE_CONFLICT"
    | "UNCLASSIFIED_ATTRIBUTE"
    | "MISSING_ATTRIBUTE"
    | "PRESERVE_MISMATCH"
    | "ALTER_MISMATCH"
    | "INEFFECTIVE_ALTERATION"
    | "MIRROR_AXIS_REQUIRED"
    | "UNUSED_MIRROR_AXIS"
    | "INVALID_MIRROR_PAIR";
  key?: string;
  message: string;
}

const mirrorPairs: Record<string, string> = {
  left: "right",
  right: "left",
  source_side: "opposite_source_side",
  opposite_source_side: "source_side"
};

/**
 * This symbolic mirror implementation supports shoulder-side exchange.
 * Other axes remain reserved labels and fail closed for mirror operations.
 * It does not claim to perform geometric image transformations.
 */
function validMirror(
  axis: Correspondence["mirror_axis"],
  from: Json,
  to: Json
): boolean {
  return (
    axis === "character_sagittal" &&
    typeof from === "string" &&
    Object.hasOwn(mirrorPairs, from) &&
    mirrorPairs[from] === to
  );
}

/**
 * Precondition: structurally validate correspondence and projections first.
 * Run the scene reference validator separately for scene-wide ID integrity.
 */
export function validateCorrespondence(
  rule: Correspondence,
  source: EntityProjection,
  target: EntityProjection
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  function emit(
    code: Diagnostic["code"],
    message: string,
    key?: string
  ): void {
    diagnostics.push(
      key === undefined ? { code, message } : { code, message, key }
    );
  }

  if (rule.scope !== "listed_attributes") {
    emit("UNSUPPORTED_SCOPE", "Only listed-attribute scope is supported.");
    return diagnostics;
  }

  if (rule.subject !== source.id || rule.object !== target.id) {
    emit("ENTITY_MISMATCH", "Projection IDs do not match rule endpoints.");
    return diagnostics;
  }

  const owners = new Map<string, string>();

  for (const [group, keys] of [
    ["preserve", rule.preserve],
    ["alter", rule.alter.map(item => item.key)],
    ["exceptions", rule.exceptions]
  ] as const) {
    for (const key of keys) {
      if (owners.has(key)) {
        emit(
          "RULE_CONFLICT",
          `Attribute appears in multiple rules or repeats within ${group}.`,
          key
        );
      } else {
        owners.set(key, group);
      }
    }
  }

  if (diagnostics.length > 0) return diagnostics;

  const allKeys = new Set([
    ...Object.keys(source.attributes),
    ...Object.keys(target.attributes)
  ]);

  for (const key of allKeys) {
    if (!owners.has(key)) {
      emit(
        "UNCLASSIFIED_ATTRIBUTE",
        "Attribute is not preserved, altered, or explicitly excepted.",
        key
      );
    }
  }

  function present(key: string): boolean {
    const found =
      Object.hasOwn(source.attributes, key) &&
      Object.hasOwn(target.attributes, key);

    if (!found) {
      emit(
        "MISSING_ATTRIBUTE",
        "Compared attributes must exist on both projections.",
        key
      );
    }
    return found;
  }

  for (const key of rule.preserve) {
    if (
      present(key) &&
      !isDeepStrictEqual(source.attributes[key], target.attributes[key])
    ) {
      emit("PRESERVE_MISMATCH", "Preserved values differ.", key);
    }
  }

  const mirrors = rule.alter.filter(item => item.operation === "mirror");

  if (mirrors.length > 0 && rule.mirror_axis === undefined) {
    emit("MIRROR_AXIS_REQUIRED", "Mirror operations require a local axis.");
  }

  if (mirrors.length === 0 && rule.mirror_axis !== undefined) {
    emit("UNUSED_MIRROR_AXIS", "Axis supplied without a mirror operation.");
  }

  for (const alteration of rule.alter) {
    const { key, operation, from, to } = alteration;

    if (isDeepStrictEqual(from, to)) {
      emit(
        "INEFFECTIVE_ALTERATION",
        "An alteration must declare different source and target values.",
        key
      );
    }

    if (
      present(key) &&
      (
        !isDeepStrictEqual(source.attributes[key], from) ||
        !isDeepStrictEqual(target.attributes[key], to)
      )
    ) {
      emit("ALTER_MISMATCH", "Actual values differ from declared change.", key);
    }

    if (
      operation === "mirror" &&
      rule.mirror_axis !== undefined &&
      !validMirror(rule.mirror_axis, from, to)
    ) {
      emit(
        "INVALID_MIRROR_PAIR",
        "No supported symbolic mirror mapping matches this change.",
        key
      );
    }
  }

  return diagnostics;
}

/**
 * Refuse to turn absent or deliberately withheld information into a value.
 * Callers must explicitly handle unresolved states before storytelling.
 */
export function requireKnown<T extends Exclude<Json, null>>(
  field: Ambiguity<T>
): T {
  if (field.state !== "known") {
    throw new Error(`Field is ${field.state}: ${field.reason}`);
  }
  return field.value;
}

export const villageRule: Correspondence = {
  id: "village_correspondence",
  subject: "near_village",
  object: "far_village",
  scope: "listed_attributes",
  preserve: ["architecture_signature"],
  alter: [
    {
      key: "lateral_alignment",
      operation: "replace",
      from: "near_bank_reference",
      to: "sideways_displaced"
    },
    {
      key: "physical_order",
      operation: "replace",
      from: "living_world",
      to: "selectively_anomalous"
    }
  ],
  exceptions: [],
  basis: "explicit_description"
};

export const characterRule: Correspondence = {
  id: "character_correspondence",
  subject: "widow",
  object: "counterpart",
  scope: "listed_attributes",
  preserve: ["coat_identity", "head_inclination"],
  alter: [
    {
      key: "shoulder_repair",
      operation: "mirror",
      from: "source_side",
      to: "opposite_source_side"
    },
    {
      key: "lantern_state",
      operation: "replace",
      from: "lit",
      to: "unlit"
    },
    {
      key: "held_object",
      operation: "replace",
      from: "house_key",
      to: "open_lock"
    }
  ],
  mirror_axis: "character_sagittal",
  exceptions: [],
  basis: "explicit_description"
};

export const villageProjections: [EntityProjection, EntityProjection] = [
  {
    id: "near_village",
    attributes: {
      architecture_signature: [
        "bell_tower", "mill", "steep_gabled_houses"
      ],
      lateral_alignment: "near_bank_reference",
      physical_order: "living_world"
    }
  },
  {
    id: "far_village",
    attributes: {
      architecture_signature: [
        "bell_tower", "mill", "steep_gabled_houses"
      ],
      lateral_alignment: "sideways_displaced",
      physical_order: "selectively_anomalous"
    }
  }
];

export const characterProjections: [EntityProjection, EntityProjection] = [
  {
    id: "widow",
    attributes: {
      coat_identity: "shared_coat_motif",
      head_inclination: "shared_unspecified_angle",
      shoulder_repair: "source_side",
      lantern_state: "lit",
      held_object: "house_key"
    }
  },
  {
    id: "counterpart",
    attributes: {
      coat_identity: "shared_coat_motif",
      head_inclination: "shared_unspecified_angle",
      shoulder_repair: "opposite_source_side",
      lantern_state: "unlit",
      held_object: "open_lock"
    }
  }
];

/**
 * Migration annotations, not facts about hidden events.
 * unknown preserves non-specification.
 * intentionally_open is explicitly a proposed authoring policy.
 */
export const ambiguityMigration = [
  {
    target: "/relationships/village_correspondence/qualifiers/displacement_amount",
    previous: null,
    replacement: {
      state: "unknown",
      reason: "The description supplies no numerical displacement.",
      basis: "explicit_description"
    },
    decision: "preserve_non_specification"
  },
  {
    target: "/relationships/reflection_divergence/qualifiers/elapsed_time_seconds",
    previous: null,
    replacement: {
      state: "unknown",
      reason:
        "No duration is supplied; the reflection's behavior does not establish a measurable time lead.",
      basis: "explicit_description"
    },
    decision: "preserve_non_specification"
  },
  {
    target: "/provenance/ambiguities/clay_house_custom_purpose",
    replacement: {
      state: "intentionally_open",
      reason:
        "Proposed storytelling policy: preserve the custom's unexplained purpose.",
      basis: "implementation_choice"
    },
    decision: "proposal_requires_author_approval"
  },
  {
    target: "/provenance/ambiguities/whether_the_widow_crosses",
    replacement: {
      state: "intentionally_open",
      reason:
        "Proposed storytelling policy: leave the crossing unresolved unless explicitly authorized.",
      basis: "implementation_choice"
    },
    decision: "proposal_requires_author_approval"
  },
  {
    target: "/correspondences/village_correspondence/mirror_axis",
    replacement: {
      state: "not_applicable",
      reason: "This correspondence uses replacements, not mirror operations.",
      basis: "implementation_choice"
    },
    decision: "comparison_metadata_only"
  }
] as const;

async function selfTest(): Promise<void> {
  const schemaPath = path.resolve(
    process.cwd(), "schemas/correspondence.schema.json"
  );
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));

  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  const structural = ajv.compile<Correspondence>(schema);

  for (const [rule, projections] of [
    [villageRule, villageProjections],
    [characterRule, characterProjections]
  ] as const) {
    assert(
      structural(rule),
      ajv.errorsText(structural.errors)
    );
    assert.deepEqual(
      validateCorrespondence(rule, projections[0], projections[1]),
      []
    );
  }

  // Whole-scene mirroring is invalid at the contract boundary.
  assert.equal(
    structural({ ...characterRule, scope: "whole_scene" }),
    false
  );

  // A naive spatial mirror does not extinguish a lantern or turn a key
  // into an open lock. Leave those source values unchanged to simulate
  // that incorrect transformation and verify rejection.
  const naiveTarget = structuredClone(characterProjections[1]);
  naiveTarget.attributes.lantern_state = "lit";
  naiveTarget.attributes.held_object = "house_key";

  const naiveErrors = validateCorrespondence(
    characterRule, characterProjections[0], naiveTarget
  );
  assert.deepEqual(
    naiveErrors.map(error => [error.code, error.key]),
    [
      ["ALTER_MISMATCH", "lantern_state"],
      ["ALTER_MISMATCH", "held_object"]
    ]
  );

  const changedAngle = structuredClone(characterProjections[1]);
  changedAngle.attributes.head_inclination = "different_angle";

  assert(
    validateCorrespondence(
      characterRule, characterProjections[0], changedAngle
    ).some(error => error.code === "PRESERVE_MISMATCH")
  );

  const conflict = structuredClone(characterRule);
  conflict.exceptions.push("head_inclination");
  assert(
    validateCorrespondence(
      conflict, characterProjections[0], characterProjections[1]
    ).some(error => error.code === "RULE_CONFLICT")
  );

  // Resolve the local $defs reference against the schema's own document.
  const ambiguityAjv = new Ajv2020({ strict: true, allErrors: true });
  ambiguityAjv.addSchema(schema, "grimlore-correspondence");
  const ambiguityCheck = ambiguityAjv.compile({
    $ref: "grimlore-correspondence#/$defs/ambiguity"
  });

  for (const entry of ambiguityMigration) {
    assert(
      ambiguityCheck(entry.replacement),
      ambiguityAjv.errorsText(ambiguityCheck.errors)
    );
    assert.equal(
      Object.hasOwn(entry.replacement, "value"),
      false,
      "Unresolved migration must not introduce a factual value"
    );
  }

  assert.equal(
    ambiguityCheck({
      state: "intentionally_open",
      reason: "Keep the ending open.",
      basis: "implementation_choice",
      value: "She crossed."
    }),
    false
  );

  assert.equal(
    ambiguityCheck({
      state: "known",
      value: null,
      basis: "explicit_description"
    }),
    false
  );

  assert.equal(
    requireKnown({
      state: "known",
      value: "house_key",
      basis: "explicit_description"
    }),
    "house_key"
  );

  assert.throws(() => requireKnown({
    state: "intentionally_open",
    reason: "Do not resolve the crossing.",
    basis: "implementation_choice"
  }));

  console.log(JSON.stringify({
    attribution:
      "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7",
    status: "passed",
    checks: [
      "village correspondence",
      "character correspondence",
      "whole-scene scope rejected",
      "naive mirror rejected",
      "preserved angle enforced",
      "exception conflict rejected",
      "ambiguity migration structurally valid",
      "unresolved states cannot carry values",
      "null is not a known answer",
      "requireKnown refuses unresolved states"
    ]
  }, null, 2));
}

const invoked = process.argv[1];
if (
  invoked &&
  import.meta.url === pathToFileURL(path.resolve(invoked)).href
) {
  selfTest().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
