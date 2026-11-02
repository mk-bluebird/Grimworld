/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export interface Evidence {
  /** RFC 6901 JSON Pointer into the supplied scene. */
  pointer: string;
  /** Exact source string, checked for staleness. */
  quote: string;
}

export interface AltFragment {
  id: string;
  language: string;
  text: string;
  evidence: readonly Evidence[];
}

export interface AltPlan {
  language: string;
  direction: "ltr" | "rtl";

  /** Ordered priorities; first fragment is mandatory for short output. */
  short: readonly AltFragment[];

  /** Complete selected long-description fragments, in reading order. */
  extended: readonly AltFragment[];
}

export interface ReviewDecision {
  approved: boolean;
  reviewerId: string;
  reviewedLanguage: string;
}

export type ReviewLookup = (
  fragment: Readonly<AltFragment>
) => ReviewDecision;

export type AltResult =
  | {
      status: "ready";
      language: string;
      direction: "ltr" | "rtl";
      alt: string;
      extendedDescription: string;
      selectedShortFragmentIds: string[];
      omittedShortFragmentIds: string[];
      reviewers: string[];
      characterMeasure: "unicode_code_points";
    }
  | {
      status: "blocked";
      code:
        | "INVALID_PLAN"
        | "LANGUAGE_MISMATCH"
        | "EVIDENCE_STALE"
        | "REVIEW_REQUIRED"
        | "REVIEW_FAILED"
        | "REQUIRED_FRAGMENT_TOO_LONG";
      fragmentId?: string;
    };

function languageTag(value: string): string | undefined {
  try {
    const tags = Intl.getCanonicalLocales(value);
    return tags.length === 1 ? tags[0] : undefined;
  } catch {
    return undefined;
  }
}

function resolvePointer(root: unknown, pointer: string): unknown {
  if (pointer === "") return root;
  if (!pointer.startsWith("/")) throw new Error("Invalid pointer");

  let current: unknown = root;

  for (const encoded of pointer.slice(1).split("/")) {
    if (/~(?:[^01]|$)/u.test(encoded)) {
      throw new Error("Invalid JSON Pointer escape");
    }

    const key = encoded.replace(/~1/gu, "/").replace(/~0/gu, "~");

    if (Array.isArray(current)) {
      if (!/^(0|[1-9][0-9]*)$/u.test(key)) {
        throw new Error("Invalid array index");
      }

      const index = Number(key);
      if (!Number.isSafeInteger(index) || index >= current.length) {
        throw new Error("Array index outside source");
      }
      current = current[index];
    } else if (
      current !== null &&
      typeof current === "object" &&
      Object.hasOwn(current, key)
    ) {
      current = (current as Record<string, unknown>)[key];
    } else {
      throw new Error("Unresolved pointer");
    }
  }

  return current;
}

function characters(text: string): number {
  return [...text].length;
}

/**
 * Source scene should already have passed its schema/semantic pipeline.
 * review is a trusted application adapter, not a model-provided flag.
 *
 * A positive review is relied upon for meaning and localization quality.
 * This function does not independently verify visual truth.
 */
export function renderAltText(
  scene: unknown,
  plan: AltPlan,
  review: ReviewLookup,
  maxShortCharacters = 300
): AltResult {
  if (
    !Number.isSafeInteger(maxShortCharacters) ||
    maxShortCharacters < 1 ||
    maxShortCharacters > 5000
  ) {
    throw new TypeError("Invalid trusted short-description budget");
  }

  const requestedLanguage = languageTag(plan.language);
  const fragments = [...plan.short, ...plan.extended];

  if (
    !requestedLanguage ||
    !["ltr", "rtl"].includes(plan.direction) ||
    plan.short.length === 0 ||
    fragments.length > 100
  ) {
    return { status: "blocked", code: "INVALID_PLAN" };
  }

  const ids = new Map<string, AltFragment>();
  const reviewers = new Set<string>();

  for (const fragment of fragments) {
    if (
      typeof fragment.id !== "string" ||
      fragment.id.length === 0 ||
      typeof fragment.text !== "string" ||
      fragment.text.trim().length === 0 ||
      fragment.text !== fragment.text.trim() ||
      fragment.evidence.length === 0 ||
      fragment.text.length > 20_000
    ) {
      return { status: "blocked", code: "INVALID_PLAN" };
    }

    const previous = ids.get(fragment.id);
    if (
      previous &&
      JSON.stringify(previous) !== JSON.stringify(fragment)
    ) {
      return {
        status: "blocked",
        code: "INVALID_PLAN",
        fragmentId: fragment.id
      };
    }
    ids.set(fragment.id, fragment);

    if (languageTag(fragment.language) !== requestedLanguage) {
      return {
        status: "blocked",
        code: "LANGUAGE_MISMATCH",
        fragmentId: fragment.id
      };
    }

    try {
      for (const evidence of fragment.evidence) {
        if (
          typeof evidence.quote !== "string" ||
          evidence.quote.length === 0 ||
          resolvePointer(scene, evidence.pointer) !== evidence.quote
        ) {
          return {
            status: "blocked",
            code: "EVIDENCE_STALE",
            fragmentId: fragment.id
          };
        }
      }
    } catch {
      return {
        status: "blocked",
        code: "EVIDENCE_STALE",
        fragmentId: fragment.id
      };
    }

    let decision: ReviewDecision;
    try {
      decision = review(fragment);
    } catch {
      return {
        status: "blocked",
        code: "REVIEW_FAILED",
        fragmentId: fragment.id
      };
    }

    if (
      decision.approved !== true ||
      !decision.reviewerId ||
      languageTag(decision.reviewedLanguage) !== requestedLanguage
    ) {
      return {
        status: "blocked",
        code: "REVIEW_REQUIRED",
        fragmentId: fragment.id
      };
    }

    reviewers.add(decision.reviewerId);
  }

  if (
    new Set(plan.short.map(fragment => fragment.id)).size !==
      plan.short.length ||
    new Set(plan.extended.map(fragment => fragment.id)).size !==
      plan.extended.length
  ) {
    return { status: "blocked", code: "INVALID_PLAN" };
  }

  const selected: AltFragment[] = [];
  const omitted: string[] = [];

  for (const fragment of plan.short) {
    const candidate = [...selected.map(item => item.text), fragment.text]
      .join(" ");

    if (characters(candidate) <= maxShortCharacters) {
      selected.push(fragment);
    } else if (selected.length === 0) {
      return {
        status: "blocked",
        code: "REQUIRED_FRAGMENT_TOO_LONG",
        fragmentId: fragment.id
      };
    } else {
      omitted.push(fragment.id);
    }
  }

  return {
    status: "ready",
    language: requestedLanguage,
    direction: plan.direction,
    alt: selected.map(fragment => fragment.text).join(" "),
    extendedDescription: plan.extended.map(fragment => fragment.text).join(" "),
    selectedShortFragmentIds: selected.map(fragment => fragment.id),
    omittedShortFragmentIds: omitted,
    reviewers: [...reviewers].sort(),
    characterMeasure: "unicode_code_points"
  };
}
