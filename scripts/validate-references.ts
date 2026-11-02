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

type Obj = Record<string, unknown>;

export type DiagnosticCode =
  | "DUPLICATE_ID"
  | "DANGLING_ID"
  | "ORPHAN_ENTITY"
  | "CYCLIC_RELATIONSHIP";

export interface Diagnostic {
  code: DiagnosticCode;
  severity: "error" | "warning";
  path: string;
  message: string;
  ids: string[];
}

export interface ReferenceOptions {
  reportOrphans?: boolean;
  reportCycles?: boolean;
  cyclePredicates?: readonly string[];
}

function obj(value: unknown): Obj {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError(
      "Expected structurally validated scene data: object required"
    );
  }
  return value as Obj;
}

function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError(
      "Expected structurally validated scene data: array required"
    );
  }
  return value;
}

function text(value: unknown): string {
  if (typeof value !== "string") {
    throw new TypeError(
      "Expected structurally validated scene data: string required"
    );
  }
  return value;
}

/**
 * Precondition: validate input against the relational JSON Schema first.
 * This function checks graph semantics, not structural validity.
 */
export function validateReferences(
  input: unknown,
  options: ReferenceOptions = {}
): Diagnostic[] {
  const scene = obj(input);
  const entities = list(scene.entities).map(obj);
  const relationships = list(scene.relationships).map(obj);
  const constraints = list(scene.constraints).map(obj);
  const composition = obj(scene.composition);
  const layers = obj(composition.depth_layers);

  const diagnostics: Diagnostic[] = [];
  const entityIds = new Set(entities.map(entity => text(entity.id)));
  const referenced = new Set<string>();

  let hasDuplicateEntities = false;
  let hasDangling = false;

  function duplicates(
    records: Obj[],
    namespace: string
  ): boolean {
    const groups = new Map<string, number[]>();

    records.forEach((record, index) => {
      const id = text(record.id);
      const occurrences = groups.get(id) ?? [];
      occurrences.push(index);
      groups.set(id, occurrences);
    });

    let found = false;
    for (const [id, indices] of groups) {
      if (indices.length < 2) continue;
      found = true;

      diagnostics.push({
        code: "DUPLICATE_ID",
        severity: "error",
        path: `/${namespace}/${indices[1]}/id`,
        message:
          `ID ${JSON.stringify(id)} occurs ${indices.length} times ` +
          `in ${namespace}; indices: ${indices.join(", ")}.`,
        ids: [id]
      });
    }

    return found;
  }

  hasDuplicateEntities = duplicates(entities, "entities");
  duplicates(relationships, "relationships");
  duplicates(constraints, "constraints");

  function reference(value: unknown, pointer: string): void {
    const id = text(value);
    if (!entityIds.has(id)) {
      hasDangling = true;
      diagnostics.push({
        code: "DANGLING_ID",
        severity: "error",
        path: pointer,
        message: `No entity resolves ID ${JSON.stringify(id)}.`,
        ids: [id]
      });
      return;
    }
    referenced.add(id);
  }

  reference(
    composition.principal_subject,
    "/composition/principal_subject"
  );
  reference(composition.focal_target, "/composition/focal_target");

  list(composition.eye_path).forEach((id, index) => {
    reference(id, `/composition/eye_path/${index}`);
  });

  for (const layer of ["foreground", "middle_ground", "background"]) {
    list(layers[layer]).forEach((id, index) => {
      reference(id, `/composition/depth_layers/${layer}/${index}`);
    });
  }

  relationships.forEach((relationship, index) => {
    reference(relationship.subject, `/relationships/${index}/subject`);
    reference(relationship.object, `/relationships/${index}/object`);
  });

  // Avoid secondary authoring warnings while entity resolution is broken.
  if (hasDuplicateEntities || hasDangling) return diagnostics;

  if (options.reportOrphans) {
    entities.forEach((entity, index) => {
      const id = text(entity.id);
      if (referenced.has(id)) return;

      diagnostics.push({
        code: "ORPHAN_ENTITY",
        severity: "warning",
        path: `/entities/${index}`,
        message:
          `Entity ${JSON.stringify(id)} is not referenced by ` +
          "composition or relationship endpoints.",
        ids: [id]
      });
    });
  }

  if (options.reportCycles) {
    const allowed = options.cyclePredicates === undefined
      ? undefined
      : new Set(options.cyclePredicates);

    const graph = new Map<string, Set<string>>();
    const reverse = new Map<string, Set<string>>();

    for (const id of entityIds) {
      graph.set(id, new Set());
      reverse.set(id, new Set());
    }

    for (const relationship of relationships) {
      if (allowed && !allowed.has(text(relationship.predicate))) continue;

      const from = text(relationship.subject);
      const to = text(relationship.object);
      graph.get(from)!.add(to);
      reverse.get(to)!.add(from);
    }

    // Iterative Kosaraju: no recursive call-stack dependency.
    const visited = new Set<string>();
    const finish: string[] = [];

    for (const start of entityIds) {
      if (visited.has(start)) continue;

      const stack: Array<[string, boolean]> = [[start, false]];

      while (stack.length > 0) {
        const [id, exiting] = stack.pop()!;

        if (exiting) {
          finish.push(id);
          continue;
        }
        if (visited.has(id)) continue;

        visited.add(id);
        stack.push([id, true]);

        for (const target of graph.get(id)!) {
          if (!visited.has(target)) stack.push([target, false]);
        }
      }
    }

    const assigned = new Set<string>();

    for (const start of finish.reverse()) {
      if (assigned.has(start)) continue;

      const component: string[] = [];
      const stack = [start];
      assigned.add(start);

      while (stack.length > 0) {
        const id = stack.pop()!;
        component.push(id);

        for (const target of reverse.get(id)!) {
          if (assigned.has(target)) continue;
          assigned.add(target);
          stack.push(target);
        }
      }

      const cyclic =
        component.length > 1 || graph.get(start)!.has(start);

      if (!cyclic) continue;

      component.sort();
      diagnostics.push({
        code: "CYCLIC_RELATIONSHIP",
        severity: "warning",
        path: "/relationships",
        message:
          `Cyclic relationship component: ${component.join(", ")}.`,
        ids: component
      });
    }
  }

  return diagnostics;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flags = new Set(
    ["--orphans", "--cycles", "--warnings-as-errors"]
  );

  for (const arg of args) {
    if (arg.startsWith("--") && !flags.has(arg)) {
      throw new Error(`Unknown flag: ${arg}`);
    }
  }

  const positional = args.filter(arg => !arg.startsWith("--"));
  if (positional.length > 1) {
    throw new Error(
      "Usage: validate-references.ts [scene.json] " +
      "[--orphans] [--cycles] [--warnings-as-errors]"
    );
  }

  const root = process.cwd();
  const schemaPath = path.join(
    root, "schemas/grimlore-relational-artwork.schema.json"
  );
  const scenePath = path.resolve(
    root,
    positional[0] ??
      "artworks/river-village-invitation/" +
      "river-village-invitation.scene.json"
  );

  const schema = obj(
    JSON.parse(await readFile(schemaPath, "utf8")) as unknown
  );
  const scene: unknown =
    JSON.parse(await readFile(scenePath, "utf8"));

  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  const validate = ajv.compile(schema);

  if (!validate(scene)) {
    console.error(JSON.stringify({
      phase: "structure",
      errors: validate.errors
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const diagnostics = validateReferences(scene, {
    reportOrphans: args.includes("--orphans"),
    reportCycles: args.includes("--cycles")
  });

  console.log(JSON.stringify({
    attribution:
      "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7",
    phase: "references",
    diagnostics
  }, null, 2));

  const failed = diagnostics.some(
    diagnostic =>
      diagnostic.severity === "error" ||
      args.includes("--warnings-as-errors")
  );

  process.exitCode = failed ? 1 : 0;
}

const invokedFile = process.argv[1];
if (
  invokedFile &&
  import.meta.url === pathToFileURL(path.resolve(invokedFile)).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
