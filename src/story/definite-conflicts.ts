/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export interface Interval {
  start: number;
  end: number;
}

export type NarrativeTime =
  | { kind: "interval"; interval: Interval }
  | { kind: "tick"; at: number }
  | {
      kind: "uncertain";
      definitely_true: Interval | null;
      possibly_true: Interval;
    };

export interface Assertion {
  id: string;
  world: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  epistemic: "canon" | "belief" | "rumor" | "interpretation";
  provenance: "depicted" | "authored" | "inferred";
  cardinality: "single" | "multiple";
  time: NarrativeTime;
}

interface Row {
  id: string;
  world: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  start: number;
  end: number;
}

declare const normalizedBrand: unique symbol;

export type NormalizedAssertions = Readonly<{
  readonly [normalizedBrand]: true;
}>;

export interface Diagnostic {
  code: "INVALID_ASSERTION" | "INPUT_LIMIT";
  path: string;
  message: string;
}

export type Admission =
  | { ok: true; input: NormalizedAssertions }
  | { ok: false; diagnostics: Diagnostic[] };

export type ConflictResult =
  | {
      status: "complete";
      conflicts: Array<readonly [string, string]>;
      uncertainEligibleAssertions: number;
      consistency: "conflicting" | "indeterminate" | "no_definite_conflict";
    }
  | {
      status: "conflict_limit_exceeded";
      emittedConflictCount: number;
    }
  | {
      status: "invalid_token";
    };

const issued = new WeakMap<object, {
  rows: Row[];
  uncertain: number;
}>();

// Machine identifiers are deliberately narrower than prose.
// This rejects zero-width variants and normalization ambiguity.
const ID = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/u;

function object(value: unknown): Record<string, unknown> {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    throw new TypeError("Expected object");
  }
  return value as Record<string, unknown>;
}

function interval(value: unknown): Interval {
  const input = object(value);
  const start = input.start;
  const end = input.end;

  if (
    typeof start !== "number" ||
    typeof end !== "number" ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= end
  ) {
    throw new TypeError("Expected non-negative safe-integer interval");
  }

  return { start, end };
}

function time(value: unknown): {
  definite: Interval | null;
  uncertain: boolean;
} {
  const input = object(value);

  if (input.kind === "interval") {
    return { definite: interval(input.interval), uncertain: false };
  }

  if (input.kind === "tick") {
    if (
      typeof input.at !== "number" ||
      !Number.isSafeInteger(input.at) ||
      input.at < 0 ||
      input.at >= Number.MAX_SAFE_INTEGER
    ) {
      throw new TypeError("Tick must have a representable next boundary");
    }
    return {
      definite: { start: input.at, end: input.at + 1 },
      uncertain: false
    };
  }

  if (input.kind === "uncertain") {
    const possible = interval(input.possibly_true);
    const definite = input.definitely_true === null
      ? null
      : interval(input.definitely_true);

    if (
      definite &&
      (
        definite.start < possible.start ||
        definite.end > possible.end
      )
    ) {
      throw new TypeError("Definite interval must lie inside possible interval");
    }

    return { definite, uncertain: true };
  }

  throw new TypeError("Unsupported time encoding");
}

/**
 * Public admission boundary for JSON-compatible assertion arrays.
 * Validates this module's required fields and copies used values.
 *
 * Additional properties are ignored here; closed-object schema validation
 * remains a separate contract concern.
 */
export function normalizeAssertions(
  input: unknown,
  maxAssertions = 10_000
): Admission {
  if (
    !Number.isSafeInteger(maxAssertions) ||
    maxAssertions < 1
  ) {
    throw new TypeError("Invalid trusted admission configuration");
  }

  if (!Array.isArray(input)) {
    return {
      ok: false,
      diagnostics: [{
        code: "INVALID_ASSERTION",
        path: "/",
        message: "Expected assertion array"
      }]
    };
  }

  if (input.length > maxAssertions) {
    return {
      ok: false,
      diagnostics: [{
        code: "INPUT_LIMIT",
        path: "/",
        message: "Assertion count exceeds admission limit"
      }]
    };
  }

  const diagnostics: Diagnostic[] = [];
  const ids = new Set<string>();
  const rows: Row[] = [];
  let uncertain = 0;

  input.forEach((raw, index) => {
    try {
      const item = object(raw);

      for (const key of ["id", "world", "subject", "predicate"]) {
        if (
          typeof item[key] !== "string" ||
          !ID.test(item[key] as string)
        ) {
          throw new TypeError(`Invalid machine identifier: ${key}`);
        }
      }

      const id = item.id as string;
      if (ids.has(id)) throw new TypeError("Duplicate assertion ID");
      ids.add(id);

      const value = item.value;
      if (
        typeof value !== "string" &&
        typeof value !== "boolean" &&
        !(typeof value === "number" && Number.isFinite(value))
      ) {
        throw new TypeError("Expected finite scalar value");
      }

      if (typeof value === "string" && value.length > 4096) {
        throw new TypeError("Scalar string exceeds limit");
      }

      if (
        !["canon", "belief", "rumor", "interpretation"]
          .includes(String(item.epistemic)) ||
        !["depicted", "authored", "inferred"]
          .includes(String(item.provenance)) ||
        !["single", "multiple"].includes(String(item.cardinality))
      ) {
        throw new TypeError("Unsupported classification");
      }

      const extent = time(item.time);
      const eligible =
        item.epistemic === "canon" &&
        item.cardinality === "single";

      if (eligible && extent.uncertain) uncertain++;

      if (eligible && extent.definite) {
        rows.push({
          id,
          world: item.world as string,
          subject: item.subject as string,
          predicate: item.predicate as string,
          value,
          ...extent.definite
        });
      }
    } catch (error) {
      diagnostics.push({
        code: "INVALID_ASSERTION",
        path: `/${index}`,
        message: error instanceof Error ? error.message : "Invalid assertion"
      });
    }
  });

  if (diagnostics.length > 0) return { ok: false, diagnostics };

  const token = Object.freeze({}) as NormalizedAssertions;
  issued.set(token, { rows, uncertain });
  return { ok: true, input: token };
}

