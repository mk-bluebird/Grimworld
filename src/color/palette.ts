import { differenceCiede2000 } from "culori";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export type PaletteRole =
  | "dominant"
  | "warm_accent"
  | "minor_accent";

export interface Swatch {
  id: string;
  role: PaletteRole;

  /** Explicit opaque sRGB sample; not inferred from a color name. */
  hex: string;

  basis:
    | "image_sample"
    | "author_specification"
    | "implementation_choice";

  /**
   * Fraction of canvas area, only when a mutually exclusive,
   * exhaustive area assignment has been established.
   */
  areaFraction?: number;
}

export interface DeltaBand {
  min: number;
  max: number;
}

export interface PalettePolicy {
  id: string;
  calibrationId: string;

  /**
   * Optional bands for nearest-dominant ΔE00.
   * These are project policies, not universal artistic rules.
   */
  nearestDominantDelta?: Partial<
    Record<Exclude<PaletteRole, "dominant">, DeltaBand>
  >;

  /** Aggregate area of warm_accent + minor_accent. */
  maxTotalAccentArea?: number;
}

export interface AreaAssignment {
  exhaustive: true;
  mutuallyExclusive: true;
  sourceId: string;
}

export interface PaletteFinding {
  code:
    | "DELTA_OUTSIDE_POLICY"
    | "AREA_MEASUREMENT_UNAVAILABLE"
    | "ACCENT_AREA_EXCEEDED";
  swatchId?: string;
  message: string;
}

export function assessPalette(
  swatches: readonly Swatch[],
  options: {
    policy?: PalettePolicy;
    areaAssignment?: AreaAssignment;
  } = {}
) {
  if (swatches.length === 0 || swatches.length > 256) {
    throw new RangeError("Expected 1–256 swatches");
  }

  const ids = new Set<string>();

  for (const swatch of swatches) {
    if (
      typeof swatch.id !== "string" ||
      swatch.id.length === 0 ||
      ids.has(swatch.id)
    ) {
      throw new TypeError("Swatch IDs must be unique and nonempty");
    }
    ids.add(swatch.id);

    if (
      !["dominant", "warm_accent", "minor_accent"].includes(swatch.role) ||
      !/^#[0-9a-f]{6}$/iu.test(swatch.hex)
    ) {
      throw new TypeError("Expected a supported role and #RRGGBB color");
    }

    if (
      swatch.areaFraction !== undefined &&
      (
        !Number.isFinite(swatch.areaFraction) ||
        swatch.areaFraction < 0 ||
        swatch.areaFraction > 1
      )
    ) {
      throw new TypeError("Area fraction must lie in [0, 1]");
    }
  }

  const dominant = swatches.filter(swatch => swatch.role === "dominant");
  const accents = swatches.filter(swatch => swatch.role !== "dominant");

  if (dominant.length === 0) {
    throw new TypeError("At least one dominant swatch is required");
  }

  const policy = options.policy;

  if (policy) {
    if (!policy.id || !policy.calibrationId) {
      throw new TypeError("Policy identity and calibration identity required");
    }

    for (const band of Object.values(policy.nearestDominantDelta ?? {})) {
      if (
        band === undefined ||
        !Number.isFinite(band.min) ||
        !Number.isFinite(band.max) ||
        band.min < 0 ||
        band.max < band.min
      ) {
        throw new TypeError("Invalid ΔE policy band");
      }
    }

    if (
      policy.maxTotalAccentArea !== undefined &&
      (
        !Number.isFinite(policy.maxTotalAccentArea) ||
        policy.maxTotalAccentArea < 0 ||
        policy.maxTotalAccentArea > 1
      )
    ) {
      throw new TypeError("Invalid aggregate accent-area limit");
    }
  }

  const delta = differenceCiede2000();
  const findings: PaletteFinding[] = [];
  let evaluatedRules = 0;
  let incomplete = false;

  const distances = accents.map(accent => {
    let nearest = {
      dominantId: dominant[0]!.id,
      deltaE00: Number.POSITIVE_INFINITY
    };

    for (const base of dominant) {
      const distance = delta(accent.hex, base.hex);
      if (!Number.isFinite(distance)) {
        throw new Error("Color difference calculation failed");
      }

      if (distance < nearest.deltaE00) {
        nearest = {
          dominantId: base.id,
          deltaE00: distance
        };
      }
    }

    const role = accent.role as Exclude<PaletteRole, "dominant">;
    const band = policy?.nearestDominantDelta?.[role];

    if (band) {
      evaluatedRules++;
      if (
        nearest.deltaE00 < band.min ||
        nearest.deltaE00 > band.max
      ) {
        findings.push({
          code: "DELTA_OUTSIDE_POLICY",
          swatchId: accent.id,
          message: "Nearest-dominant distance lies outside calibrated policy."
        });
      }
    }

    return {
      swatchId: accent.id,
      role,
      ...nearest
    };
  });

  let totalAccentArea: number | null = null;
  const assignment = options.areaAssignment;

  if (
    assignment?.exhaustive === true &&
    assignment.mutuallyExclusive === true &&
    assignment.sourceId.length > 0 &&
    swatches.every(swatch => swatch.areaFraction !== undefined)
  ) {
    const total = swatches.reduce(
      (sum, swatch) => sum + swatch.areaFraction!,
      0
    );

    if (Math.abs(total - 1) > 1e-6) {
      throw new TypeError("Complete area fractions must sum to 1");
    }

    totalAccentArea = accents.reduce(
      (sum, swatch) => sum + swatch.areaFraction!,
      0
    );
  }

  if (policy?.maxTotalAccentArea !== undefined) {
    if (totalAccentArea === null) {
      incomplete = true;
      findings.push({
        code: "AREA_MEASUREMENT_UNAVAILABLE",
        message: "Area restraint requires a complete exclusive assignment."
      });
    } else {
      evaluatedRules++;
      if (totalAccentArea > policy.maxTotalAccentArea) {
        findings.push({
          code: "ACCENT_AREA_EXCEEDED",
          message: "Aggregate accent area exceeds calibrated policy."
        });
      }
    }
  }

  const violated = findings.some(
    finding => finding.code !== "AREA_MEASUREMENT_UNAVAILABLE"
  );

  return {
    metricVersion: "grimlore.palette.v1",
    comparison: {
      formula: "CIEDE2000",
      workingSpace: "lab65",
      inputEncoding: "opaque_srgb_hex",
      parameters: { kL: 1, kC: 1, kH: 1 }
    },
    policyId: policy?.id ?? null,
    calibrationId: policy?.calibrationId ?? null,
    distances,
    totalAccentArea,
    policyConformance: violated
      ? "violated"
      : incomplete || evaluatedRules === 0
        ? "indeterminate"
        : "satisfied",
    artisticRestraint: "not_established",
    findings
  };
}
