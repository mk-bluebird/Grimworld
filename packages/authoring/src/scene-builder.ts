/** SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution. */
import type { Scene } from "../../../types/scene.generated.ts";
import { authoringAccepted, type ValidationReport } from "../../../src/diagnostics/catalog.ts";

type Entity = Scene["entities"][number];
type Relationship = Scene["relationships"][number];
type Constraint = Scene["constraints"][number];
export type SceneBase = Omit<Scene, "entities" | "relationships" | "constraints">;
declare const entityBrand: unique symbol;
export type EntityHandle = Readonly<{ readonly [entityBrand]: true }>;
export type SceneValidator = (input: unknown) => ValidationReport;

export class AuthoringError extends Error {
  constructor(public readonly code: "DUPLICATE_ID" | "FOREIGN_HANDLE" | "INVALID_ID", message: string) {
    super(message); this.name = "AuthoringError";
  }
}

/** Authoring aid, not a publication permit or untrusted-input validator. */
export function createSceneBuilder(base: SceneBase, validate: SceneValidator) {
  const snapshot = structuredClone(base);
  const entities: Entity[] = [];
  const relationships: Relationship[] = [];
  const constraints: Constraint[] = [];
  const handles = new WeakMap<object, string>();
  const entityIds = new Set<string>();
  const relationshipIds = new Set<string>();
  const constraintIds = new Set<string>();

  function reserve(id: string, namespace: Set<string>): void {
    if (typeof id !== "string" || id.length === 0) throw new AuthoringError("INVALID_ID", "Nonempty ID required");
    if (namespace.has(id)) throw new AuthoringError("DUPLICATE_ID", `Duplicate ID: ${id}`);
  }
  function resolve(handle: EntityHandle): string {
    if (handle === null || typeof handle !== "object" || !handles.has(handle)) {
      throw new AuthoringError("FOREIGN_HANDLE", "Entity handle was not issued by this builder");
    }
    return handles.get(handle)!;
  }
  function entity(id: string, data: Omit<Entity, "id">): EntityHandle {
    reserve(id, entityIds);
    const value = { ...structuredClone(data), id } as Entity;
    const handle = Object.freeze({}) as EntityHandle;
    entities.push(value); entityIds.add(id); handles.set(handle, id);
    return handle;
  }
  function id(handle: EntityHandle): string { return resolve(handle); }
  function relatesTo(id: string, from: EntityHandle, to: EntityHandle,
    data: Omit<Relationship, "id" | "subject" | "object">): void {
    reserve(id, relationshipIds);
    const subject = resolve(from), object = resolve(to);
    const value = { ...structuredClone(data), id, subject, object } as Relationship;
    relationships.push(value); relationshipIds.add(id);
  }
  function constraint(id: string, data: Omit<Constraint, "id">): void {
    reserve(id, constraintIds);
    const value = { ...structuredClone(data), id } as Constraint;
    constraints.push(value); constraintIds.add(id);
  }
  function build():
    | { ok: true; scene: Scene; report: ValidationReport }
    | { ok: false; report: ValidationReport } {
    const candidate = structuredClone({ ...snapshot, entities, relationships, constraints }) as Scene;
    // Validate a separate copy: validator mutation cannot rewrite the snapshot returned.
    const report = validate(structuredClone(candidate));
    if (!authoringAccepted(report)) return { ok: false, report };
    return { ok: true, scene: candidate, report };
  }
  return Object.freeze({ entity, id, relatesTo, constraint, build });
}