class EndHeap {
  private values: Row[] = [];

  peek(): Row | undefined {
    return this.values[0];
  }

  push(value: Row): void {
    const a = this.values;
    a.push(value);
    let i = a.length - 1;

    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (a[parent]!.end <= a[i]!.end) break;
      [a[parent], a[i]] = [a[i]!, a[parent]!];
      i = parent;
    }
  }

  pop(): Row | undefined {
    const a = this.values;
    if (a.length === 0) return undefined;

    const first = a[0]!;
    const last = a.pop()!;

    if (a.length > 0) {
      a[0] = last;
      let i = 0;

      while (true) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;

        if (left < a.length && a[left]!.end < a[smallest]!.end) {
          smallest = left;
        }
        if (right < a.length && a[right]!.end < a[smallest]!.end) {
          smallest = right;
        }
        if (smallest === i) break;

        [a[i], a[smallest]] = [a[smallest]!, a[i]!];
        i = smallest;
      }
    }

    return first;
  }
}

/**
 * Emits definite conflicts only.
 * Adjacency policy: end === start means meets, not conflict.
 *
 * Output is unsorted; each unordered pair is emitted once.
 * Under standard map assumptions: O(n log n + K), O(n + K) space.
 * K may be quadratic. The output limit returns an incomplete outcome,
 * never a complete conflict-free result.
 */
export function definiteConflicts(
  input: NormalizedAssertions,
  maxConflicts = 100_000
): ConflictResult {
  if (!Number.isSafeInteger(maxConflicts) || maxConflicts < 0) {
    throw new TypeError("Invalid trusted output limit");
  }

  if (
    input === null ||
    typeof input !== "object" ||
    !issued.has(input)
  ) {
    return { status: "invalid_token" };
  }

  const snapshot = issued.get(input)!;
  const groups = new Map<string, Row[]>();

  for (const row of snapshot.rows) {
    const key = JSON.stringify([row.world, row.subject, row.predicate]);
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }

  const conflicts: Array<readonly [string, string]> = [];

  for (const group of groups.values()) {
    group.sort((a, b) =>
      a.start - b.start ||
      a.end - b.end ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    );

    const heap = new EndHeap();
    const byValue = new Map<Row["value"], Map<string, Row>>();

    for (const current of group) {
      while (heap.peek() && heap.peek()!.end <= current.start) {
        const expired = heap.pop()!;
        const bucket = byValue.get(expired.value)!;
        bucket.delete(expired.id);
        if (bucket.size === 0) byValue.delete(expired.value);
      }

      for (const [value, bucket] of byValue) {
        if (value === current.value) continue;

        for (const previous of bucket.values()) {
          if (conflicts.length >= maxConflicts) {
            return {
              status: "conflict_limit_exceeded",
              emittedConflictCount: conflicts.length
            };
          }

          conflicts.push(
            previous.id < current.id
              ? [previous.id, current.id]
              : [current.id, previous.id]
          );
        }
      }

      const bucket = byValue.get(current.value) ?? new Map<string, Row>();
      bucket.set(current.id, current);
      byValue.set(current.value, bucket);
      heap.push(current);
    }
  }

  return {
    status: "complete",
    conflicts,
    uncertainEligibleAssertions: snapshot.uncertain,
    consistency: conflicts.length > 0
      ? "conflicting"
      : snapshot.uncertain > 0
        ? "indeterminate"
        : "no_definite_conflict"
  };
}
