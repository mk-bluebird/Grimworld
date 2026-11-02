import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

import Ajv2020 from "ajv/dist/2020.js";
import { compile } from "json-schema-to-typescript";
import ts from "typescript";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Document credit and configured workstream metadata only.
 * Not identity verification, consent, authorization, or execution evidence.
 */

const ATTRIBUTION =
  "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7";

const ROOT = process.cwd();

const SCHEMA_PATH = path.resolve(
  ROOT,
  "schemas/grimlore-relational-artwork.schema.json"
);

const INSTANCE_PATH = path.resolve(
  ROOT,
  "artworks/river-village-invitation/" +
    "river-village-invitation.scene.json"
);

const OUTPUT_PATH = path.resolve(ROOT, "types/scene.generated.ts");

const EXPECTED_REALMS = [
  "living",
  "parallel",
  "river",
  "boundary",
  "unspecified"
];

const EXPECTED_BASES = [
  "explicit_description",
  "derived_interpretation",
  "implementation_choice"
];

type JsonObject = Record<string, unknown>;

function object(value: unknown, label: string): JsonObject {
  assert(
    typeof value === "object" &&
      value !== null &&
      !Array.isArray(value),
    `${label} must be an object`
  );

  return value as JsonObject;
}

function array(value: unknown, label: string): unknown[] {
  assert(Array.isArray(value), `${label} must be an array`);
  return value;
}

function sameStringSet(
  value: unknown,
  expected: string[],
  label: string
): void {
  const values = array(value, label);

  assert(
    values.every((item) => typeof item === "string"),
    `${label} must contain only strings`
  );

  assert.deepEqual(
    [...values].sort(),
    [...expected].sort(),
    `${label} differs from the expected contract`
  );
}

async function readJson(filename: string): Promise<unknown> {
  const text = await readFile(filename, "utf8");

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON in ${filename}`, { cause: error });
  }
}

function mutateFirstEntity(
  instance: JsonObject,
  patch: JsonObject
): JsonObject {
  const copy = structuredClone(instance);
  const entities = array(copy.entities, "instance.entities");

  assert(entities.length > 0, "The test instance needs an entity");

  Object.assign(object(entities[0], "instance.entities[0]"), patch);
  return copy;
}

function literalUnion(values: string[]): string {
  return values.map((value) => JSON.stringify(value)).join(" | ");
}

function verifyContractShape(schema: JsonObject): void {
  assert.equal(
    schema.$schema,
    "https://json-schema.org/draft/2020-12/schema",
    "Expected the original draft 2020-12 contract"
  );

  assert.equal(
    schema.additionalProperties,
    false,
    "The root contract must remain closed"
  );

  const defs = object(schema.$defs, "schema.$defs");

  for (const name of ["entity", "relationship", "basis", "idList"]) {
    assert(name in defs, `Missing $defs.${name}`);
  }

  // Only the object definitions are closed. basis and idList are
  // respectively an enum and an array definition.
  for (const name of ["entity", "relationship"]) {
    const definition = object(defs[name], `$defs.${name}`);

    assert.equal(
      definition.additionalProperties,
      false,
      `$defs.${name} must remain closed`
    );
  }

  const entity = object(defs.entity, "$defs.entity");
  const properties = object(
    entity.properties,
    "$defs.entity.properties"
  );
  const realm = object(
    properties.realm,
    "$defs.entity.properties.realm"
  );
  const basis = object(defs.basis, "$defs.basis");

  sameStringSet(realm.enum, EXPECTED_REALMS, "realm enum");
  sameStringSet(basis.enum, EXPECTED_BASES, "basis enum");
}

const compilerOptions: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.CommonJS,
  moduleResolution: ts.ModuleResolutionKind.Node10,
  strict: true,
  exactOptionalPropertyTypes: true,
  noEmit: true,
  skipLibCheck: false,
  types: []
};

function compileFixture(filename: string): readonly ts.Diagnostic[] {
  const program = ts.createProgram([filename], compilerOptions);
  return ts.getPreEmitDiagnostics(program);
}

function diagnosticsText(
  diagnostics: readonly ts.Diagnostic[]
): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (filename) => filename,
    getCurrentDirectory: () => ROOT,
    getNewLine: () => "\n"
  });
}

function fixtureHeader(): string {
  return `import type { Scene } from "./scene.generated";\n`;
}

async function expectCompileSuccess(
  directory: string,
  filename: string,
  source: string
): Promise<void> {
  const fullPath = path.join(directory, filename);
  await writeFile(fullPath, source, "utf8");

  const diagnostics = compileFixture(fullPath);

  assert.equal(
    diagnostics.length,
    0,
    `${filename} unexpectedly failed:\n${diagnosticsText(diagnostics)}`
  );
}

async function expectCompileFailure(
  directory: string,
  filename: string,
  source: string
): Promise<void> {
  const fullPath = path.join(directory, filename);
  await writeFile(fullPath, source, "utf8");

  const diagnostics = compileFixture(fullPath);

  assert(
    diagnostics.length > 0,
    `${filename} unexpectedly compiled successfully`
  );

  // A missing module or unrelated environment failure is not evidence
  // that the intended mutation was rejected.
  assert(
    diagnostics.every(
      (diagnostic) =>
        diagnostic.file !== undefined &&
        path.resolve(diagnostic.file.fileName) ===
          path.resolve(fullPath) &&
        [2322, 2353, 1360].includes(diagnostic.code)
    ),
    `${filename} failed for an unexpected reason:\n` +
      diagnosticsText(diagnostics)
  );
}

async function main(): Promise<void> {
  const schema = object(await readJson(SCHEMA_PATH), "schema");
  const instance = object(await readJson(INSTANCE_PATH), "instance");

  verifyContractShape(schema);

  const ajv = new Ajv2020({
    strict: true,
    allErrors: true,
    coerceTypes: false,
    useDefaults: false,
    removeAdditional: false
  });

  assert(
    ajv.validateSchema(schema),
    `Invalid schema:\n${ajv.errorsText(ajv.errors)}`
  );

  const validate = ajv.compile(schema);

  assert(
    validate(instance),
    `Supplied instance is invalid:\n${ajv.errorsText(validate.errors)}`
  );

  const invalidRealm = mutateFirstEntity(instance, {
    realm: "afterlife"
  });

  const invalidBasis = mutateFirstEntity(instance, {
    basis: "unverified"
  });

  const extraProperty = mutateFirstEntity(instance, {
    unexpected_contract_property: true
  });

  const runtimeCases = [
    {
      name: "realm mutation",
      value: invalidRealm,
      keyword: "enum",
      instancePath: "/entities/0/realm"
    },
    {
      name: "basis mutation",
      value: invalidBasis,
      keyword: "enum",
      instancePath: "/entities/0/basis"
    },
    {
      name: "extra entity property",
      value: extraProperty,
      keyword: "additionalProperties",
      instancePath: "/entities/0"
    }
  ];

  for (const test of runtimeCases) {
    assert.equal(
      validate(test.value),
      false,
      `${test.name} unexpectedly passed runtime validation`
    );

    assert(
      validate.errors?.some(
        (error) =>
          error.keyword === test.keyword &&
          error.instancePath === test.instancePath
      ),
      `${test.name} did not produce its expected runtime error`
    );
  }

  const schemaHash = createHash("sha256")
    .update(JSON.stringify(schema))
    .digest("hex");

  // compile() accepts the original $defs pointers. The cast bridges the
  // library's older schema typing; it does not rewrite the schema dialect.
  const generated = await compile(
    structuredClone(schema) as Parameters<typeof compile>[0],
    "Scene",
    {
      cwd: path.dirname(SCHEMA_PATH),
      customName: (node) => (node === undefined ? undefined : undefined),
      inferStringEnumKeysFromValues: false,
      enableConstEnums: false,
      unreachableDefinitions: true,
      unknownAny: true,
      bannerComment: [
        "/*",
        " * Generated file. Do not edit manually.",
        " * Source: schemas/grimlore-relational-artwork.schema.json",
        ` * Schema SHA-256: ${schemaHash}`,
        ` * SOVEREIGN-ATTRIBUTION: ${ATTRIBUTION}`,
        " * Attribution is credit/metadata, not authorization.",
        " */"
      ].join("\n")
    }
  );

  // The source schema's title determines the generated root name.
  // Expose one stable public alias without altering that schema.
  const rootName = "GrimloreRelationalArtwork";
  assert(
    generated.includes(`export interface ${rootName}`) ||
      generated.includes(`export type ${rootName}`),
    `Expected generated root declaration ${rootName}`
  );

  const output =
    generated +
    `\nexport type Scene = ${rootName};\n`;

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "grimlore-scene-types-")
  );

  try {
    await writeFile(
      path.join(temporaryDirectory, "scene.generated.ts"),
      output,
      "utf8"
    );

    await expectCompileSuccess(
      temporaryDirectory,
      "positive.ts",
      fixtureHeader() +
        `const scene: Scene = ${JSON.stringify(instance, null, 2)};\n` +
        "void scene;\n"
    );

    await expectCompileSuccess(
      temporaryDirectory,
      "exact-unions.ts",
      fixtureHeader() +
        `
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2)
    ? true
    : false;

