/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

type Obj = Record<string, unknown>;

export interface RenameRecord {
  operation: "rename_entity";
  from: string;
  to: string;
  changedPaths: string[];
  /**
   * Exact parsed pre-migration value.
   * This preserves JSON data, not original file whitespace or byte encoding.
   */
  original: unknown;
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

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new TypeError("Expected array");
  return value;
}

/**
 * Precondition: input has passed the applicable scene schema.
 * Postcondition: run structural, reference, and evidence validation again.
 *
 * This migration covers:
 * - entity IDs
 * - composition references
 * - relationship endpoints
 * - legacy entity-only supports
 * - v2 qualified entity supports
 *
 * Additional reference-bearing sidecars require their own migration.
 */
export function renameEntity(
  input: unknown,
  from: string,
  to: string
): { scene: Obj; record: RenameRecord } {
  if (!from || !to || from === to) {
    throw new TypeError("Distinct nonempty IDs required");
  }

  const scene = object(structuredClone(input));
  const entities = array(scene.entities).map(object);
  const matches = entities.filter(entity => entity.id === from);

  if (matches.length !== 1) {
    throw new Error("Source ID must resolve exactly once");
  }

  if (entities.some(entity => entity.id === to)) {
    throw new Error("Destination ID already exists");
  }

  const version = scene.schema_version;
  if (version !== undefined && version !== "2.0.0") {
    throw new Error("Unsupported scene version");
  }

  const changedPaths: string[] = [];

  function field(container: Obj, key: string, pointer: string): void {
    if (container[key] === from) {
      container[key] = to;
      changedPaths.push(pointer);
    }
  }

  function ids(values: unknown, pointer: string): void {
    array(values).forEach((value, index, valuesArray) => {
      if (value === from) {
        valuesArray[index] = to;
        changedPaths.push(`${pointer}/${index}`);
      }
    });
  }

  const sourceIndex = entities.findIndex(entity => entity.id === from);
  field(entities[sourceIndex]!, "id", `/entities/${sourceIndex}/id`);

  const composition = object(scene.composition);
  field(
    composition,
    "principal_subject",
    "/composition/principal_subject"
  );
  field(composition, "focal_target", "/composition/focal_target");
  ids(composition.eye_path, "/composition/eye_path");

  const layers = object(composition.depth_layers);
  for (const layer of ["foreground", "middle_ground", "background"]) {
    ids(layers[layer], `/composition/depth_layers/${layer}`);
  }

  array(scene.relationships).map(object).forEach((relationship, i) => {
    field(relationship, "subject", `/relationships/${i}/subject`);
    field(relationship, "object", `/relationships/${i}/object`);
  });

  for (const group of ["entities", "relationships", "constraints"]) {
    array(scene[group]).map(object).forEach((item, index) => {
      if (item.supports === undefined) return;

      array(item.supports).forEach((reference, supportIndex, values) => {
        const previous = version === "2.0.0" ? `entity:${from}` : from;
        const replacement = version === "2.0.0" ? `entity:${to}` : to;

        if (reference === previous) {
          values[supportIndex] = replacement;
          changedPaths.push(
            `/${group}/${index}/supports/${supportIndex}`
          );
        }
      });
    });
  }

  return {
    scene,
    record: {
      operation: "rename_entity",
      from,
      to,
      changedPaths,
      original: structuredClone(input)
    }
  };
}

export function restoreRename(record: RenameRecord): unknown {
  return structuredClone(record.original);
}
