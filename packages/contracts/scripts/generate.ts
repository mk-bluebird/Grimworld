import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Ajv2020 from "ajv/dist/2020.js";
import { compile } from "json-schema-to-typescript";

import { exportRelationalV1 } from "../src/relational-v1.ts";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const ATTRIBUTION =
  "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7";

const MANIFEST =
  "packages/contracts/generated/manifest.json";

const GENERATED_PATHS = [
  "packages/contracts/generated/relational-v1.schema.json",
  "packages/contracts/generated/scene.generated.ts",
  "lua/generated/relational-v1.lua"
] as const;

function sha256(bytes: Uint8Array | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Stable project serialization, not a claim of RFC 8785 compliance.
 * Does not normalize Unicode or reorder arrays.
 */
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
        .map(([key, child]) => [key, stable(child)])
    );
  }

  return value;
}

function json(value: unknown): string {
  return JSON.stringify(stable(value), null, 2) + "\n";
}

async function filesUnder(relative: string): Promise<string[]> {
  const absolute = path.join(ROOT, relative);
  const stat = await lstat(absolute);

  if (stat.isSymbolicLink()) {
    throw new Error(`Symlink not admitted: ${relative}`);
  }

  if (stat.isFile()) return [relative];
  if (!stat.isDirectory()) {
    throw new Error(`Unsupported source input: ${relative}`);
  }

  const result: string[] = [];
  const entries = await readdir(absolute);

  for (const name of entries.sort()) {
    result.push(...await filesUnder(
      path.posix.join(relative.replaceAll("\\", "/"), name)
    ));
  }

  return result;
}

