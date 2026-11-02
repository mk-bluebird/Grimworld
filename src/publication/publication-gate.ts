import { createHash } from "node:crypto";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Document credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export type CheckOutcome =
  | "pass"
  | "fail"
  | "blocked_prerequisite"
  | "budget_exhausted"
  | "internal_error";

export type TerminalStatus =
  | "valid"
  | "invalid"
  | "input_limit_exceeded"
  | "unsupported_schema"
  | "validation_budget_exceeded"
  | "worker_failed";

export interface CheckDefinition {
  readonly id: string;
  readonly critical: boolean;
}

export interface CheckResult {
  readonly id: string;
  readonly outcome: CheckOutcome;
}

export interface SupervisorReport {
  readonly status: TerminalStatus;
  readonly contentDigest: string;
  readonly schemaDigest: string;
  readonly policyId: string;
  readonly validatorBuild: string;
  readonly checks: readonly CheckResult[];
}

/**
 * Trusted application adapter.
 *
 * It must supervise validation, enforce actual execution budgets, and
 * bind its report to the exact bytes passed to validate().
 *
 * No model, OCR result, receipt payload, or request body may supply this
 * adapter or its implementation.
 */
export interface ValidationSupervisor {
  validate(bytes: Uint8Array): Promise<unknown>;
}

export interface GateConfiguration {
  readonly schemaDigest: string;
  readonly policyId: string;
  readonly validatorBuild: string;
  readonly checks: readonly CheckDefinition[];
  readonly destinations: readonly string[];
  readonly maxInputBytes: number;
}

export interface PublicationRecord {
  readonly destination: string;
  readonly contentDigest: string;
  readonly schemaDigest: string;
  readonly policyId: string;
  readonly validatorBuild: string;
}

/**
 * The sink is trusted application code.
 * Its own filesystem/network authorization remains its responsibility.
 */
export type PublicationSink = (
  text: string,
  record: Readonly<PublicationRecord>
) => Promise<void>;

declare const permitBrand: unique symbol;

export type PublicationPermit = Readonly<{
  readonly [permitBrand]: true;
}>;

export type DenialCode =
  | "DESTINATION_DENIED"
  | "INPUT_LIMIT_EXCEEDED"
  | "INVALID_UNICODE"
  | "WORKER_FAILED"
  | "MALFORMED_REPORT"
  | "VALIDATION_NOT_VALID"
  | "REPORT_IDENTITY_MISMATCH"
  | "CHECK_SET_MISMATCH"
  | "CHECK_FAILED"
  | "CRITICAL_CHECK_INCOMPLETE"
  | "INVALID_OR_CONSUMED_PERMIT"
  | "PUBLICATION_FAILED";

export type PreparationResult =
  | { readonly ok: true; readonly permit: PublicationPermit }
  | {
      readonly ok: false;
      readonly code: DenialCode;
      readonly status?: TerminalStatus;
    };

export type PublicationResult =
  | { readonly ok: true; readonly contentDigest: string }
  | { readonly ok: false; readonly code: DenialCode };

const STATUSES = new Set<string>([
  "valid",
  "invalid",
  "input_limit_exceeded",
  "unsupported_schema",
  "validation_budget_exceeded",
  "worker_failed"
]);

const OUTCOMES = new Set<string>([
  "pass",
  "fail",
  "blocked_prerequisite",
  "budget_exhausted",
  "internal_error"
]);

