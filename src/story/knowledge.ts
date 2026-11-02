import Ajv2020 from "ajv/dist/2020.js";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

const REQUIREMENTS = [
  "viewpoint",
  "desire_or_pressure",
  "obstacle",
  "action_or_choice",
  "consequence",
  "continuing_question_or_resolution"
] as const;

interface InformationEvent {
  character: string;
  fact: string;
  event: string;
}

interface Edge {
  from: string;
  to: string;
}

interface Scene {
  schema_version: "1.0.0";
  scene_id: string;
  prose: string;
  annotations: Array<{
    requirement: typeof REQUIREMENTS[number];
    status: "present" | "absent" | "unclear";
    evidence: Array<{
      start_utf16: number;
      end_utf16: number;
      quote: string;
    }>;
    rationale: string;
  }>;
  characters: string[];
  facts: string[];
  events: string[];
  initial_information: Array<{
    character: string;
    fact: string;
    source_note: string;
  }>;
  acquisitions: InformationEvent[];
  uses: InformationEvent[];
  before: Edge[];
  causes: Edge[];
}

export interface Diagnostic {
  code:
    | "STRUCTURE"
    | "REQUIREMENT_SET"
    | "EVIDENCE_REQUIRED"
    | "EVIDENCE_MISMATCH"
    | "DANGLING_REFERENCE"
    | "TEMPORAL_CYCLE"
    | "EFFECT_BEFORE_CAUSE"
    | "CAUSAL_ORDER_UNESTABLISHED";
  path: string;
  message: string;
}

export interface KnowledgeFinding {
  useIndex: number;
  character: string;
  fact: string;
  event: string;
  status: "available" | "premature" | "unestablished" | "indeterminate";
}

export interface Analysis {
  diagnostics: Diagnostic[];
  knowledgeStatus: "evaluated" | "blocked";
  knowledge: KnowledgeFinding[];
}

function splitsSurrogate(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false;
  const left = text.charCodeAt(offset - 1);
  const right = text.charCodeAt(offset);

  return (
    left >= 0xd800 && left <= 0xdbff &&
    right >= 0xdc00 && right <= 0xdfff
  );
}

/**
 * Factory receives an application-approved schema.
 * Hard process/time/memory supervision is outside this module.
 */
