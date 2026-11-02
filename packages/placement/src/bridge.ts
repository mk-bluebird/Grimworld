import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { LuaFactory } from "wasmoon";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

export interface PlacementConfig {
  seed: number;
  count: number;
  spacing: number;
  jitter: number;
  width: number;
  origin_x: number;
  origin_y: number;
}

export type PlacementErrorCode =
  | "SOURCE_INVALID"
  | "SOURCE_DIGEST_MISMATCH"
  | "CONFIG_INVALID"
  | "BRIDGE_BUSY"
  | "RUNTIME_MISMATCH"
  | "LUA_EXECUTION_FAILED"
  | "OUTPUT_INVALID"
  | "ENGINE_CLOSE_FAILED";

export class PlacementError extends Error {
  constructor(
    public readonly code: PlacementErrorCode,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "PlacementError";
  }
}

export interface TrustedSources {
  rngSource: string;
  rngSha256: string;
  placementSource: string;
  placementSha256: string;
}

export interface PlacementResult {
  text: string;
  sha256: string;
  runtime: "Lua 5.4";
  sources: {
    rngSha256: string;
    placementSha256: string;
  };
  timingsMs: {
    engineCreate: number;
    execution: number;
    close: number;
    total: number;
  };
}

function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function checkedSource(
  text: string,
  expectedDigest: string,
  label: string
): string {
  if (
    typeof text !== "string" ||
    Buffer.byteLength(text, "utf8") > 256 * 1024 ||
    typeof expectedDigest !== "string" ||
    !/^[a-f0-9]{64}$/u.test(expectedDigest)
  ) {
    throw new PlacementError("SOURCE_INVALID", `Invalid ${label} source`);
  }

  const actual = sha256(text);
  if (actual !== expectedDigest) {
    throw new PlacementError(
      "SOURCE_DIGEST_MISMATCH",
      `${label} source differs from the configured build digest`
    );
  }

  return actual;
}

/**
 * Encode UTF-8 bytes into a Lua string literal.
 * Three-digit escapes avoid escape-boundary ambiguity.
 * This is source transport, not configuration interpolation.
 */
function luaString(text: string): string {
  return '"' + [...Buffer.from(text, "utf8")]
    .map(byte => "\\" + byte.toString(10).padStart(3, "0"))
    .join("") + '"';
}

export function validateConfig(input: unknown): PlacementConfig {
  if (
    input === null ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new PlacementError("CONFIG_INVALID", "Configuration object required");
  }

  const value = input as Record<string, unknown>;
  const fields = [
    "seed", "count", "spacing", "jitter",
    "width", "origin_x", "origin_y"
  ] as const;

  if (
    Object.keys(value).length !== fields.length ||
    fields.some(field => !Object.hasOwn(value, field))
  ) {
    throw new PlacementError(
      "CONFIG_INVALID",
      "Exactly the seven supported configuration fields are required"
    );
  }

  const limits: Record<typeof fields[number], readonly [number, number]> = {
    seed: [1, 2147483646],
    count: [1, 1000],
    spacing: [1, 100000],
    jitter: [0, 1000],
    width: [1, 10000],
    origin_x: [-1000000, 1000000],
    origin_y: [-1000000, 1000000]
  };

  const result = {} as PlacementConfig;

  for (const field of fields) {
    const item = value[field];
    const [low, high] = limits[field];

    if (
      typeof item !== "number" ||
      !Number.isSafeInteger(item) ||
      item < low ||
      item > high
    ) {
      throw new PlacementError(
        "CONFIG_INVALID",
        `Invalid integer field: ${field}`
      );
    }

    result[field] = Object.is(item, -0) ? 0 : item;
  }

  if (result.spacing < result.width + 2 * result.jitter) {
    throw new PlacementError(
      "CONFIG_INVALID",
      "Spacing is insufficient for width and jitter"
    );
  }

  return result;
}

