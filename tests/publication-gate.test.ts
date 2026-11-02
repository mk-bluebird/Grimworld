import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import {
  createPublicationGate,
  type PublicationPermit,
  type SupervisorReport,
  type TerminalStatus
} from "../src/publication/publication-gate.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

const config = {
  schemaDigest: "test-schema-digest",
  policyId: "grimlore.release.v1",
  validatorBuild: "test-build",
  checks: [
    { id: "structure", critical: true },
    { id: "references", critical: true }
  ],
  destinations: ["artworks/reviewed.scene.json"],
  maxInputBytes: 4096
} as const;

function report(bytes: Uint8Array): SupervisorReport {
  return {
    status: "valid",
    contentDigest: createHash("sha256").update(bytes).digest("hex"),
    schemaDigest: config.schemaDigest,
    policyId: config.policyId,
    validatorBuild: config.validatorBuild,
    checks: [
      { id: "structure", outcome: "pass" },
      { id: "references", outcome: "pass" }
    ]
  };
}

test("only issued, unconsumed permits publish exact bound content", async () => {
  const writes: string[] = [];

  const gate = createPublicationGate(
    config,
    { validate: async bytes => report(bytes) },
    async text => { writes.push(text); }
  );

  const text = '{"id":"widow"}';
  const prepared = await gate.prepare(
    text, "artworks/reviewed.scene.json"
  );

  assert.equal(prepared.ok, true);
  if (!prepared.ok) return;

  const results = await Promise.all([
    gate.publish(prepared.permit),
    gate.publish(prepared.permit)
  ]);

  assert.equal(results.filter(result => result.ok).length, 1);
  assert.equal(results.filter(result => !result.ok).length, 1);
  assert.deepEqual(writes, [text]);

  const forged = await gate.publish({} as PublicationPermit);
  assert.deepEqual(forged, {
    ok: false,
    code: "INVALID_OR_CONSUMED_PERMIT"
  });
});

test("all nonvalid terminal outcomes fail closed", async () => {
  const statuses: TerminalStatus[] = [
    "invalid",
    "input_limit_exceeded",
    "unsupported_schema",
    "validation_budget_exceeded",
    "worker_failed"
  ];

  for (const status of statuses) {
    let writes = 0;

    const gate = createPublicationGate(
      config,
      {
        validate: async bytes => ({
          ...report(bytes),
          status
        })
      },
      async () => { writes++; }
    );

    const result = await gate.prepare(
      "{}", "artworks/reviewed.scene.json"
    );

    assert.equal(result.ok, false);
    assert.equal(writes, 0);
  }
});

test("valid label cannot hide incomplete critical checks", async () => {
  for (const outcome of [
    "blocked_prerequisite",
    "budget_exhausted",
    "internal_error",
    "fail"
  ] as const) {
    const gate = createPublicationGate(
      config,
      {
        validate: async bytes => ({
          ...report(bytes),
          checks: [
            { id: "structure", outcome: "pass" },
            { id: "references", outcome }
          ]
        })
      },
      async () => {
        assert.fail("Publication must not occur");
      }
    );

    const result = await gate.prepare(
      "{}", "artworks/reviewed.scene.json"
    );

    assert.equal(result.ok, false);
  }
});

test("report identity, registry multiplicity, and bytes are checked", async () => {
  const mutations = [
    (r: SupervisorReport) => ({ ...r, contentDigest: "wrong" }),
    (r: SupervisorReport) => ({ ...r, policyId: "older-policy" }),
    (r: SupervisorReport) => ({
      ...r,
      checks: [r.checks[0]!, r.checks[0]!]
    }),
    (r: SupervisorReport) => ({
      ...r,
      checks: [r.checks[0]!]
    })
  ];

  for (const mutate of mutations) {
    const gate = createPublicationGate(
      config,
      { validate: async bytes => mutate(report(bytes)) },
      async () => { assert.fail("Unexpected publication"); }
    );

    assert.equal(
      (await gate.prepare(
        "{}", "artworks/reviewed.scene.json"
      )).ok,
      false
    );
  }
});

test("worker rejection remains a distinct failure", async () => {
  const gate = createPublicationGate(
    config,
    {
      validate: async () => {
        throw new Error("Worker terminated");
      }
    },
    async () => { assert.fail("Unexpected publication"); }
  );

  assert.deepEqual(
    await gate.prepare("{}", "artworks/reviewed.scene.json"),
    {
      ok: false,
      code: "WORKER_FAILED",
      status: "worker_failed"
    }
  );
});

test("permits do not transfer between gate instances", async () => {
  const supervisor = { validate: async (b: Uint8Array) => report(b) };
  const sink = async () => {};

  const a = createPublicationGate(config, supervisor, sink);
  const b = createPublicationGate(config, supervisor, sink);

  const prepared = await a.prepare(
    "{}", "artworks/reviewed.scene.json"
  );

  assert(prepared.ok);

  assert.deepEqual(await b.publish(prepared.permit), {
    ok: false,
    code: "INVALID_OR_CONSUMED_PERMIT"
  });

  assert.equal((await a.publish(prepared.permit)).ok, true);
});

test("sink failure consumes the permit without implying rollback", async () => {
  let attempts = 0;

  const gate = createPublicationGate(
    config,
    { validate: async bytes => report(bytes) },
    async () => {
      attempts++;
      throw new Error("Sink failed");
    }
  );

  const prepared = await gate.prepare(
    "{}", "artworks/reviewed.scene.json"
  );
  assert(prepared.ok);

  assert.deepEqual(await gate.publish(prepared.permit), {
    ok: false,
    code: "PUBLICATION_FAILED"
  });

  assert.deepEqual(await gate.publish(prepared.permit), {
    ok: false,
    code: "INVALID_OR_CONSUMED_PERMIT"
  });

  assert.equal(attempts, 1);
});
