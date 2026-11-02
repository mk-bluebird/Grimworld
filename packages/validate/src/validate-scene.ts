import Ajv2020 from "ajv/dist/2020.js";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

type Obj = Record<string, unknown>;

type Namespace = "entity" | "relationship" | "constraint";

export interface Diagnostic {
  phase: "structure" | "references" | "supports";
  code:
    | "STRUCTURAL_INVALID"
    | "DUPLICATE_ID"
    | "DANGLING_ENTITY"
    | "SUPPORT_MISSING"
    | "SUPPORT_AMBIGUOUS"
    | "SELF_SUPPORT"
    | "SUPPORT_CYCLE";
  path: string;
  message: string;
}

export class SceneValidationError extends Error {
  readonly code = "VALIDATOR_OPERATION_FAILED";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SceneValidationError";
  }
}

declare const validatedBrand: unique symbol;

export type ValidatedScene = Readonly<{
  readonly [validatedBrand]: true;
}>;

export type ValidationResult =
  | { ok: true; scene: ValidatedScene; diagnostics: [] }
  | { ok: false; diagnostics: Diagnostic[] };

export interface SceneValidator {
  readonly schema: Readonly<Obj>;
  validate(input: unknown): ValidationResult;
  read(scene: ValidatedScene): Readonly<Obj>;
}

function object(value: unknown): Obj {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError("Expected object");
  }
  return value as Obj;
}

function objects(value: unknown): Obj[] {
  if (!Array.isArray(value)) throw new TypeError("Expected array");
  return value.map(object);
}

/**
 * Intended for JSON-compatible documents.
 * Caller-owned objects never become the validated runtime snapshot.
 */
function snapshot(value: unknown): unknown {
  return structuredClone(value);
}

function deepFreeze<T>(value: T): T {
  const pending: object[] = [];
  const seen = new WeakSet<object>();

  if (value !== null && typeof value === "object") {
    pending.push(value as object);
  }

  while (pending.length > 0) {
    const current = pending.pop()!;
    if (seen.has(current)) continue;
    seen.add(current);

    for (const child of Object.values(current)) {
      if (child !== null && typeof child === "object") {
        pending.push(child);
      }
    }

    Object.freeze(current);
  }

  return value;
}

/**
 * Build v2 from the original supplied contract.
 * Keep this generated schema available as a build artifact for typegen.
 */
export function buildSceneSchemaV2(original: unknown): Obj {
  try {
    const schema = object(snapshot(original));

    if (
      schema.$schema !==
      "https://json-schema.org/draft/2020-12/schema"
    ) {
      throw new Error("Expected the original draft 2020-12 schema");
    }

    const rootProperties = object(schema.properties);
    if (Object.hasOwn(rootProperties, "schema_version")) {
      throw new Error("Expected an unversioned original contract");
    }

    const defs = object(schema.$defs);
    const constraintItems = object(
      object(rootProperties.constraints).items
    );

    const supportDefinition = {
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        pattern: "^(entity|relationship|constraint):.+$"
      }
    };

    for (const node of [
      object(defs.entity),
      object(defs.relationship),
      constraintItems
    ]) {
      const properties = object(node.properties);

      if (Object.hasOwn(properties, "supports")) {
        throw new Error("Original contract must not already define supports");
      }

      properties.supports = structuredClone(supportDefinition);

      const previous = node.allOf;
      if (previous !== undefined && !Array.isArray(previous)) {
        throw new Error("Invalid allOf in source schema");
      }

      node.allOf = [
        ...(previous ?? []),
        {
          if: {
            properties: {
              basis: { const: "derived_interpretation" }
            },
            required: ["basis"]
          },
          then: {
            required: ["supports"],
            properties: {
              supports: { minItems: 1 }
            }
          }
        }
      ];
    }

    rootProperties.schema_version = { const: "2.0.0" };

    if (!Array.isArray(schema.required)) {
      throw new Error("Missing root required list");
    }

    schema.required = [...schema.required, "schema_version"];
    schema.title = "GrimloreRelationalArtworkV2";

    return schema;
  } catch (cause) {
    throw new SceneValidationError(
      "Cannot construct the v2 scene schema",
      { cause }
    );
  }
}

interface NodeRecord {
  key: string;
  path: string;
  value: Obj;
}

/**
 * Iterative SCC decomposition.
 * Returns one component for each cyclic dependency group.
 */
function cyclicComponents(
  graph: Map<string, Set<string>>
): string[][] {
  const reverse = new Map<string, Set<string>>();
  for (const key of graph.keys()) reverse.set(key, new Set());

  for (const [from, targets] of graph) {
    for (const to of targets) reverse.get(to)!.add(from);
  }

  const visited = new Set<string>();
  const finish: string[] = [];

  for (const start of graph.keys()) {
    if (visited.has(start)) continue;
    const stack: Array<[string, boolean]> = [[start, false]];

    while (stack.length > 0) {
      const [key, exiting] = stack.pop()!;

      if (exiting) {
        finish.push(key);
        continue;
      }

      if (visited.has(key)) continue;
      visited.add(key);
      stack.push([key, true]);

      for (const next of graph.get(key)!) {
        if (!visited.has(next)) stack.push([next, false]);
      }
    }
  }

  const assigned = new Set<string>();
  const result: string[][] = [];

  for (const start of finish.reverse()) {
    if (assigned.has(start)) continue;

    const component: string[] = [];
    const stack = [start];
    assigned.add(start);

    while (stack.length > 0) {
      const key = stack.pop()!;
      component.push(key);

      for (const next of reverse.get(key)!) {
        if (assigned.has(next)) continue;
        assigned.add(next);
        stack.push(next);
      }
    }

    if (
      component.length > 1 ||
      graph.get(start)!.has(start)
    ) {
      result.push(component.sort());
    }
  }

  return result;
}

