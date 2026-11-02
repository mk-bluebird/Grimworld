/** SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution. */
export const CATALOG_VERSION = "grimlore.diagnostics.v1";
export const CATALOG = {
  STRUCTURE_INVALID: { phase: "structural", severity: "error", summary: "The document does not conform to its selected schema.", remediation: "Correct the reported field and validate again." },
  REFERENCE_DANGLING: { phase: "referential", severity: "error", summary: "An identifier does not resolve.", remediation: "Add the intended entity or correct the reference." },
  ID_DUPLICATE: { phase: "referential", severity: "error", summary: "An identifier is duplicated within its namespace.", remediation: "Choose a unique identifier and update its references." },
  CORRESPONDENCE_VIOLATED: { phase: "relational", severity: "error", summary: "A declared correspondence constraint is violated.", remediation: "Correct the values or explicitly revise the authored rule." },
  SUPPORT_REQUIRED: { phase: "provenance", severity: "error", summary: "An interpretation lacks required supporting references.", remediation: "Supply reviewable supports without promoting the interpretation to fact." },
  INTERPRETATION_REVIEW: { phase: "interpretive", severity: "warning", summary: "An interpretation needs author review.", remediation: "Review the cited motifs and retain the interpretation label." },
  COMPARISON_INDETERMINATE: { phase: "relational", severity: "warning", summary: "The available information does not establish the comparison.", remediation: "Supply information or explicitly waive a noncritical authoring check." },
  NORMALIZATION_APPLIED: { phase: "authoring", severity: "info", summary: "A declared normalization was applied.", remediation: "Review the recorded change when relevant." }
} as const;
export type DiagnosticCode = keyof typeof CATALOG;
export interface Diagnostic {
  catalog: typeof CATALOG_VERSION;
  code: DiagnosticCode;
  phase: typeof CATALOG[DiagnosticCode]["phase"];
  severity: "error" | "warning" | "info";
  path: string;
  message: string;
  remediation: string;
  details: Readonly<Record<string, string | number | boolean>>;
}
export function diagnostic(code: DiagnosticCode, path: string,
  details: Record<string, string | number | boolean> = {}): Diagnostic {
  if (!Object.hasOwn(CATALOG, code)) throw new TypeError("Unmapped diagnostic code");
  const entry = CATALOG[code];
  return { catalog: CATALOG_VERSION, code, phase: entry.phase,
    severity: entry.severity, path, message: entry.summary,
    remediation: entry.remediation, details: structuredClone(details) };
}
export interface ValidationReport {
  status: "complete" | "blocked" | "worker_failed";
  diagnostics: Diagnostic[];
  criticalChecks: Array<{ id: string; outcome: "pass" | "fail" | "blocked" }>;
}
export function authoringAccepted(report: ValidationReport): boolean {
  if (report.status !== "complete" || report.criticalChecks.length === 0) return false;
  const ids = new Set(report.criticalChecks.map(check => check.id));
  return ids.size === report.criticalChecks.length &&
    report.criticalChecks.every(check => check.outcome === "pass") &&
    !report.diagnostics.some(item => item.severity === "error");
}
