/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

type Scalar = string | number | boolean;

export interface Fact {
  subject: string;
  property: string;
  value: Scalar;
}

export interface Claim {
  id: string;
  text: string;
}

export interface Addition {
  claim_id: string;
  origin: "creative_addition";
  basis: "implementation_choice";
  scene_anchors: string[];
  note: string;
}

export interface AnomalyRule {
  id: string;
  subjects: string[];
  property: string;
  transitions: Array<{ from: Scalar; to: Scalar }>;
  nodes: string[];
  maxUses: number;
}

export type Operation =
  | {
      kind: "assign";
      fact: Fact;
    }
  | {
      kind: "anomaly";
      rule: string;
      subject: string;
      property: string;
      from: Scalar;
      to: Scalar;
    };

export interface Choice {
  id: string;
  label: string;
  destination: string;
  operations: Operation[];
}

export interface StoryNode {
  id: string;
  claims: Claim[];
  requires: Fact[];
  choices: Choice[];
}

export interface Story {
  version: "1.0.0";
  entry: string;
  initialFacts: Fact[];
  nodes: StoryNode[];
  anomalyRules: AnomalyRule[];

  /**
   * This small profile treats every supplied claim as a creative addition.
   * Source-derived claims need a separately extended provenance profile.
   */
  additions: Addition[];
  sourceAnchors: string[];
}

declare const sessionBrand: unique symbol;

export type Session = Readonly<{
  readonly [sessionBrand]: true;
}>;

interface Snapshot {
  node: string;
  facts: Map<string, Scalar>;
  history: string[];
  uses: Map<string, number>;
}

export type StepResult =
  | { ok: true; session: Session }
  | {
      ok: false;
      code:
        | "INVALID_SESSION"
        | "UNKNOWN_CHOICE"
        | "ANOMALY_REQUIRED"
        | "ANOMALY_SCOPE"
        | "ANOMALY_TRANSITION"
        | "ANOMALY_LIMIT"
        | "ENTRY_REQUIREMENT";
    };

function key(subject: string, property: string): string {
  return JSON.stringify([subject, property]);
}

function unique(values: readonly string[], label: string): void {
  if (
    values.some(value => typeof value !== "string" || value.length === 0) ||
    new Set(values).size !== values.length
  ) {
    throw new TypeError(`${label} must be unique nonempty strings`);
  }
}

