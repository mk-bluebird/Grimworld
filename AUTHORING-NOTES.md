# Grimlore authoring slice

SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7

Credit/workstream metadata only; not identity, consent, authorization, or execution evidence.

## Scope
Full proposed source files; TypeScript was not executed here. Builder consumes generated Scene types from types/scene.generated.ts. Test fixture targets the original unversioned scene contract. Regenerated v2 types require a v2 base fixture, not an assertion hiding the difference.

## Install/run
Use the existing lockfile with @sinclair/typebox 0.34.41, Ajv 8, TypeScript, tsx, and @types/node.

`npx tsx scripts/check-contract-source.ts PATH_TO_RETAINED_ORIGINAL_V1_SCHEMA`

`npx tsx --test tests/scene-builder.test.ts`

`npx tsc --noEmit` under a configuration permitting .ts imports.

## Single source and migration
The TypeBox source reconstructs the original v1 contract only. It intentionally does not overwrite a migrated v2 contract. Type.Ref plus explicit $defs retain local pointer references. Its serialized JSON is the source for the existing json-schema-to-typescript generator. Structural snapshot normalization removes only listed redundant forms in this restricted subset; it is not a general JSON Schema equivalence procedure. Passing comparison is required before generation output is written. Native TypeBox compilation of this exported pointer-based schema is a separate parity lane, not claimed here. Test the native validator's reference setup independently.

## Authoring boundary
Handles are checked by runtime identity per builder. Raw composition IDs, support citations, attribute dictionaries, and qualifiers still require the composed validator. Supply the complete validation pipeline, with its fixed expected critical-check registry. The builder's acceptance helper does not independently know which checks an adapter omitted. It trusts application adapter output and is not a security/publication capability. Invalid authoring mutations throw declared AuthoringError codes; validator operational errors propagate rather than becoming validation success. build returns isolated snapshots and does not mutate candidate data through validator callbacks.

## Diagnostics
Catalog defaults are code-specific, not phase-wide. Invalid structure, dangling IDs, hard correspondence violations, and missing required supports are errors. Interpretive review and noncritical indeterminate comparisons are warnings. A critical check that cannot run still blocks acceptance regardless of warning severity. Information records do not repair errors. Native validator codes need explicit mapped adapters; unmapped keywords must fail mapping rather than masquerading as a known code. Generated diagnostic catalog is versioned output of catalog.ts.

## Evidence pending
No authoring-study error-rate reduction is claimed. Test-double callbacks in builder tests do not establish complete pipeline validity. Run schema baseline comparison, TypeScript checking, runtime tests, and an independent authoring study before release.
