import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  createPlacementBridge,
  PlacementError,
  validateConfig
} from "./bridge.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

function hash(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function percentile(values: number[], probability: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(
    0,
    Math.ceil(probability * sorted.length) - 1
  )]!;
}

async function main(): Promise<void> {
  const root = process.cwd();

  const [rngSource, placementSource, expected, expectedHash] =
    await Promise.all([
      readFile(path.join(root, "lua/rng.lua"), "utf8"),
      readFile(path.join(root, "lua/place_clay_houses.lua"), "utf8"),
      readFile(
        path.join(root, "tests/fixtures/clay-houses-v2.tsv"),
        "utf8"
      ),
      readFile(
        path.join(root, "tests/fixtures/clay-houses-v2.sha256"),
        "utf8"
      )
    ]);

  assert.equal(hash(expected), expectedHash.trim());

  const config = {
    seed: 1,
    count: 8,
    spacing: 24,
    jitter: 2,
    width: 12,
    origin_x: 0,
    origin_y: 0
  };

  for (const invalid of [
    undefined,
    {},
    { ...config, seed: 0 },
    { ...config, jitter: 1.5 },
    { ...config, spacing: 1 },
    { ...config, unexpected: true }
  ]) {
    assert.throws(
      () => validateConfig(invalid),
      error =>
        error instanceof PlacementError &&
        error.code === "CONFIG_INVALID"
    );
  }

  const bridge = createPlacementBridge({
    rngSource,
    rngSha256: hash(rngSource),
    placementSource,
    placementSha256: hash(placementSource)
  });

  const results = [];

  for (let index = 0; index < 21; index++) {
    const result = await bridge.generate(config);
    assert.equal(result.text, expected);
    assert.equal(result.sha256, expectedHash.trim());
    results.push(result);
  }

  const repeated = results.slice(1).map(result => result.timingsMs.total);

  const report = {
    attribution:
      "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7",
    status: "passed",
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
    runtime: results[0]!.runtime,
    sources: results[0]!.sources,
    fixtureSha256: expectedHash.trim(),
    firstRequestMs: results[0]!.timingsMs,
    subsequentRequests: {
      count: repeated.length,
      medianMs: percentile(repeated, 0.5),
      p95Ms: percentile(repeated, 0.95)
    },
    claimScope:
      "This fixture and recorded environment only. Descriptive timings; no production latency acceptance threshold applied."
  };

  const destination = path.join(root, "output/placement/bridge-report.json");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
