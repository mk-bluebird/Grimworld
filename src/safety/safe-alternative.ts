/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export interface RefusalDecision {
  kind: "refuse";
  policyRevision: string;
  boundaryText: string;
}

export interface AlternativeReview {
  verdict: "approved" | "rejected" | "unrated";
  policyRevision: string;
}

export async function composeSafeAlternative(input: {
  decision: RefusalDecision;
  generateAlternative: () => Promise<string>;
  reviewAlternative: (text: string) => Promise<AlternativeReview>;
}): Promise<{
  text: string;
  alternativeStatus: "included" | "withheld";
}> {
  const { decision } = input;

  if (
    decision.kind !== "refuse" ||
    !decision.policyRevision ||
    !decision.boundaryText.trim()
  ) {
    throw new TypeError("Valid trusted refusal decision required");
  }

  const refusalOnly = {
    text: decision.boundaryText.trim(),
    alternativeStatus: "withheld" as const
  };

  try {
    const alternative = await input.generateAlternative();

    if (
      typeof alternative !== "string" ||
      alternative.trim().length === 0 ||
      Buffer.byteLength(alternative, "utf8") > 32 * 1024
    ) {
      return refusalOnly;
    }

    const review = await input.reviewAlternative(alternative);

    if (
      review.verdict !== "approved" ||
      review.policyRevision !== decision.policyRevision
    ) {
      return refusalOnly;
    }

    return {
      text: `${decision.boundaryText.trim()}\n\n${alternative.trim()}`,
      alternativeStatus: "included"
    };
  } catch {
    return refusalOnly;
  }
}
