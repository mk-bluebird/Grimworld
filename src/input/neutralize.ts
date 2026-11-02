import { createHash } from "node:crypto";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 * Credit/metadata only; not identity, consent, authorization, or execution.
 */

export interface SourceMaterial {
  sourceId: string;
  kind: "ocr" | "quotation" | "document";
  text: string;
}

export interface ScreeningResult {
  version: 1;
  trust: "untrusted";
  route: "data_only" | "review";
  source: {
    id: string;
    kind: SourceMaterial["kind"];
    sha256: string;
  };
  content: {
    originalText: string;
  };
  findings: Array<{
    code:
      | "INSTRUCTION_OVERRIDE"
      | "ROLE_SPOOFING"
      | "CAPABILITY_ESCALATION"
      | "SECRET_REQUEST"
      | "UNICODE_CONTROLS";
  }>;
}

const patterns = [
  {
    code: "INSTRUCTION_OVERRIDE",
    pattern:
      /\b(?:ignore|disregard|override)\b.{0,80}\b(?:previous|prior|system|developer|instructions?|rules?)\b/u
  },
  {
    code: "ROLE_SPOOFING",
    pattern:
      /(?:<\|(?:im_start|system|developer)\|>|<\/?(?:system|developer)>|\b(?:system|developer)\s*:)/u
  },
  {
    code: "CAPABILITY_ESCALATION",
    pattern:
      /\b(?:enable|invoke|call|execute|run|generate|create)\b.{0,80}\b(?:image|shell|terminal|command|tool|code)\b/u
  },
  {
    code: "SECRET_REQUEST",
    pattern:
      /\b(?:reveal|exfiltrate|print|send)\b.{0,80}\b(?:secret|api.?key|system.?prompt|password|token)\b/u
  }
] as const;

const controls =
  /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/u;

export function screenMaterial(
  material: SourceMaterial,
  maxBytes = 64 * 1024
): ScreeningResult {
  if (
    typeof material.sourceId !== "string" ||
    material.sourceId.length === 0
  ) {
    throw new TypeError("A nonempty source ID is required");
  }

  if (!["ocr", "quotation", "document"].includes(material.kind)) {
    throw new TypeError("Unsupported source kind");
  }

  if (typeof material.text !== "string") {
    throw new TypeError("Source text must be a string");
  }

  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("maxBytes must be a positive safe integer");
  }

  if (Buffer.byteLength(material.text, "utf8") > maxBytes) {
    throw new RangeError("Source exceeds screening size limit");
  }

  // Detection normalization never replaces the preserved source content.
  const normalized = material.text
    .normalize("NFKC")
    .replace(
      /[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/gu,
      ""
    )
    .replace(/\s+/gu, " ")
    .toLowerCase();

  const findings: ScreeningResult["findings"] = [];

  for (const rule of patterns) {
    if (rule.pattern.test(normalized)) {
      findings.push({ code: rule.code });
    }
  }

  if (controls.test(material.text)) {
    findings.push({ code: "UNICODE_CONTROLS" });
  }

  return {
    version: 1,
    trust: "untrusted",
    route: findings.length > 0 ? "review" : "data_only",
    source: {
      id: material.sourceId,
      kind: material.kind,
      sha256: createHash("sha256")
        .update(material.text, "utf8")
        .digest("hex")
    },
    content: {
      originalText: material.text
    },
    findings
  };
}

/**
 * Serialization only. This does not establish a host instruction boundary.
 * The host adapter must choose the appropriate untrusted-content channel.
 */
export function encodeUntrustedMaterial(
  result: ScreeningResult
): string {
  return JSON.stringify(result);
}