function scalar(value: unknown): value is Scalar {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

/**
 * Input is an authoring object, not arbitrary untrusted JSON.
 * This constructor checks semantic requirements used by this runtime.
 * A closed JSON Schema and supervised input limits remain integration work.
 */
export function createBranchingStory(input: Story) {
  const story = structuredClone(input);

  if (story.version !== "1.0.0") {
    throw new TypeError("Unsupported branching profile");
  }

  unique(story.nodes.map(node => node.id), "Node IDs");
  unique(story.anomalyRules.map(rule => rule.id), "Rule IDs");
  unique(story.sourceAnchors, "Source anchors");

  const nodes = new Map(story.nodes.map(node => [node.id, node]));
  const rules = new Map(story.anomalyRules.map(rule => [rule.id, rule]));
  const anchors = new Set(story.sourceAnchors);
  const claims = story.nodes.flatMap(node => node.claims);

  unique(claims.map(claim => claim.id), "Claim IDs");
  unique(story.additions.map(item => item.claim_id), "Addition claim IDs");

  const additions = new Map(
    story.additions.map(item => [item.claim_id, item])
  );

  if (!nodes.has(story.entry)) throw new TypeError("Unknown entry node");

  for (const claim of claims) {
    const addition = additions.get(claim.id);

    if (
      !claim.text ||
      !addition ||
      addition.origin !== "creative_addition" ||
      addition.basis !== "implementation_choice" ||
      addition.scene_anchors.length === 0 ||
      !addition.note ||
      addition.scene_anchors.some(anchor => !anchors.has(anchor))
    ) {
      throw new TypeError(`Untraceable creative claim: ${claim.id}`);
    }
  }

  if (additions.size !== claims.length) {
    throw new TypeError("Addition records must match claims exactly");
  }

  const controlled = new Set<string>();

  for (const rule of story.anomalyRules) {
    unique(rule.subjects, "Rule subjects");
    unique(rule.nodes, "Rule nodes");

    if (
      !rule.property ||
      rule.subjects.length === 0 ||
      rule.transitions.length === 0 ||
      !Number.isSafeInteger(rule.maxUses) ||
      rule.maxUses < 1 ||
      rule.nodes.some(node => !nodes.has(node)) ||
      rule.transitions.some(
        transition =>
          !scalar(transition.from) ||
          !scalar(transition.to) ||
          transition.from === transition.to
      )
    ) {
      throw new TypeError(`Invalid anomaly rule: ${rule.id}`);
    }

    for (const subject of rule.subjects) {
      controlled.add(key(subject, rule.property));
    }
  }

  for (const node of story.nodes) {
    unique(node.choices.map(choice => choice.id), "Choice IDs");

    for (const fact of node.requires) {
      if (!fact.subject || !fact.property || !scalar(fact.value)) {
        throw new TypeError("Invalid entry requirement");
      }
    }

    for (const choice of node.choices) {
      if (!nodes.has(choice.destination)) {
        throw new TypeError("Choice has unknown destination");
      }

      for (const operation of choice.operations) {
        if (operation.kind === "assign") {
          if (
            !operation.fact.subject ||
            !operation.fact.property ||
            !scalar(operation.fact.value)
          ) {
            throw new TypeError("Invalid ordinary assignment");
          }
        } else if (operation.kind === "anomaly") {
          if (
            !rules.has(operation.rule) ||
            !scalar(operation.from) ||
            !scalar(operation.to)
          ) {
            throw new TypeError("Invalid anomaly operation");
          }
        } else {
          throw new TypeError("Unsupported operation");
        }
      }
    }
  }

  const issued = new WeakMap<object, Snapshot>();

  function issue(snapshot: Snapshot): Session {
    const token = Object.freeze({}) as Session;
    issued.set(token, snapshot);
    return token;
  }

  function entrySatisfied(node: string, facts: Map<string, Scalar>): boolean {
    return nodes.get(node)!.requires.every(requirement =>
      facts.has(key(requirement.subject, requirement.property)) &&
      facts.get(key(requirement.subject, requirement.property)) ===
        requirement.value
    );
  }

  function start(): Session {
    const facts = new Map<string, Scalar>();

    for (const fact of story.initialFacts) {
      const address = key(fact.subject, fact.property);
      if (
        !fact.subject ||
        !fact.property ||
        !scalar(fact.value) ||
        facts.has(address)
      ) {
        throw new TypeError("Invalid or duplicate initial fact");
      }
      facts.set(address, fact.value);
    }

    if (!entrySatisfied(story.entry, facts)) {
      throw new TypeError("Initial state violates entry requirements");
    }

    return issue({
      node: story.entry,
      facts,
      history: [],
      uses: new Map()
    });
  }

  function inspect(session: Session) {
    const snapshot = issued.get(session);
    if (!snapshot) throw new TypeError("Invalid session");

    return {
      node: snapshot.node,
      claims: structuredClone(nodes.get(snapshot.node)!.claims),
      facts: [...snapshot.facts].map(([address, value]) => {
        const [subject, property] = JSON.parse(address) as [string, string];
        return { subject, property, value };
      }),
      history: [...snapshot.history],
      anomalyUses: [...snapshot.uses]
    };
  }

  function choose(session: Session, choiceId: string): StepResult {
    const current = issued.get(session);
    if (!current) return { ok: false, code: "INVALID_SESSION" };

    const node = nodes.get(current.node)!;
    const choice = node.choices.find(item => item.id === choiceId);
    if (!choice) return { ok: false, code: "UNKNOWN_CHOICE" };

    // Transactional candidate state. Failed choices change no issued state.
    const next: Snapshot = {
      node: choice.destination,
      facts: new Map(current.facts),
      history: [...current.history, `${current.node}:${choice.id}`],
      uses: new Map(current.uses)
    };

    for (const operation of choice.operations) {
      if (operation.kind === "assign") {
        const address = key(
          operation.fact.subject, operation.fact.property
        );

        if (controlled.has(address)) {
          return { ok: false, code: "ANOMALY_REQUIRED" };
        }

        next.facts.set(address, operation.fact.value);
        continue;
      }

      const rule = rules.get(operation.rule)!;
      if (
        !rule.subjects.includes(operation.subject) ||
        rule.property !== operation.property ||
        !rule.nodes.includes(current.node)
      ) {
        return { ok: false, code: "ANOMALY_SCOPE" };
      }

      const address = key(operation.subject, operation.property);
      if (
        !next.facts.has(address) ||
        next.facts.get(address) !== operation.from ||
        !rule.transitions.some(
          transition =>
            transition.from === operation.from &&
            transition.to === operation.to
        )
      ) {
        return { ok: false, code: "ANOMALY_TRANSITION" };
      }

      const count = next.uses.get(rule.id) ?? 0;
      if (count >= rule.maxUses) {
        return { ok: false, code: "ANOMALY_LIMIT" };
      }

      next.facts.set(address, operation.to);
      next.uses.set(rule.id, count + 1);
    }

    if (!entrySatisfied(next.node, next.facts)) {
      return { ok: false, code: "ENTRY_REQUIREMENT" };
    }

    return { ok: true, session: issue(next) };
  }

  return Object.freeze({ start, inspect, choose });
}