function record(value: unknown): Record<string, unknown> | undefined {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function parseReport(input: unknown): SupervisorReport | undefined {
  const value = record(input);
  if (!value) return undefined;

  if (
    typeof value.status !== "string" ||
    !STATUSES.has(value.status) ||
    typeof value.contentDigest !== "string" ||
    typeof value.schemaDigest !== "string" ||
    typeof value.policyId !== "string" ||
    typeof value.validatorBuild !== "string" ||
    !Array.isArray(value.checks)
  ) {
    return undefined;
  }

  const checks: CheckResult[] = [];

  for (const item of value.checks) {
    const check = record(item);

    if (
      !check ||
      typeof check.id !== "string" ||
      typeof check.outcome !== "string" ||
      !OUTCOMES.has(check.outcome)
    ) {
      return undefined;
    }

    checks.push({
      id: check.id,
      outcome: check.outcome as CheckOutcome
    });
  }

  return {
    status: value.status as TerminalStatus,
    contentDigest: value.contentDigest,
    schemaDigest: value.schemaDigest,
    policyId: value.policyId,
    validatorBuild: value.validatorBuild,
    checks
  };
}

function hasLoneSurrogate(text: string): boolean {
  for (let index = 0; index < text.length; index++) {
    const unit = text.charCodeAt(index);

    if (unit >= 0xd800 && unit <= 0xdbff) {
      const next = text.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      index++;
    } else if (unit >= 0xdc00 && unit <= 0xdfff) {
      return true;
    }
  }

  return false;
}

function digest(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function createPublicationGate(
  configuration: GateConfiguration,
  supervisor: ValidationSupervisor,
  sink: PublicationSink
) {
  if (
    !Number.isSafeInteger(configuration.maxInputBytes) ||
    configuration.maxInputBytes < 1
  ) {
    throw new TypeError("maxInputBytes must be a positive safe integer");
  }

  const config = {
    schemaDigest: configuration.schemaDigest,
    policyId: configuration.policyId,
    validatorBuild: configuration.validatorBuild,
    maxInputBytes: configuration.maxInputBytes
  };

  const definitions = configuration.checks.map(check => ({
    id: check.id,
    critical: check.critical
  }));

  if (
    definitions.length === 0 ||
    definitions.some(check =>
      typeof check.id !== "string" ||
      check.id.length === 0 ||
      typeof check.critical !== "boolean"
    ) ||
    new Set(definitions.map(check => check.id)).size !== definitions.length
  ) {
    throw new TypeError("Check registry must have unique nonempty IDs");
  }

  const destinations = new Set(configuration.destinations);
  const expectedChecks = new Map(
    definitions.map(check => [check.id, check])
  );

  // Capture adapter methods during trusted application initialization.
  const validate = supervisor.validate.bind(supervisor);
  const publishToSink = sink;

  const issued = new WeakMap<object, {
    text: string;
    publication: Readonly<PublicationRecord>;
  }>();

  async function prepare(
    text: string,
    destination: string
  ): Promise<PreparationResult> {
    if (!destinations.has(destination)) {
      return { ok: false, code: "DESTINATION_DENIED" };
    }

    if (typeof text !== "string" || hasLoneSurrogate(text)) {
      return { ok: false, code: "INVALID_UNICODE" };
    }

    // Reject before creating the encoded copy.
    if (Buffer.byteLength(text, "utf8") > config.maxInputBytes) {
      return { ok: false, code: "INPUT_LIMIT_EXCEEDED" };
    }

    const bytes = Buffer.from(text, "utf8");
    const contentDigest = digest(bytes);

    let raw: unknown;
    try {
      // The adapter gets its own byte snapshot.
      raw = await validate(Uint8Array.from(bytes));
    } catch {
      return {
        ok: false,
        code: "WORKER_FAILED",
        status: "worker_failed"
      };
    }

    let report: SupervisorReport | undefined;
    try {
      report = parseReport(raw);
    } catch {
      return { ok: false, code: "MALFORMED_REPORT" };
    }

    if (!report) {
      return { ok: false, code: "MALFORMED_REPORT" };
    }

    if (report.status !== "valid") {
      return {
        ok: false,
        code:
          report.status === "worker_failed"
            ? "WORKER_FAILED"
            : "VALIDATION_NOT_VALID",
        status: report.status
      };
    }

    if (
      report.contentDigest !== contentDigest ||
      report.schemaDigest !== config.schemaDigest ||
      report.policyId !== config.policyId ||
      report.validatorBuild !== config.validatorBuild
    ) {
      return { ok: false, code: "REPORT_IDENTITY_MISMATCH" };
    }

    const results = new Map<string, CheckResult>();

    for (const check of report.checks) {
      if (
        !expectedChecks.has(check.id) ||
        results.has(check.id)
      ) {
        return { ok: false, code: "CHECK_SET_MISMATCH" };
      }
      results.set(check.id, check);
    }

    if (results.size !== expectedChecks.size) {
      return { ok: false, code: "CHECK_SET_MISMATCH" };
    }

    for (const definition of definitions) {
      const outcome = results.get(definition.id)!.outcome;

      if (outcome === "fail") {
        return { ok: false, code: "CHECK_FAILED" };
      }

      if (definition.critical && outcome !== "pass") {
        return { ok: false, code: "CRITICAL_CHECK_INCOMPLETE" };
      }

      // Operational incompleteness is never silently accepted,
      // including on noncritical checks.
      if (
        outcome === "budget_exhausted" ||
        outcome === "internal_error"
      ) {
        return { ok: false, code: "VALIDATION_NOT_VALID" };
      }
    }

    const permit = Object.freeze({}) as PublicationPermit;

    issued.set(permit, {
      text,
      publication: Object.freeze({
        destination,
        contentDigest,
        schemaDigest: config.schemaDigest,
        policyId: config.policyId,
        validatorBuild: config.validatorBuild
      })
    });

    return { ok: true, permit };
  }

  async function publish(
    permit: PublicationPermit
  ): Promise<PublicationResult> {
    if (
      permit === null ||
      typeof permit !== "object"
    ) {
      return { ok: false, code: "INVALID_OR_CONSUMED_PERMIT" };
    }

    const entry = issued.get(permit);
    if (!entry) {
      return { ok: false, code: "INVALID_OR_CONSUMED_PERMIT" };
    }

    // Consume before awaiting the sink: concurrent reuse cannot publish.
    issued.delete(permit);

    try {
      await publishToSink(entry.text, entry.publication);
      return {
        ok: true,
        contentDigest: entry.publication.contentDigest
      };
    } catch {
      // A failed sink may already have produced a side effect.
      // Automatic retry requires sink-level idempotency.
      return { ok: false, code: "PUBLICATION_FAILED" };
    }
  }

  return Object.freeze({ prepare, publish });
}