export function createKnowledgeAnalyzer(schema: object) {
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  const structural = ajv.compile<Scene>(schema);

  return function analyze(input: unknown): Analysis {
    if (!structural(input)) {
      return {
        diagnostics: (structural.errors ?? []).map(error => ({
          code: "STRUCTURE",
          path: error.instancePath,
          message: `${error.keyword}: ${error.message ?? "invalid"}`
        })),
        knowledgeStatus: "blocked",
        knowledge: []
      };
    }

    const scene = input;
    const diagnostics: Diagnostic[] = [];

    const annotationNames = new Set(
      scene.annotations.map(annotation => annotation.requirement)
    );

    if (
      annotationNames.size !== REQUIREMENTS.length ||
      REQUIREMENTS.some(name => !annotationNames.has(name))
    ) {
      diagnostics.push({
        code: "REQUIREMENT_SET",
        path: "/annotations",
        message: "Each narrative requirement must appear exactly once"
      });
    }

    scene.annotations.forEach((annotation, i) => {
      if (
        annotation.status === "present" &&
        annotation.evidence.length === 0
      ) {
        diagnostics.push({
          code: "EVIDENCE_REQUIRED",
          path: `/annotations/${i}/evidence`,
          message: "Present annotations require prose evidence"
        });
      }

      annotation.evidence.forEach((span, j) => {
        if (
          span.start_utf16 >= span.end_utf16 ||
          span.end_utf16 > scene.prose.length ||
          splitsSurrogate(scene.prose, span.start_utf16) ||
          splitsSurrogate(scene.prose, span.end_utf16) ||
          scene.prose.slice(span.start_utf16, span.end_utf16) !== span.quote
        ) {
          diagnostics.push({
            code: "EVIDENCE_MISMATCH",
            path: `/annotations/${i}/evidence/${j}`,
            message: "Evidence must match an exact UTF-16 prose span"
          });
        }
      });
    });

    const characters = new Set(scene.characters);
    const facts = new Set(scene.facts);
    const events = new Set(scene.events);
    let graphBlocked = false;

    function reference(
      value: string,
      allowed: Set<string>,
      path: string
    ): void {
      if (!allowed.has(value)) {
        graphBlocked = true;
        diagnostics.push({
          code: "DANGLING_REFERENCE",
          path,
          message: `Unresolved reference: ${value}`
        });
      }
    }

    scene.initial_information.forEach((item, i) => {
      reference(
        item.character, characters, `/initial_information/${i}/character`
      );
      reference(item.fact, facts, `/initial_information/${i}/fact`);
    });

    for (const group of ["acquisitions", "uses"] as const) {
      scene[group].forEach((item, i) => {
        reference(item.character, characters, `/${group}/${i}/character`);
        reference(item.fact, facts, `/${group}/${i}/fact`);
        reference(item.event, events, `/${group}/${i}/event`);
      });
    }

    for (const group of ["before", "causes"] as const) {
      scene[group].forEach((edge, i) => {
        reference(edge.from, events, `/${group}/${i}/from`);
        reference(edge.to, events, `/${group}/${i}/to`);
      });
    }

    if (graphBlocked) {
      return { diagnostics, knowledgeStatus: "blocked", knowledge: [] };
    }

    const graph = new Map<string, Set<string>>();
    const indegree = new Map<string, number>();

    for (const event of events) {
      graph.set(event, new Set());
      indegree.set(event, 0);
    }

    for (const edge of scene.before) {
      const outgoing = graph.get(edge.from)!;
      if (!outgoing.has(edge.to)) {
        outgoing.add(edge.to);
        indegree.set(edge.to, indegree.get(edge.to)! + 1);
      }
    }

    const queue = [...events].filter(event => indegree.get(event) === 0);
    let visited = 0;

    for (let head = 0; head < queue.length; head++) {
      const event = queue[head]!;
      visited++;

      for (const next of graph.get(event)!) {
        const remaining = indegree.get(next)! - 1;
        indegree.set(next, remaining);
        if (remaining === 0) queue.push(next);
      }
    }

    if (visited !== events.size) {
      diagnostics.push({
        code: "TEMPORAL_CYCLE",
        path: "/before",
        message: "Strict narrative precedence contains a cycle"
      });
      return { diagnostics, knowledgeStatus: "blocked", knowledge: [] };
    }

    function precedes(from: string, to: string): boolean {
      const seen = new Set<string>();
      const stack = [...graph.get(from)!];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (current === to) return true;
        if (seen.has(current)) continue;
        seen.add(current);
        stack.push(...graph.get(current)!);
      }

      return false;
    }

    scene.causes.forEach((edge, i) => {
      if (edge.from === edge.to || precedes(edge.to, edge.from)) {
        diagnostics.push({
          code: "EFFECT_BEFORE_CAUSE",
          path: `/causes/${i}`,
          message: "Cause does not strictly precede its effect"
        });
      } else if (!precedes(edge.from, edge.to)) {
        diagnostics.push({
          code: "CAUSAL_ORDER_UNESTABLISHED",
          path: `/causes/${i}`,
          message: "Temporal precedence for this causal dependency is unestablished"
        });
      }
    });

    const knowledge: KnowledgeFinding[] = scene.uses.map((use, i) => {
      const initial = scene.initial_information.some(item =>
        item.character === use.character && item.fact === use.fact
      );

      const acquisitions = scene.acquisitions.filter(item =>
        item.character === use.character && item.fact === use.fact
      );

      let status: KnowledgeFinding["status"];

      if (
        initial ||
        acquisitions.some(item => precedes(item.event, use.event))
      ) {
        status = "available";
      } else if (acquisitions.length === 0) {
        status = "unestablished";
      } else if (
        acquisitions.every(item => precedes(use.event, item.event))
      ) {
        status = "premature";
      } else {
        status = "indeterminate";
      }

      return {
        useIndex: i,
        character: use.character,
        fact: use.fact,
        event: use.event,
        status
      };
    });

    return {
      diagnostics,
      knowledgeStatus: "evaluated",
      knowledge
    };
  };
}
