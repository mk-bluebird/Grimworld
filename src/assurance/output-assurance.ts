/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Document credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export type ContractId =
  | "grimlore.description.v1"
  | "grimlore.relational.v2";

const CONTRACTS = new Set<string>([
  "grimlore.description.v1",
  "grimlore.relational.v2"
]);

function isContract(value: unknown): value is ContractId {
  return typeof value === "string" && CONTRACTS.has(value);
}

export type RoutingResult =
  | {
      ok: true;
      contract: ContractId;
      selection: "explicit" | "default";
    }
  | {
      ok: false;
      code: "UNKNOWN_CONTRACT" | "CONTRACT_CONFLICT";
    };

export interface RoutingPolicy {
  defaultContract: ContractId;
  requiredContract?: ContractId;
}

/**
 * Read output_contract from the application's request envelope,
 * not from natural-language task material.
 *
 * The routing policy is trusted application configuration.
 */
export function selectOutputContract(
  requested: unknown,
  policy: RoutingPolicy
): RoutingResult {
  if (
    !isContract(policy.defaultContract) ||
    (
      policy.requiredContract !== undefined &&
      !isContract(policy.requiredContract)
    )
  ) {
    throw new TypeError("Invalid application routing policy");
  }

  if (requested !== undefined && !isContract(requested)) {
    return { ok: false, code: "UNKNOWN_CONTRACT" };
  }

  const selected =
    requested === undefined ? policy.defaultContract : requested;

  if (
    policy.requiredContract !== undefined &&
    selected !== policy.requiredContract
  ) {
    return { ok: false, code: "CONTRACT_CONFLICT" };
  }

  return {
    ok: true,
    contract: selected,
    selection: requested === undefined ? "default" : "explicit"
  };
}

export type Section =
  | "observable_facts"
  | "interpretive_atmosphere"
  | "integrated_description";

export interface AnnotatedClaim {
  id: string;
  section: Section;
  text: string;
  kind: "observational" | "interpretive" | "unreviewed";
  evidence:
    | "supported"
    | "contradicted"
    | "not_established"
    | "unreviewed";
}

/**
 * Input is an annotated claim corpus, not unreviewed model self-labeling.
 * The text-to-atomic-claims extraction step needs its own evaluation.
 */
export function measureSeparation(claims: readonly AnnotatedClaim[]) {
  const ids = new Set<string>();

  for (const claim of claims) {
    if (claim.id.length === 0 || ids.has(claim.id)) {
      throw new TypeError("Claim IDs must be unique and nonempty");
    }
    ids.add(claim.id);
  }

  const facts = claims.filter(
    claim => claim.section === "observable_facts"
  );

  // Both judgments are necessary before inclusion in adjudicated rates.
  const reviewed = facts.filter(
    claim =>
      claim.kind !== "unreviewed" &&
      claim.evidence !== "unreviewed"
  );

  const leaking = reviewed.filter(
    claim =>
      claim.kind === "interpretive" ||
      claim.evidence === "contradicted" ||
      claim.evidence === "not_established"
  );

  function ratio(numerator: number, denominator: number): number | null {
    return denominator === 0 ? null : numerator / denominator;
  }

  return {
    metricVersion: "grimlore.separation.v1",
    factClaimCount: facts.length,
    adjudicatedFactClaimCount: reviewed.length,
    unadjudicatedFactClaimCount: facts.length - reviewed.length,
    leakingClaimCount: leaking.length,
    interpretationClaimCount: reviewed.filter(
      claim => claim.kind === "interpretive"
    ).length,
    contradictedClaimCount: reviewed.filter(
      claim => claim.evidence === "contradicted"
    ).length,
    notEstablishedClaimCount: reviewed.filter(
      claim => claim.evidence === "not_established"
    ).length,
    reviewCoverage: ratio(reviewed.length, facts.length),
    adjudicatedLeakageRate: ratio(leaking.length, reviewed.length),
    leakingClaimIds: leaking.map(claim => claim.id)
  };
}

export interface CompositionInput {
  entityIds: readonly string[];
  eyePath: readonly string[];
  depthLayers: {
    foreground: readonly string[];
    middle_ground: readonly string[];
    background: readonly string[];
  };
  /**
   * "unrestricted" is the default.
   * A forward-depth policy is a project constraint, not a law of art.
   */
  traversal?: "unrestricted" | "near_to_far";
}

export interface CompositionDiagnostic {
  code:
    | "DUPLICATE_ENTITY_ID"
    | "DANGLING_ENTITY"
    | "DUPLICATE_DEPTH_ASSIGNMENT"
    | "DEPTH_UNASSIGNED"
    | "DEPTH_BACKTRACK";
  path: string;
  message: string;
}

