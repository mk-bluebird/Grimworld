/** SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { exportRelationalV1, normalizeSnapshot } from "../packages/contracts/src/relational-v1.ts";
import { CATALOG_VERSION, CATALOG } from "../src/diagnostics/catalog.ts";

async function main() {
  const baselinePath = process.argv[2];
  if (!baselinePath || process.argv.length !== 3) throw new Error("Usage: check-contract-source.ts <original-v1-schema.json>");
  const baseline = JSON.parse(await readFile(baselinePath, "utf8"));
  const generated = exportRelationalV1();
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  assert(ajv.validateSchema(generated), ajv.errorsText(ajv.errors));
  ajv.compile(generated);
  assert.deepEqual(normalizeSnapshot(generated), normalizeSnapshot(baseline),
    "Historical v1 baseline differs; do not silently approve or replace it");
  const output = "output/contracts";
  await mkdir(output, { recursive: true });
  await writeFile(path.join(output, "relational-v1.schema.json"), JSON.stringify(generated, null, 2)+"\n");
  await writeFile(path.join(output, "diagnostic-catalog.json"), JSON.stringify({ version: CATALOG_VERSION, codes: CATALOG }, null, 2)+"\n");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
