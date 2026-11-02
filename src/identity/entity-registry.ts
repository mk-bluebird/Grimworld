/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export function createEntityRegistry(
  canonicalIds: readonly string[],
  redirects: Readonly<Record<string, string>>
) {
  if (
    canonicalIds.some(id => typeof id !== "string" || !id) ||
    new Set(canonicalIds).size !== canonicalIds.length
  ) {
    throw new TypeError("Canonical IDs must be unique and nonempty");
  }

  const canonical = new Set(canonicalIds);
  const aliases = new Map(Object.entries(redirects));

  for (const [from, to] of aliases) {
    if (!from || typeof to !== "string" || !to || canonical.has(from)) {
      throw new TypeError("Invalid or colliding redirect");
    }
  }

  function resolve(id: string): {
    status: "resolved";
    canonicalId: string;
    redirected: boolean;
  } | {
    status: "dangling";
  } {
    const seen = new Set<string>();
    let current = id;

    while (!canonical.has(current)) {
      if (seen.has(current)) throw new TypeError("Redirect cycle");
      seen.add(current);

      const next = aliases.get(current);
      if (next === undefined) return { status: "dangling" };
      current = next;
    }

    return {
      status: "resolved",
      canonicalId: current,
      redirected: current !== id
    };
  }

  // Reject broken chains at registry admission, not during later authoring.
  for (const alias of aliases.keys()) {
    if (resolve(alias).status !== "resolved") {
      throw new TypeError(`Redirect does not reach a canonical ID: ${alias}`);
    }
  }

  return Object.freeze({ resolve });
}