async function sourceInputs(): Promise<string[]> {
  const inputs = [
    "package.json",
    "pnpm-workspace.yaml",
    "pnpm-lock.yaml",
    ...await filesUnder("packages/contracts/src"),
    ...await filesUnder("packages/contracts/scripts")
  ];

  // Workspace manifests participate in dependency/build identity.
  const packageEntries = await readdir(
    path.join(ROOT, "packages"),
    { withFileTypes: true }
  );

  for (const entry of packageEntries) {
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink package not admitted: ${entry.name}`);
    }

    if (!entry.isDirectory()) continue;

    const manifest = `packages/${entry.name}/package.json`;
    await lstat(path.join(ROOT, manifest));
    inputs.push(manifest);
  }

  return [...new Set(inputs)].sort();
}

async function inputIdentity(paths: string[]) {
  const hash = createHash("sha256");
  const inputs: Array<{
    path: string;
    bytes: number;
    sha256: string;
  }> = [];

  for (const relative of paths) {
    const stat = await lstat(path.join(ROOT, relative));
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`Input is not a regular file: ${relative}`);
    }

    const bytes = await readFile(path.join(ROOT, relative));
    const name = Buffer.from(relative, "utf8");

    // Length framing prevents concatenation ambiguity.
    hash.update(`${name.length}:`);
    hash.update(name);
    hash.update(`${bytes.length}:`);
    hash.update(bytes);

    inputs.push({
      path: relative,
      bytes: bytes.length,
      sha256: sha256(bytes)
    });
  }

  return {
    revision: hash.digest("hex"),
    inputs
  };
}

function enumValues(
  schema: Record<string, unknown>,
  definition: "basis" | "realm"
): string[] {
  const defs = schema.$defs as Record<string, unknown>;
  const node = definition === "basis"
    ? defs.basis
    : (
        (defs.entity as Record<string, unknown>)
          .properties as Record<string, unknown>
      ).realm;

  const values = (node as Record<string, unknown>).enum;

  assert(
    Array.isArray(values) &&
    values.every(value => typeof value === "string"),
    `Expected string enum: ${definition}`
  );

  return values;
}

function luaArray(values: string[]): string {
  // This descriptor permits only the current ASCII enum vocabulary.
  for (const value of values) {
    assert(/^[a-z_]+$/u.test(value), "Unsupported Lua descriptor value");
  }
  return "{ " + values.map(value => `"${value}"`).join(", ") + " }";
}

async function expectedArtifacts() {
  const identity = await inputIdentity(await sourceInputs());

  const schema = exportRelationalV1() as Record<string, unknown>;
  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  assert(ajv.validateSchema(schema), ajv.errorsText(ajv.errors));
  ajv.compile(schema);

  const schemaText = json(schema);
  const schemaDigest = sha256(schemaText);

  const typings = await compile(
    schema as Parameters<typeof compile>[0],
    "GrimloreRelationalArtwork",
    {
      inferStringEnumKeysFromValues: false,
      enableConstEnums: false,
      unknownAny: true,
      unreachableDefinitions: true,
      bannerComment:
        `/* Generated. Source revision: ${identity.revision}\n` +
        ` * SOVEREIGN-ATTRIBUTION: ${ATTRIBUTION}\n` +
        ` * Credit/metadata only; not authorization or execution evidence.\n` +
        ` */`
    }
  );

  const rootName = "GrimloreRelationalArtwork";
  assert(
    typings.includes(`export interface ${rootName}`) ||
    typings.includes(`export type ${rootName}`),
    "Unexpected generated root type"
  );

  const typesText = typings + `\nexport type Scene = ${rootName};\n`;

  const luaText = [
    "-- Generated descriptor, not a JSON Schema validator.",
    `-- SOVEREIGN-ATTRIBUTION: ${ATTRIBUTION}`,
    "-- Credit/metadata only; not authorization or execution evidence.",
    "return {",
    '  profile = "grimlore.relational-v1.descriptor",',
    `  contract_revision = "${identity.revision}",`,
    `  schema_sha256 = "${schemaDigest}",`,
    `  realm = ${luaArray(enumValues(schema, "realm"))},`,
    `  basis = ${luaArray(enumValues(schema, "basis"))}`,
    "}",
    ""
  ].join("\n");

  const outputs = new Map<string, string>([
    [GENERATED_PATHS[0], schemaText],
    [GENERATED_PATHS[1], typesText],
    [GENERATED_PATHS[2], luaText]
  ]);

  const artifacts = [...outputs].map(([relative, text]) => ({
    path: relative,
    bytes: Buffer.byteLength(text, "utf8"),
    sha256: sha256(text)
  }));

  outputs.set(MANIFEST, json({
    manifest_version: "1.0.0",
    attribution: ATTRIBUTION,
    contract_revision: identity.revision,
    revision_kind: "sha256_length_framed_source_closure",
    inputs: identity.inputs,
    artifacts
  }));

  return outputs;
}

async function compare(outputs: Map<string, string>): Promise<void> {
  const mismatches: string[] = [];

  for (const [relative, expected] of outputs) {
    try {
      const actual = await readFile(path.join(ROOT, relative));
      if (!actual.equals(Buffer.from(expected, "utf8"))) {
        mismatches.push(relative);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        mismatches.push(relative);
      } else {
        throw error;
      }
    }
  }

  if (mismatches.length > 0) {
    throw new Error(
      "Generated artifacts missing or stale:\n" +
      mismatches.map(item => `- ${item}`).join("\n")
    );
  }
}

async function writeOutputs(outputs: Map<string, string>): Promise<void> {
  // Manifest is last: interrupted generation cannot claim a complete new set.
  for (const [relative, content] of outputs) {
    const destination = path.join(ROOT, relative);
    await mkdir(path.dirname(destination), { recursive: true });

    const staged = `${destination}.${process.pid}.tmp`;

    try {
      await writeFile(staged, content, { encoding: "utf8", flag: "wx" });
      await rename(staged, destination);
    } finally {
      await rm(staged, { force: true });
    }
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (
    args.length !== 1 ||
    !["--write", "--check"].includes(args[0]!)
  ) {
    throw new Error("Usage: generate.ts --write | --check");
  }

  const outputs = await expectedArtifacts();

  if (args[0] === "--write") {
    await writeOutputs(outputs);
  } else {
    await compare(outputs);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