function semanticDiagnostics(scene: Obj): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const nodes: NodeRecord[] = [];

  for (const [namespace, property] of [
    ["entity", "entities"],
    ["relationship", "relationships"],
    ["constraint", "constraints"]
  ] as const satisfies ReadonlyArray<readonly [Namespace, string]>) {
    objects(scene[property]).forEach((value, index) => {
      nodes.push({
        key: `${namespace}:${String(value.id)}`,
        path: `/${property}/${index}`,
        value
      });
    });
  }

  const index = new Map<string, NodeRecord[]>();
  for (const node of nodes) {
    const records = index.get(node.key) ?? [];
    records.push(node);
    index.set(node.key, records);
  }

  for (const [key, records] of index) {
    if (records.length > 1) {
      diagnostics.push({
        phase: "references",
        code: "DUPLICATE_ID",
        path: records[1]!.path + "/id",
        message: `${key} occurs ${records.length} times.`
      });
    }
  }

  function entityReference(id: unknown, pointer: string): void {
    const matches = index.get(`entity:${String(id)}`);

    if (!matches) {
      diagnostics.push({
        phase: "references",
        code: "DANGLING_ENTITY",
        path: pointer,
        message: `No entity resolves ${JSON.stringify(id)}.`
      });
    }
    // Ambiguous IDs are reported by DUPLICATE_ID, not repeated here.
  }

  const composition = object(scene.composition);
  const layers = object(composition.depth_layers);

  entityReference(
    composition.principal_subject,
    "/composition/principal_subject"
  );
  entityReference(
    composition.focal_target,
    "/composition/focal_target"
  );

  (composition.eye_path as string[]).forEach((id, i) => {
    entityReference(id, `/composition/eye_path/${i}`);
  });

  for (const layer of [
    "foreground", "middle_ground", "background"
  ]) {
    (layers[layer] as string[]).forEach((id, i) => {
      entityReference(id, `/composition/depth_layers/${layer}/${i}`);
    });
  }

  objects(scene.relationships).forEach((relationship, i) => {
    entityReference(
      relationship.subject,
      `/relationships/${i}/subject`
    );
    entityReference(
      relationship.object,
      `/relationships/${i}/object`
    );
  });

  // Only uniquely identified nodes can participate unambiguously.
  const graph = new Map<string, Set<string>>();
  for (const [key, records] of index) {
    if (records.length === 1) graph.set(key, new Set());
  }

  for (const node of nodes) {
    const supports = (node.value.supports ?? []) as string[];

    supports.forEach((reference, i) => {
      const pointer = `${node.path}/supports/${i}`;
      const targets = index.get(reference);

      if (reference === node.key) {
        diagnostics.push({
          phase: "supports",
          code: "SELF_SUPPORT",
          path: pointer,
          message: `${node.key} cannot cite itself.`
        });
      } else if (!targets) {
        diagnostics.push({
          phase: "supports",
          code: "SUPPORT_MISSING",
          path: pointer,
          message: `No node resolves ${reference}.`
        });
      } else if (targets.length !== 1) {
        diagnostics.push({
          phase: "supports",
          code: "SUPPORT_AMBIGUOUS",
          path: pointer,
          message: `${reference} resolves multiple nodes.`
        });
      } else if (graph.has(node.key)) {
        graph.get(node.key)!.add(reference);
      }
    });
  }

  // Self-support already has its own occurrence-level diagnostic.
  for (const component of cyclicComponents(graph)) {
    diagnostics.push({
      phase: "supports",
      code: "SUPPORT_CYCLE",
      path: "/",
      message: `Cyclic support dependency: ${component.join(", ")}.`
    });
  }

  return diagnostics;
}

export function createSceneValidator(
  originalSchema: unknown
): SceneValidator {
  try {
    const schema = buildSceneSchemaV2(originalSchema);

    const ajv = new Ajv2020({
      strict: true,
      allErrors: true,
      coerceTypes: false,
      useDefaults: false,
      removeAdditional: false
    });

    const structural = ajv.compile(schema);
    const issued = new WeakMap<object, Readonly<Obj>>();

    function validate(input: unknown): ValidationResult {
      try {
        const copy = snapshot(input);

        if (!structural(copy)) {
          return {
            ok: false,
            diagnostics: (structural.errors ?? []).map(error => ({
              phase: "structure",
              code: "STRUCTURAL_INVALID",
              path: error.instancePath,
              message:
                `${error.keyword}: ${error.message ?? "invalid"}`
            }))
          };
        }

        const document = object(copy);
        const diagnostics = semanticDiagnostics(document);

        if (diagnostics.length > 0) {
          return { ok: false, diagnostics };
        }

        const token = Object.freeze({}) as ValidatedScene;
        issued.set(token, deepFreeze(document));

        return { ok: true, scene: token, diagnostics: [] };
      } catch (cause) {
        if (cause instanceof SceneValidationError) throw cause;

        throw new SceneValidationError(
          "Scene validation could not complete",
          { cause }
        );
      }
    }

    function read(token: ValidatedScene): Readonly<Obj> {
      try {
        if (
          token === null ||
          typeof token !== "object" ||
          !issued.has(token)
        ) {
          throw new Error("Unissued or foreign validation token");
        }
        return issued.get(token)!;
      } catch (cause) {
        throw new SceneValidationError(
          "Validated scene token rejected",
          { cause }
        );
      }
    }

    return Object.freeze({
      schema: deepFreeze(structuredClone(schema)),
      validate,
      read
    });
  } catch (cause) {
    if (cause instanceof SceneValidationError) throw cause;

    throw new SceneValidationError(
      "Scene validator initialization failed",
      { cause }
    );
  }
}
