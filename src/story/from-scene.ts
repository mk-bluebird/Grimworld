import type { Scene } from "../../types/scene.generated.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export interface NarrativeProjectionProfile {
  id: string;
  revision: string;

  entityIds: readonly string[];

  /**
   * Select complete top-level attribute values.
   * Nested values are copied without reinterpretation.
   */
  attributes: Readonly<Record<string, readonly string[]>>;

  relationshipIds: readonly string[];
  constraintIds: readonly string[];

  protectedAmbiguities: readonly {
    entityId: string;
    topic: string;
    reason: string;
  }[];

  appearanceContext: readonly (
    "medium" | "palette" | "lights" | "surface_treatments"
  )[];
}

function unique(values: readonly string[], label: string): void {
  if (
    values.some(value => typeof value !== "string" || !value) ||
    new Set(values).size !== values.length
  ) {
    throw new TypeError(`${label} must contain unique nonempty values`);
  }
}

function indexed<T extends { id: string }>(
  values: readonly T[],
  label: string
): Map<string, T> {
  unique(values.map(value => value.id), label);
  return new Map(values.map(value => [value.id, value]));
}

/**
 * Precondition: scene passed its applicable structural/semantic pipeline.
 * This is a projection, not a source validator or canonization operation.
 */
export function fromScene(
  scene: Scene,
  profile: NarrativeProjectionProfile
) {
  if (!profile.id || !profile.revision) {
    throw new TypeError("Versioned projection profile required");
  }

  unique(profile.entityIds, "Selected entities");
  unique(profile.relationshipIds, "Selected relationships");
  unique(profile.constraintIds, "Selected constraints");
  unique(profile.appearanceContext, "Appearance context");

  const entities = indexed(scene.entities, "Scene entities");
  const relationships = indexed(scene.relationships, "Scene relationships");
  const constraints = indexed(scene.constraints, "Scene constraints");
  const selectedIds = new Set(profile.entityIds);

  for (const id of Object.keys(profile.attributes)) {
    if (!selectedIds.has(id)) {
      throw new TypeError(`Attribute selection for unselected entity: ${id}`);
    }
  }

  const projectedEntities = profile.entityIds.map(id => {
    const entity = entities.get(id);
    if (!entity) throw new TypeError(`Unknown entity: ${id}`);

    const keys = profile.attributes[id] ?? [];
    unique(keys, `Attributes of ${id}`);

    const attributes: Record<string, unknown> = {};

    for (const key of keys) {
      if (!Object.hasOwn(entity.attributes, key)) {
        throw new TypeError(`Missing selected attribute: ${id}.${key}`);
      }

      Object.defineProperty(attributes, key, {
        value: structuredClone(entity.attributes[key]),
        enumerable: true,
        configurable: true,
        writable: true
      });
    }

    return {
      id: entity.id,
      kind: entity.kind,
      realm: entity.realm,
      basis: entity.basis,
      attributes
    };
  });

  const projectedRelationships = profile.relationshipIds.map(id => {
    const relationship = relationships.get(id);
    if (!relationship) throw new TypeError(`Unknown relationship: ${id}`);

    if (
      !selectedIds.has(relationship.subject) ||
      !selectedIds.has(relationship.object)
    ) {
      throw new TypeError(
        `Selected relationship has an unselected endpoint: ${id}`
      );
    }

    return structuredClone(relationship);
  });

  const projectedConstraints = profile.constraintIds.map(id => {
    const constraint = constraints.get(id);
    if (!constraint) throw new TypeError(`Unknown constraint: ${id}`);
    return structuredClone(constraint);
  });

  const protectedKeys = new Set<string>();

  for (const ambiguity of profile.protectedAmbiguities) {
    const key = JSON.stringify([ambiguity.entityId, ambiguity.topic]);

    if (
      !selectedIds.has(ambiguity.entityId) ||
      !ambiguity.topic ||
      !ambiguity.reason ||
      protectedKeys.has(key)
    ) {
      throw new TypeError("Invalid or duplicate protected ambiguity");
    }

    protectedKeys.add(key);
  }

  const context: Record<string, unknown> = {};
  for (const field of profile.appearanceContext) {
    if (
      !["medium", "palette", "lights", "surface_treatments"].includes(field)
    ) {
      throw new TypeError("Unknown appearance context field");
    }
    context[field] = structuredClone(scene.appearance[field]);
  }

  return {
    profile: {
      id: profile.id,
      revision: profile.revision
    },
    sourceSceneId: scene.id,

    entities: projectedEntities,
    relationships: projectedRelationships,
    constraints: projectedConstraints,

    sourceUnspecified: [...(scene.provenance.unspecified ?? [])],

    protectedAmbiguities: profile.protectedAmbiguities.map(item => ({
      ...item,
      state: "intentionally_open" as const,
      basis: "implementation_choice" as const
    })),

    optionalDescriptiveContext: context,

    authoringPolicy: {
      creativeAdditions: "permitted_with_traceable_additions_records",
      derivedInterpretations: "retain_original_basis",
      plot: "not_prescribed"
    },

    omissions: {
      entityIds: scene.entities
        .filter(entity => !selectedIds.has(entity.id))
        .map(entity => entity.id),

      entityFields: projectedEntities.map(entity => {
        const original = entities.get(entity.id)!;
        const selected = new Set(profile.attributes[entity.id] ?? []);

        return {
          entityId: entity.id,
          omittedAttributes: Object.keys(original.attributes)
            .filter(key => !selected.has(key)),
          omittedStandardFields: ["placement"]
        };
      }),

      relationshipIds: scene.relationships
        .filter(item => !profile.relationshipIds.includes(item.id))
        .map(item => item.id),

      constraintIds: scene.constraints
        .filter(item => !profile.constraintIds.includes(item.id))
        .map(item => item.id),

      composition: "not_projected",

      appearanceFields: [
        "medium", "palette", "lights", "surface_treatments"
      ].filter(field => !profile.appearanceContext.includes(
        field as NarrativeProjectionProfile["appearanceContext"][number]
      ))
    }
  };
}
