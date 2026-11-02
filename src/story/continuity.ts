import Ajv2020 from "ajv/dist/2020.js";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

interface Predicate {
  id: string;
  value_type: "string" | "number" | "boolean";
  cardinality: "single" | "multiple";
}

interface Assertion {
  id: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  world: string;
  epistemic: "canon" | "belief" | "rumor" | "interpretation";
  holder?: string;
  start: number;
  end: number;
  source_scene: string;
}

interface Continuity {
  schema_version: "1.0.0";
  story_id: string;
  branch_id: string;
  entities: Array<{ id: string; kind: string; label: string }>;
  scenes: string[];
  predicates: Predicate[];
  assertions: Assertion[];
}

export interface ContinuityDiagnostic {
  code:
    | "STRUCTURE"
    | "DUPLICATE_ID"
    | "DANGLING_REFERENCE"
    | "VALUE_TYPE"
    | "INVALID_INTERVAL"
    | "CONFLICT";
  path: string;
  message: string;
  assertionIds?: string[];
}

export function createContinuityValidator(schema: object) {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  const structure = ajv.compile<Continuity>(schema);

  return function validate(input: unknown): ContinuityDiagnostic[] {
    if (!structure(input)) {
      return (structure.errors ?? []).map(error => ({
        code: "STRUCTURE",
        path: error.instancePath,
        message: `${error.keyword}: ${error.message ?? "invalid"}`
      }));
    }

    const diagnostics: ContinuityDiagnostic[] = [];
    const entities = new Set<string>();
    const predicates = new Map<string, Predicate>();
    const ambiguousPredicates = new Set<string>();
    const assertionIds = new Set<string>();
    const scenes = new Set(input.scenes);

    input.entities.forEach((entity, i) => {
      if (entities.has(entity.id)) {
        diagnostics.push({
          code: "DUPLICATE_ID",
          path: `/entities/${i}/id`,
          message: `Duplicate entity: ${entity.id}`
        });
      }
      entities.add(entity.id);
    });

    input.predicates.forEach((predicate, i) => {
      if (predicates.has(predicate.id)) {
        ambiguousPredicates.add(predicate.id);
        diagnostics.push({
          code: "DUPLICATE_ID",
          path: `/predicates/${i}/id`,
          message: `Duplicate predicate: ${predicate.id}`
        });
      } else {
        predicates.set(predicate.id, predicate);
      }
    });

    const eligible: Array<{ assertion: Assertion; index: number }> = [];

    input.assertions.forEach((assertion, i) => {
      const pointer = `/assertions/${i}`;
      let usable = true;

      if (assertionIds.has(assertion.id)) {
        diagnostics.push({
          code: "DUPLICATE_ID",
          path: pointer + "/id",
          message: `Duplicate assertion: ${assertion.id}`
        });
      }
      assertionIds.add(assertion.id);

      for (const [key, valid] of [
        ["subject", entities.has(assertion.subject)],
        ["source_scene", scenes.has(assertion.source_scene)],
        [
          "holder",
          assertion.holder === undefined ||
            entities.has(assertion.holder)
        ],
        ["predicate", predicates.has(assertion.predicate)]
      ] as const) {
        if (!valid) {
          usable = false;
          diagnostics.push({
            code: "DANGLING_REFERENCE",
            path: `${pointer}/${key}`,
            message: `Unresolved ${key} reference`
          });
        }
      }

      const predicate = predicates.get(assertion.predicate);

      if (
        predicate &&
        typeof assertion.value !== predicate.value_type
      ) {
        usable = false;
        diagnostics.push({
          code: "VALUE_TYPE",
          path: pointer + "/value",
          message: `Expected ${predicate.value_type}`
        });
      }

      if (assertion.end <= assertion.start) {
        usable = false;
        diagnostics.push({
          code: "INVALID_INTERVAL",
          path: pointer,
          message: "Require start < end for a half-open interval"
        });
      }

      if (
        usable &&
        !ambiguousPredicates.has(assertion.predicate) &&
        predicate?.cardinality === "single" &&
        assertion.epistemic === "canon"
      ) {
        eligible.push({ assertion, index: i });
      }
    });

    // Pairwise implementation for a deliberately small initial format.
    // A supervised admission layer must cap assertion count in deployment.
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const a = eligible[i]!.assertion;
        const b = eligible[j]!.assertion;

        const sameFact =
          a.world === b.world &&
          a.subject === b.subject &&
          a.predicate === b.predicate;

        const overlaps =
          Math.max(a.start, b.start) < Math.min(a.end, b.end);

        if (sameFact && overlaps && a.value !== b.value) {
          diagnostics.push({
            code: "CONFLICT",
            path: `/assertions/${eligible[j]!.index}`,
            message: "Overlapping canonical single-valued assertions differ",
            assertionIds: [a.id, b.id]
          });
        }
      }
    }

    return diagnostics;
  };
}
