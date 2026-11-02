/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export interface Interval {
  start: number;
  end: number;
}

export type AllenRelation =
  | "before"
  | "meets"
  | "overlaps"
  | "starts"
  | "during"
  | "finishes"
  | "equals"
  | "after"
  | "met_by"
  | "overlapped_by"
  | "started_by"
  | "contains"
  | "finished_by";

export const INVERSE: Readonly<Record<AllenRelation, AllenRelation>> =
  Object.freeze({
    before: "after",
    after: "before",
    meets: "met_by",
    met_by: "meets",
    overlaps: "overlapped_by",
    overlapped_by: "overlaps",
    starts: "started_by",
    started_by: "starts",
    during: "contains",
    contains: "during",
    finishes: "finished_by",
    finished_by: "finishes",
    equals: "equals"
  });

function assertInterval(interval: Interval): void {
  if (
    !Number.isSafeInteger(interval.start) ||
    !Number.isSafeInteger(interval.end) ||
    interval.start >= interval.end
  ) {
    throw new TypeError("Expected a nonempty safe-integer interval");
  }
}

export function allen(a: Interval, b: Interval): AllenRelation {
  assertInterval(a);
  assertInterval(b);

  if (a.end < b.start) return "before";
  if (a.end === b.start) return "meets";
  if (a.start > b.end) return "after";
  if (a.start === b.end) return "met_by";

  if (a.start === b.start) {
    if (a.end === b.end) return "equals";
    return a.end < b.end ? "starts" : "started_by";
  }

  if (a.end === b.end) {
    return a.start > b.start ? "finishes" : "finished_by";
  }

  if (a.start < b.start) {
    return a.end < b.end ? "overlaps" : "contains";
  }

  return a.end < b.end ? "during" : "overlapped_by";
}

export interface ComparableAssertion extends Interval {
  id: string;
  world: string;
  subject: string;
  predicate: string;
  epistemic: "canon" | "belief" | "rumor" | "interpretation";
  cardinality: "single" | "multiple";

  /**
   * Registry-normalized scalar value.
   * Entity-reference values require a separately versioned extension.
   */
  value: string | number | boolean;
}

export type ConflictPair = readonly [string, string];

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function pair(a: string, b: string): ConflictPair {
  return compareText(a, b) <= 0 ? [a, b] : [b, a];
}

function sorted(pairs: ConflictPair[]): ConflictPair[] {
  return pairs.sort(
    (a, b) => compareText(a[0], b[0]) || compareText(a[1], b[1])
  );
}

function admit(
  assertions: readonly ComparableAssertion[]
): ComparableAssertion[] {
  const ids = new Set<string>();

  for (const assertion of assertions) {
    assertInterval(assertion);

    for (const field of [
      assertion.id,
      assertion.world,
      assertion.subject,
      assertion.predicate
    ]) {
      if (typeof field !== "string" || field.length === 0) {
        throw new TypeError("IDs and grouping fields must be nonempty");
      }
    }

    if (ids.has(assertion.id)) {
      throw new TypeError(`Duplicate assertion ID: ${assertion.id}`);
    }
    ids.add(assertion.id);

    if (
      typeof assertion.value !== "string" &&
      typeof assertion.value !== "boolean" &&
      !(
        typeof assertion.value === "number" &&
        Number.isFinite(assertion.value)
      )
    ) {
      throw new TypeError("Expected a finite normalized scalar value");
    }

    if (
      !["canon", "belief", "rumor", "interpretation"]
        .includes(assertion.epistemic) ||
      !["single", "multiple"].includes(assertion.cardinality)
    ) {
      throw new TypeError("Unsupported assertion classification");
    }
  }

  return assertions.filter(
    assertion =>
      assertion.epistemic === "canon" &&
      assertion.cardinality === "single"
  );
}

function sameKey(
  a: ComparableAssertion,
  b: ComparableAssertion
): boolean {
  return (
    a.world === b.world &&
    a.subject === b.subject &&
    a.predicate === b.predicate
  );
}

function overlaps(a: Interval, b: Interval): boolean {
  return Math.max(a.start, b.start) < Math.min(a.end, b.end);
}

/** Simple reference implementation used as a differential oracle. */
export function pairwiseConflicts(
  input: readonly ComparableAssertion[]
): ConflictPair[] {
  const assertions = admit(input);
  const conflicts: ConflictPair[] = [];

  for (let i = 0; i < assertions.length; i++) {
    for (let j = i + 1; j < assertions.length; j++) {
      const a = assertions[i]!;
      const b = assertions[j]!;

      if (
        sameKey(a, b) &&
        overlaps(a, b) &&
        a.value !== b.value
      ) {
        conflicts.push(pair(a.id, b.id));
      }
    }
  }

  return sorted(conflicts);
}

/**
 * Batch sweep per fact key.
 * O(n log n + M), where M counts overlapping candidate pairs.
 *
 * This does not impose a hard memory/time budget. Deployment must admit
 * bounded input and bound the potentially quadratic conflict output.
 */
export function sweepConflicts(
  input: readonly ComparableAssertion[]
): ConflictPair[] {
  const assertions = admit(input);
  const groups = new Map<string, ComparableAssertion[]>();

  for (const assertion of assertions) {
    // Tuple serialization avoids delimiter-collision grouping bugs.
    const key = JSON.stringify([
      assertion.world,
      assertion.subject,
      assertion.predicate
    ]);

    const group = groups.get(key) ?? [];
    group.push(assertion);
    groups.set(key, group);
  }

  const conflicts: ConflictPair[] = [];

  for (const group of groups.values()) {
    group.sort(
      (a, b) =>
        a.start - b.start ||
        a.end - b.end ||
        compareText(a.id, b.id)
    );

    let active: ComparableAssertion[] = [];

    for (const current of group) {
      // end === start means meets, not positive-duration overlap.
      active = active.filter(previous => previous.end > current.start);

      for (const previous of active) {
        if (previous.value !== current.value) {
          conflicts.push(pair(previous.id, current.id));
        }
      }

      active.push(current);
    }
  }

  return sorted(conflicts);
}