export function checkComposition(input: CompositionInput): {
  ordering: "consistent" | "violated" | "indeterminate";
  diagnostics: CompositionDiagnostic[];
} {
  const diagnostics: CompositionDiagnostic[] = [];
  const entities = new Set<string>();

  input.entityIds.forEach((id, index) => {
    if (entities.has(id)) {
      diagnostics.push({
        code: "DUPLICATE_ENTITY_ID",
        path: `/entityIds/${index}`,
        message: `Duplicate entity ID: ${id}`
      });
    }
    entities.add(id);
  });

  const depths = new Map<string, number>();
  const ambiguous = new Set<string>();

  const layers = [
    ["foreground", input.depthLayers.foreground],
    ["middle_ground", input.depthLayers.middle_ground],
    ["background", input.depthLayers.background]
  ] as const;

  layers.forEach(([name, ids], rank) => {
    ids.forEach((id, index) => {
      if (!entities.has(id)) {
        diagnostics.push({
          code: "DANGLING_ENTITY",
          path: `/depthLayers/${name}/${index}`,
          message: `No entity resolves ${id}`
        });
      }

      if (depths.has(id)) {
        ambiguous.add(id);
        diagnostics.push({
          code: "DUPLICATE_DEPTH_ASSIGNMENT",
          path: `/depthLayers/${name}/${index}`,
          message: `Entity has multiple depth assignments: ${id}`
        });
      } else {
        depths.set(id, rank);
      }
    });
  });

  let unknownDepth = false;
  let previous: number | undefined;

  input.eyePath.forEach((id, index) => {
    if (!entities.has(id)) {
      diagnostics.push({
        code: "DANGLING_ENTITY",
        path: `/eyePath/${index}`,
        message: `No entity resolves ${id}`
      });
    }

    const rank = depths.get(id);

    if (rank === undefined || ambiguous.has(id)) {
      unknownDepth = true;
      previous = undefined;

      if (rank === undefined) {
        diagnostics.push({
          code: "DEPTH_UNASSIGNED",
          path: `/eyePath/${index}`,
          message: `No depth assignment for ${id}`
        });
      }
      return;
    }

    if (
      input.traversal === "near_to_far" &&
      previous !== undefined &&
      rank < previous
    ) {
      diagnostics.push({
        code: "DEPTH_BACKTRACK",
        path: `/eyePath/${index}`,
        message: `Depth decreases at ${id}`
      });
    }

    previous = rank;
  });

  const structuralIssue = diagnostics.some(
    diagnostic =>
      diagnostic.code !== "DEPTH_UNASSIGNED"
  );

  return {
    ordering: structuralIssue
      ? "violated"
      : unknownDepth
        ? "indeterminate"
        : "consistent",
    diagnostics
  };
}

export interface NegativeSpaceMask {
  /**
   * Equal-area cells covering the entire canvas.
   * true = designated negative space.
   * false = not designated negative space.
   * null = unreviewed/unknown.
   */
  width: number;
  height: number;
  cells: readonly (boolean | null)[];
  sourceBasis: "author_annotation" | "expert_annotation" | "model_estimate";
}

/**
 * Bounds are exact for the supplied equal-area grid labels.
 * They are not exact continuous-image area measurements.
 */
export function measureNegativeSpace(mask?: NegativeSpaceMask) {
  if (mask === undefined) {
    return {
      status: "indeterminate" as const,
      reason: "GEOMETRY_ABSENT" as const
    };
  }

  if (
    !Number.isSafeInteger(mask.width) ||
    !Number.isSafeInteger(mask.height) ||
    mask.width < 1 ||
    mask.height < 1 ||
    !Number.isSafeInteger(mask.width * mask.height) ||
    mask.width * mask.height !== mask.cells.length ||
    mask.cells.length > 1_000_000 ||
    mask.cells.some(
      value => value !== true && value !== false && value !== null
    )
  ) {
    throw new TypeError("Invalid or oversized equal-area mask");
  }

  const negative = mask.cells.filter(value => value === true).length;
  const unknown = mask.cells.filter(value => value === null).length;
  const total = mask.cells.length;

  return {
    status: unknown === 0 ? "measured" as const : "partial" as const,
    sourceBasis: mask.sourceBasis,
    totalCells: total,
    unknownCells: unknown,
    fractionLowerBound: negative / total,
    fractionUpperBound: (negative + unknown) / total,
    perceptualQuietness: "not_evaluated" as const,
    actualGazeSequence: "not_evaluated" as const
  };
}
