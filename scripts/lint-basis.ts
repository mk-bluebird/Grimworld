import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

type Obj = Record<string, unknown>;

export interface BasisDiagnostic {
  code:
    | "BASIS_INVALID"
    | "SUPPORTS_REQUIRED"
    | "SUPPORTS_INVALID"
    | "SUPPORT_DANGLING"
    | "SUPPORT_SELF"
    | "ENTITY_ID_AMBIGUOUS";
  path: string;
  message: string;
}

const BASES = new Set([
  "explicit_description",
  "derived_interpretation",
  "implementation_choice"
]);

function object(value: unknown): Obj {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError("Expected an object");
  }
  return value as Obj;
}

function records(value: unknown): Obj[] {
  if (!Array.isArray(value)) throw new TypeError("Expected an array");
  return value.map(object);
}

/**
 * Run structural validation first.
 * supports always references entity IDs, regardless of the owning group.
 */
export function lintBasis(input: unknown): BasisDiagnostic[] {
  const scene = object(input);
  const entities = records(scene.entities);
  const diagnostics: BasisDiagnostic[] = [];
  const counts = new Map<string, number>();

  for (const entity of entities) {
    if (typeof entity.id !== "string") {
      throw new TypeError("Entity ID must be a string");
    }
    counts.set(entity.id, (counts.get(entity.id) ?? 0) + 1);
  }

  const groups: Array<[string, Obj[]]> = [
    ["entities", entities],
    ["relationships", records(scene.relationships)],
    ["constraints", records(scene.constraints)]
  ];

  for (const [group, items] of groups) {
    items.forEach((item, index) => {
      const basePath = `/${group}/${index}`;

      function emit(
        code: BasisDiagnostic["code"],
        suffix: string,
        message: string
      ): void {
        diagnostics.push({ code, path: basePath + suffix, message });
      }

      if (typeof item.basis !== "string" || !BASES.has(item.basis)) {
        emit("BASIS_INVALID", "/basis", "Unsupported evidence basis.");
      }

      if (item.supports === undefined) {
        if (item.basis === "derived_interpretation") {
          emit(
            "SUPPORTS_REQUIRED",
            "/supports",
            "Derived interpretations require supporting entity IDs."
          );
        }
        return;
      }

      if (
        !Array.isArray(item.supports) ||
        item.supports.some(
          id => typeof id !== "string" || id.length === 0
        ) ||
        new Set(item.supports).size !== item.supports.length
      ) {
        emit(
          "SUPPORTS_INVALID",
          "/supports",
          "Supports must be a unique array of nonempty entity IDs."
        );
        return;
      }

      if (
        item.basis === "derived_interpretation" &&
        item.supports.length === 0
      ) {
        emit(
          "SUPPORTS_REQUIRED",
          "/supports",
          "Derived interpretations require at least one support."
        );
      }

      item.supports.forEach((id: string, supportIndex: number) => {
        const suffix = `/supports/${supportIndex}`;
        const count = counts.get(id) ?? 0;

        if (group === "entities" && id === item.id) {
          emit(
            "SUPPORT_SELF",
            suffix,
            "An interpreted entity cannot support itself."
          );
        } else if (count === 0) {
          emit(
            "SUPPORT_DANGLING",
            suffix,
            `No entity resolves support ${JSON.stringify(id)}.`
          );
        } else if (count > 1) {
          emit(
            "ENTITY_ID_AMBIGUOUS",
            suffix,
            `Support ${JSON.stringify(id)} resolves multiple entities.`
          );
        }
      });
    });
  }

  return diagnostics;
}

async function main(): Promise<void> {
  const filename = process.argv[2];
  if (!filename || process.argv.length > 3) {
    throw new Error("Usage: lint-basis.ts <scene.json>");
  }

  const input: unknown = JSON.parse(await readFile(filename, "utf8"));
  const diagnostics = lintBasis(input);
  console.log(JSON.stringify({ diagnostics }, null, 2));
  process.exitCode = diagnostics.length > 0 ? 1 : 0;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
