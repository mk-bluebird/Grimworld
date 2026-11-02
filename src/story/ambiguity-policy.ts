/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export interface AmbiguityPolicy {
  subject: string;
  topic: string;
  state: "intentionally_open";
  allowAttributedSpeculation: boolean;
}

export interface NarrativeClaim {
  id: string;
  subject: string;
  topic: string;
  text: string;
  treatment:
    | "leaves_open"
    | "attributed_speculation"
    | "authoritative_resolution"
    | "unreviewed";
  attributedTo?: string;
}

export interface AmbiguityFinding {
  code:
    | "MYSTERY_RESOLVED"
    | "SPECULATION_NOT_PERMITTED"
    | "SPECULATION_UNATTRIBUTED"
    | "CLAIM_REVIEW_REQUIRED";
  claimId: string;
  subject: string;
  topic: string;
}

export function checkAmbiguity(
  policies: readonly AmbiguityPolicy[],
  claims: readonly NarrativeClaim[]
): {
  status: "satisfied" | "violated" | "indeterminate";
  findings: AmbiguityFinding[];
} {
  const keys = new Set<string>();

  for (const policy of policies) {
    const key = JSON.stringify([policy.subject, policy.topic]);
    if (keys.has(key)) throw new TypeError("Duplicate ambiguity policy");
    keys.add(key);
  }

  const claimIds = new Set<string>();
  const findings: AmbiguityFinding[] = [];

  for (const claim of claims) {
    if (!claim.id || claimIds.has(claim.id)) {
      throw new TypeError("Claim IDs must be unique and nonempty");
    }
    claimIds.add(claim.id);

    const policy = policies.find(item =>
      item.subject === claim.subject && item.topic === claim.topic
    );
    if (!policy) continue;

    const base = {
      claimId: claim.id,
      subject: claim.subject,
      topic: claim.topic
    };

    switch (claim.treatment) {
      case "authoritative_resolution":
        findings.push({ ...base, code: "MYSTERY_RESOLVED" });
        break;

      case "attributed_speculation":
        if (!policy.allowAttributedSpeculation) {
          findings.push({ ...base, code: "SPECULATION_NOT_PERMITTED" });
        } else if (!claim.attributedTo?.trim()) {
          findings.push({ ...base, code: "SPECULATION_UNATTRIBUTED" });
        }
        break;

      case "unreviewed":
        findings.push({ ...base, code: "CLAIM_REVIEW_REQUIRED" });
        break;

      case "leaves_open":
        break;

      default:
        throw new TypeError("Unsupported claim treatment");
    }
  }

  const violated = findings.some(
    finding => finding.code !== "CLAIM_REVIEW_REQUIRED"
  );

  return {
    status: violated
      ? "violated"
      : findings.length > 0
        ? "indeterminate"
        : "satisfied",
    findings
  };
}
