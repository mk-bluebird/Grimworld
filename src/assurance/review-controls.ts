import { createHash } from "node:crypto";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export type Depth = "near" | "middle" | "far";

export type DepthClaim =
  | {
      state: "known";
      reference: "viewer";
      extent: readonly Depth[];
      basis:
        | "explicit_description"
        | "derived_interpretation"
        | "implementation_choice";
    }
  | {
      state: "unknown" | "intentionally_open" | "not_applicable";
      reason: string;
    };

export function validateDepth(claim: DepthClaim): boolean {
  if (claim.state !== "known") {
    return typeof claim.reason === "string" &&
      claim.reason.trim().length > 0;
  }

  const rank: Record<Depth, number> = {
    near: 0,
    middle: 1,
    far: 2
  };

  if (
    claim.reference !== "viewer" ||
    claim.extent.length === 0 ||
    claim.extent.some(value => !Object.hasOwn(rank, value))
  ) {
    return false;
  }

  return claim.extent.every(
    (value, index) =>
      index === 0 ||
      rank[value] > rank[claim.extent[index - 1]!]
  );
}

export const CHECKS = [
  "mode_and_format",
  "defining_details",
  "observation_separation",
  "composition_and_materials",
  "narrative_consequence",
  "knowledge_and_world_rules",
  "folklore_qualification",
  "execution_honesty",
  "text_only"
] as const;

export type CheckId = typeof CHECKS[number];

export type CheckOutcome =
  | "pass"
  | "fail"
  | "blocked"
  | "not_applicable"
  | "not_run";

export interface CheckResult {
  outcome: CheckOutcome;
  evidenceIds: string[];
  note: string;
}

export interface ChecklistRow {
  id: CheckId;
  automated: CheckResult;
  human: CheckResult;
}

type Checker = () => Promise<CheckResult>;

const OUTCOMES = new Set<string>([
  "pass", "fail", "blocked", "not_applicable", "not_run"
]);

function validateResult(value: CheckResult): CheckResult {
  if (
    !OUTCOMES.has(value.outcome) ||
    !Array.isArray(value.evidenceIds) ||
    value.evidenceIds.some(id => typeof id !== "string" || !id) ||
    typeof value.note !== "string" ||
    value.note.trim().length === 0 ||
    (
      (value.outcome === "pass" || value.outcome === "fail") &&
      value.evidenceIds.length === 0
    )
  ) {
    throw new TypeError("Invalid checklist result");
  }

  return structuredClone(value);
}

/**
 * Checker adapters are trusted application integrations.
 * This report is not a publication permit or an assurance percentage.
 */
export async function runChecklist(input: {
  automated: Partial<Record<CheckId, Checker>>;
  human: Partial<Record<CheckId, CheckResult>>;
}): Promise<ChecklistRow[]> {
  const rows: ChecklistRow[] = [];

  for (const id of CHECKS) {
    let automated: CheckResult = {
      outcome: "not_run",
      evidenceIds: [],
      note: "No automated adapter supplied."
    };

    const checker = input.automated[id];

    if (checker) {
      try {
        automated = validateResult(await checker());
      } catch {
        automated = {
          outcome: "blocked",
          evidenceIds: [],
          note: "Automated adapter failed or returned an invalid result."
        };
      }
    }

    const human = input.human[id]
      ? validateResult(input.human[id]!)
      : {
          outcome: "not_run" as const,
          evidenceIds: [],
          note: "No human review supplied."
        };

    rows.push({ id, automated, human });
  }

  return rows;
}

export interface FewShotExample {
  id: string;
  revision: string;
  text: string;
  sha256: string;
}

export interface ExampleSelection {
  policy: "fixed" | "deterministic_rotation";
  policyRevision: string;
  packRevision: string;
  count: number;

  /** Exact order for fixed selection. */
  fixedIds?: readonly string[];

  /** Non-sensitive synthetic evaluation key, not a production prompt. */
  selectionKey?: string;
}

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function selectExamples(
  pool: readonly FewShotExample[],
  selection: ExampleSelection
) {
  if (
    pool.length === 0 ||
    pool.length > 256 ||
    !Number.isSafeInteger(selection.count) ||
    selection.count < 1 ||
    selection.count > pool.length ||
    !selection.policyRevision ||
    !selection.packRevision
  ) {
    throw new TypeError("Invalid example-selection configuration");
  }

  const examples = new Map<string, FewShotExample>();

  for (const example of pool) {
    if (
      !example.id ||
      !example.revision ||
      examples.has(example.id) ||
      !/^[a-f0-9]{64}$/u.test(example.sha256) ||
      hash(example.text) !== example.sha256
    ) {
      throw new TypeError("Duplicate or integrity-invalid example");
    }

    examples.set(example.id, structuredClone(example));
  }

  let ordered: FewShotExample[];

  if (selection.policy === "fixed") {
    const ids = selection.fixedIds;

    if (
      !ids ||
      ids.length !== selection.count ||
      new Set(ids).size !== ids.length ||
      ids.some(id => !examples.has(id))
    ) {
      throw new TypeError("Fixed selection must name exact unique IDs");
    }

    ordered = ids.map(id => examples.get(id)!);
  } else if (selection.policy === "deterministic_rotation") {
    if (!selection.selectionKey) {
      throw new TypeError("Rotation requires an explicit selection key");
    }

    ordered = [...examples.values()]
      .map(example => ({
        example,
        score: hash(JSON.stringify([
          selection.policyRevision,
          selection.packRevision,
          selection.selectionKey,
          example.id,
          example.revision
        ]))
      }))
      .sort((a, b) =>
        a.score < b.score ? -1 :
        a.score > b.score ? 1 :
        a.example.id < b.example.id ? -1 : 1
      )
      .slice(0, selection.count)
      .map(item => item.example);
  } else {
    throw new TypeError("Unknown selection policy");
  }

  return {
    examples: ordered,
    manifest: {
      policy: selection.policy,
      policyRevision: selection.policyRevision,
      packRevision: selection.packRevision,
      order: ordered.map(example => ({
        id: example.id,
        revision: example.revision,
        sha256: example.sha256
      }))
    }
  };
}
