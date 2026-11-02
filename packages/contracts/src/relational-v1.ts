/** SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution. */
import { Type, type TSchema, type TProperties } from "@sinclair/typebox";

// Historical v1 reconstruction. Do not overwrite an already migrated v2 schema.
const closed = (properties: TProperties) => Type.Object(properties, { additionalProperties: false });
const open = () => Type.Object({}, { additionalProperties: true });
const ref = (name: string) => Type.Ref("#/$defs/" + name);
const enumeration = (values: string[]) => Type.String({ enum: values });

export const RelationalV1 = closed({
  id: Type.String(),
  provenance: closed({
    basis: Type.Literal("user_supplied_description"),
    invented_lore: Type.Boolean(),
    unspecified: Type.Optional(Type.Array(Type.String()))
  }),
  composition: closed({
    principal_subject: Type.String(), focal_target: Type.String(),
    eye_path: Type.Array(Type.String()),
    depth_layers: closed({ foreground: ref("idList"), middle_ground: ref("idList"), background: ref("idList") }),
    negative_space: Type.String()
  }),
  entities: Type.Array(ref("entity")),
  relationships: Type.Array(ref("relationship")),
  appearance: closed({
    medium: Type.String(), palette: open(), lights: Type.Array(open()), surface_treatments: Type.Array(open())
  }),
  constraints: Type.Array(closed({ id: Type.String(), statement: Type.String(), basis: ref("basis") }))
});

export function exportRelationalV1(): object {
  return JSON.parse(JSON.stringify({
    ...RelationalV1,
    $schema: "https://json-schema.org/draft/2020-12/schema",
    title: "Grimlore Relational Artwork",
    $defs: {
      idList: Type.Array(Type.String()),
      basis: enumeration(["explicit_description", "derived_interpretation", "implementation_choice"]),
      entity: closed({
        id: Type.String(), kind: Type.String(),
        realm: enumeration(["living", "parallel", "river", "boundary", "unspecified"]),
        placement: Type.String(), attributes: open(), basis: ref("basis")
      }),
      relationship: closed({
        id: Type.String(), subject: Type.String(), predicate: Type.String(), object: Type.String(),
        qualifiers: open(), basis: ref("basis")
      })
    }
  }));
}

/** Normalization for this restricted schema subset, not general schema equivalence. */
export function normalizeSnapshot(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeSnapshot);
  if (value === null || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(input).sort()) {
    const item = input[key];
    if (key === "additionalProperties" && item === true) continue;
    if (key === "properties" && item && Object.keys(item as object).length === 0) continue;
    if (key === "required" && Array.isArray(item) && item.length === 0) continue;
    if (key === "type" && item === "string" && (
      typeof input.const === "string" ||
      (Array.isArray(input.enum) && input.enum.length > 0 && input.enum.every(v => typeof v === "string"))
    )) continue;
    output[key] = (key === "required" || key === "enum") && Array.isArray(item)
      ? [...item].sort() : normalizeSnapshot(item);
  }
  return output;
}