export function createPlacementBridge(sources: TrustedSources) {
  // These expected digests must come from trusted build configuration.
  // Computing them from untrusted sources at request time defeats admission.
  const rngSha256 = checkedSource(
    sources.rngSource, sources.rngSha256, "RNG"
  );
  const placementSha256 = checkedSource(
    sources.placementSource, sources.placementSha256, "placement"
  );

  const bootstrap = `
    assert(_VERSION == "Lua 5.4", "runtime mismatch")

    package.preload["lua.rng"] = function(...)
      local chunk, err = load(
        ${luaString(sources.rngSource)},
        "@grimlore/lua/rng.lua",
        "t"
      )
      assert(chunk, err)
      return chunk(...)
    end

    package.preload["lua.place_clay_houses"] = function(...)
      local chunk, err = load(
        ${luaString(sources.placementSource)},
        "@grimlore/lua/place_clay_houses.lua",
        "t"
      )
      assert(chunk, err)
      return chunk(...)
    end
  `;

  const factory = new LuaFactory();
  let busy = false;

  async function generate(input: unknown): Promise<PlacementResult> {
    const config = validateConfig(input);

    if (busy) {
      throw new PlacementError(
        "BRIDGE_BUSY",
        "This bridge instance permits one active request"
      );
    }

    busy = true;
    const started = performance.now();
    let engine: Awaited<ReturnType<LuaFactory["createEngine"]>> | undefined;
    let result: PlacementResult | undefined;
    let failure: unknown;
    let closeMs = 0;

    try {
      const creationStarted = performance.now();
      engine = await factory.createEngine();
      const engineCreate = performance.now() - creationStarted;

      if (engine.global.get("_VERSION") !== "Lua 5.4") {
        throw new PlacementError(
          "RUNTIME_MISMATCH",
          "Expected Lua 5.4"
        );
      }

      const executionStarted = performance.now();
      await engine.doString(bootstrap);

      for (const [field, value] of Object.entries(config)) {
        engine.global.set(`GL_${field}`, value);
      }

      const output: unknown = await engine.doString(`
        local placement = require("lua.place_clay_houses")
        local result = placement.generate({
          seed = GL_seed,
          count = GL_count,
          spacing = GL_spacing,
          jitter = GL_jitter,
          width = GL_width,
          origin_x = GL_origin_x,
          origin_y = GL_origin_y
        })
        local text = placement.serialize(result)
        assert(placement.serialize(placement.parse(text)) == text)
        return text
      `);

      const execution = performance.now() - executionStarted;

      if (
        typeof output !== "string" ||
        Buffer.byteLength(output, "utf8") > 256 * 1024 ||
        !output.startsWith("profile=grimlore.clay-house-placement.v2\n") ||
        !output.endsWith("\n")
      ) {
        throw new PlacementError(
          "OUTPUT_INVALID",
          "Unexpected placement serialization"
        );
      }

      result = {
        text: output,
        sha256: sha256(output),
        runtime: "Lua 5.4",
        sources: { rngSha256, placementSha256 },
        timingsMs: {
          engineCreate,
          execution,
          close: 0,
          total: 0
        }
      };
    } catch (error) {
      failure = error instanceof PlacementError
        ? error
        : new PlacementError(
            "LUA_EXECUTION_FAILED",
            "Lua placement execution failed",
            { cause: error }
          );
    } finally {
      const closeStarted = performance.now();

      try {
        engine?.global.close();
      } catch (error) {
        if (failure === undefined) {
          failure = new PlacementError(
            "ENGINE_CLOSE_FAILED",
            "Lua engine cleanup failed",
            { cause: error }
          );
        }
      }

      closeMs = performance.now() - closeStarted;
      busy = false;
    }

    if (failure !== undefined) throw failure;
    if (!result) {
      throw new PlacementError(
        "OUTPUT_INVALID",
        "Execution completed without a result"
      );
    }

    result.timingsMs.close = closeMs;
    result.timingsMs.total = performance.now() - started;
    return result;
  }

  return Object.freeze({ generate });
}