type Expect<T extends true> = T;
type Entity = Scene["entities"][number];

type RealmCheck = Expect<Equal<
  Entity["realm"],
  ${literalUnion(EXPECTED_REALMS)}
>>;

type EntityBasisCheck = Expect<Equal<
  Entity["basis"],
  ${literalUnion(EXPECTED_BASES)}
>>;

type RelationshipBasisCheck = Expect<Equal<
  Scene["relationships"][number]["basis"],
  ${literalUnion(EXPECTED_BASES)}
>>;

type ConstraintBasisCheck = Expect<Equal<
  Scene["constraints"][number]["basis"],
  ${literalUnion(EXPECTED_BASES)}
>>;

type ClosedEntityCheck = Expect<Equal<
  string extends keyof Entity ? true : false,
  false
>>;

type ClosedRelationshipCheck = Expect<Equal<
  string extends keyof Scene["relationships"][number]
    ? true : false,
  false
>>;
`
    );

    for (const [filename, value] of [
      ["invalid-realm.ts", invalidRealm],
      ["invalid-basis.ts", invalidBasis],
      ["extra-property.ts", extraProperty]
    ] as const) {
      await expectCompileFailure(
        temporaryDirectory,
        filename,
        fixtureHeader() +
          `const scene: Scene = ${JSON.stringify(value, null, 2)};\n` +
          "void scene;\n"
      );
    }

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });

    // Stage beside the destination so publication is a same-directory
    // rename. Failed verification never overwrites the existing output.
    const stagedPath =
      `${OUTPUT_PATH}.${process.pid}.tmp`;

    try {
      await writeFile(stagedPath, output, "utf8");
      await rename(stagedPath, OUTPUT_PATH);
    } finally {
      await rm(stagedPath, { force: true });
    }

    console.log(
      [
        "PASS: original schema and populated instance",
        "PASS: exact realm and basis literal unions",
        "PASS: compile-time rejection of realm/basis mutations",
        "PASS: compile-time rejection of a fresh extra entity property",
        "PASS: runtime rejection of all three mutations",
        `Generated: ${path.relative(ROOT, OUTPUT_PATH)}`
      ].join("\n")
    );
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
