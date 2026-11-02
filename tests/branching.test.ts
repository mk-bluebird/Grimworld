import assert from "node:assert/strict";
import { test } from "node:test";

import {
  createBranchingStory,
  type Story
} from "../src/story/branching.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

function fixture(): Story {
  const claims = [
    {
      id: "choice-pause",
      text: "The widow pauses before deciding what to examine."
    },
    {
      id: "choice-inspect",
      text: "She studies the open doorway without crossing."
    },
    {
      id: "choice-listen",
      text: "She listens beside the river without crossing."
    },
    {
      id: "rejoin-wait",
      text: "Afterward, she remains on the near bank."
    }
  ];

  return {
    version: "1.0.0",
    entry: "decision",
    initialFacts: [
      { subject: "widow", property: "bank", value: "near" },
      {
        subject: "widow_reflection",
        property: "depicted_pose",
        value: "stepped_forward"
      }
    ],
    sourceAnchors: [
      "entity:widow",
      "entity:river",
      "entity:far_doorway",
      "entity:widow_reflection"
    ],
    additions: claims.map(claim => ({
      claim_id: claim.id,
      origin: "creative_addition",
      basis: "implementation_choice",
      scene_anchors: [
        "entity:widow",
        "entity:river",
        "entity:far_doorway"
      ],
      note: "Hypothetical continuation; not an event established by the artwork."
    })),
    anomalyRules: [{
      id: "reflection_pose_exception",
      subjects: ["widow_reflection"],
      property: "depicted_pose",
      transitions: [{
        from: "stepped_forward",
        to: "at_submerged_doorstep"
      }],
      nodes: ["waiting"],
      maxUses: 1
    }],
    nodes: [
      {
        id: "decision",
        claims: [claims[0]!],
        requires: [
          { subject: "widow", property: "bank", value: "near" }
        ],
        choices: [
          {
            id: "inspect",
            label: "Study the doorway",
            destination: "inspect",
            operations: []
          },
          {
            id: "listen",
            label: "Listen beside the river",
            destination: "listen",
            operations: []
          }
        ]
      },
      {
        id: "inspect",
        claims: [claims[1]!],
        requires: [],
        choices: [{
          id: "wait",
          label: "Remain",
          destination: "waiting",
          operations: []
        }]
      },
      {
        id: "listen",
        claims: [claims[2]!],
        requires: [],
        choices: [{
          id: "wait",
          label: "Remain",
          destination: "waiting",
          operations: []
        }]
      },
      {
        id: "waiting",
        claims: [claims[3]!],
        requires: [
          { subject: "widow", property: "bank", value: "near" }
        ],
        choices: [{
          id: "reflection-only",
          label: "Continue the reflection motif",
          destination: "waiting",
          operations: [{
            kind: "anomaly",
            rule: "reflection_pose_exception",
            subject: "widow_reflection",
            property: "depicted_pose",
            from: "stepped_forward",
            to: "at_submerged_doorstep"
          }]
        }]
      }
    ]
  };
}

test("two branches rejoin without combining histories", () => {
  const runtime = createBranchingStory(fixture());
  const initial = runtime.start();

  const left = runtime.choose(initial, "inspect");
  const right = runtime.choose(initial, "listen");
  assert(left.ok && right.ok);

  const leftJoin = runtime.choose(left.session, "wait");
  const rightJoin = runtime.choose(right.session, "wait");
  assert(leftJoin.ok && rightJoin.ok);

  const a = runtime.inspect(leftJoin.session);
  const b = runtime.inspect(rightJoin.session);

  assert.equal(a.node, "waiting");
  assert.equal(b.node, "waiting");
  assert.deepEqual(a.facts, b.facts);
  assert.notDeepEqual(a.history, b.history);
});

test("source anchors do not replace addition records", () => {
  const story = fixture();
  story.additions.pop();

  assert.throws(
    () => createBranchingStory(story),
    /Untraceable creative claim/
  );
});

test("reflection exception does not propagate to its owner", () => {
  const story = fixture();
  const waiting = story.nodes.find(node => node.id === "waiting")!;
  const operation = waiting.choices[0]!.operations[0]!;

  assert.equal(operation.kind, "anomaly");
  if (operation.kind !== "anomaly") throw new Error("Wrong fixture");
  operation.subject = "widow";

  const runtime = createBranchingStory(story);
  const first = runtime.choose(runtime.start(), "inspect");
  assert(first.ok);
  const joined = runtime.choose(first.session, "wait");
  assert(joined.ok);

  assert.deepEqual(
    runtime.choose(joined.session, "reflection-only"),
    { ok: false, code: "ANOMALY_SCOPE" }
  );
});

test("anomaly-controlled fields cannot use ordinary assignment", () => {
  const story = fixture();
  const waiting = story.nodes.find(node => node.id === "waiting")!;

  waiting.choices[0]!.operations = [{
    kind: "assign",
    fact: {
      subject: "widow_reflection",
      property: "depicted_pose",
      value: "at_submerged_doorstep"
    }
  }];

  const runtime = createBranchingStory(story);
  const first = runtime.choose(runtime.start(), "listen");
  assert(first.ok);
  const joined = runtime.choose(first.session, "wait");
  assert(joined.ok);

  assert.deepEqual(
    runtime.choose(joined.session, "reflection-only"),
    { ok: false, code: "ANOMALY_REQUIRED" }
  );
});

test("a branch that crossed cannot enter the near-bank rejoin", () => {
  const story = fixture();
  story.nodes.find(node => node.id === "inspect")!
    .choices[0]!.operations = [{
      kind: "assign",
      fact: { subject: "widow", property: "bank", value: "far" }
    }];

  const runtime = createBranchingStory(story);
  const first = runtime.choose(runtime.start(), "inspect");
  assert(first.ok);

  assert.deepEqual(runtime.choose(first.session, "wait"), {
    ok: false,
    code: "ENTRY_REQUIREMENT"
  });
});
