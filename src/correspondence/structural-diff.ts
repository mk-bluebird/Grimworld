/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

export type Difference =
  | { kind: "added"; path: string; after: Json }
  | { kind: "removed"; path: string; before: Json }
  | { kind: "changed"; path: string; before: Json; after: Json };

function token(value: string): string {
  return value.replace(/~/gu, "~0").replace(/\//gu, "~1");
}

function isObject(value: Json): value is { [key: string]: Json } {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Operates on admitted JSON projections.
 * This function is not an arbitrary-object parser or a hard resource sandbox.
 *
 * Array order is meaningful. Normalize keyed collections before this boundary.
 */
export function structuralDiff(
  before: Json,
  after: Json,
  maxDifferences = 1000
): Difference[] {
  if (!Number.isSafeInteger(maxDifferences) || maxDifferences < 1) {
    throw new TypeError("Invalid difference limit");
  }

  const differences: Difference[] = [];

  function emit(difference: Difference): void {
    if (differences.length >= maxDifferences) {
      throw new RangeError("Difference limit exceeded");
    }
    differences.push(structuredClone(difference));
  }

  function visit(a: Json, b: Json, path: string, depth: number): void {
    if (depth > 128) throw new RangeError("Projection depth exceeded");
    if (a === b) return;

    if (Array.isArray(a) && Array.isArray(b)) {
      const common = Math.min(a.length, b.length);

      for (let i = 0; i < common; i++) {
        visit(a[i]!, b[i]!, `${path}/${i}`, depth + 1);
      }

      for (let i = common; i < a.length; i++) {
        emit({ kind: "removed", path: `${path}/${i}`, before: a[i]! });
      }

      for (let i = common; i < b.length; i++) {
        emit({ kind: "added", path: `${path}/${i}`, after: b[i]! });
      }

      return;
    }

    if (isObject(a) && isObject(b)) {
      const keys = [...new Set([
        ...Object.keys(a),
        ...Object.keys(b)
      ])].sort();

      for (const key of keys) {
        const next = `${path}/${token(key)}`;
        const hasA = Object.hasOwn(a, key);
        const hasB = Object.hasOwn(b, key);

        if (!hasA) {
          emit({ kind: "added", path: next, after: b[key]! });
        } else if (!hasB) {
          emit({ kind: "removed", path: next, before: a[key]! });
        } else {
          visit(a[key]!, b[key]!, next, depth + 1);
        }
      }

      return;
    }

    emit({ kind: "changed", path, before: a, after: b });
  }

  visit(before, after, "", 0);
  return differences;
}
