import { createHash, randomUUID } from "node:crypto";

/**
 * SOVEREIGN-ATTRIBUTION
 * bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
 *
 * Credit/workstream metadata only.
 * Not identity, consent, authorization, or execution evidence.
 */

interface Proposal {
  filename: string;
  destination: string;
}

interface WriteEvidence {
  /** Storage adapter's identified target, not a model-invented path. */
  target: string;
  sha256: string;
  bytes: number;
  verifiedAt: string;
}

export type ArtifactRecord =
  | (Proposal & {
      id: string;
      state: "proposed" | "writing";
    })
  | (Proposal & {
      id: string;
      state: "written";
      evidence: WriteEvidence;
    })
  | (Proposal & {
      id: string;
      state: "failed";
      reason: "WRITE_OR_VERIFICATION_FAILED";
      writeMayHaveOccurred: true;
    });

export interface StorageAdapter {
  /**
   * Trusted application implementation.
   * Must write, verify the stored bytes, and return real evidence.
   * It must enforce destination policy and storage authorization.
   */
  writeAndVerify(input: {
    filename: string;
    destination: string;
    bytes: Uint8Array;
  }): Promise<WriteEvidence>;
}

declare const artifactBrand: unique symbol;

export type ArtifactHandle = Readonly<{
  readonly [artifactBrand]: true;
}>;

export function createArtifactService(storage: StorageAdapter) {
  const records = new WeakMap<object, ArtifactRecord>();
  const writeAndVerify = storage.writeAndVerify.bind(storage);

  function inspect(handle: ArtifactHandle): ArtifactRecord {
    const record = records.get(handle);
    if (!record) throw new TypeError("Unknown artifact handle");
    return structuredClone(record);
  }

  function propose(proposal: Proposal): ArtifactHandle {
    if (
      typeof proposal.filename !== "string" ||
      proposal.filename.length === 0 ||
      /[\/\\\u0000-\u001f]/u.test(proposal.filename) ||
      typeof proposal.destination !== "string" ||
      proposal.destination.length === 0 ||
      /[\u0000-\u001f]/u.test(proposal.destination)
    ) {
      throw new TypeError("Invalid proposed filename or destination");
    }

    const handle = Object.freeze({}) as ArtifactHandle;

    records.set(handle, {
      id: randomUUID(),
      state: "proposed",
      filename: proposal.filename,
      destination: proposal.destination
    });

    return handle;
  }

  async function persist(
    handle: ArtifactHandle,
    text: string
  ): Promise<ArtifactRecord> {
    const current = records.get(handle);

    if (!current || current.state !== "proposed") {
      throw new TypeError("Artifact is not an unwritten proposal");
    }
    if (typeof text !== "string") {
      throw new TypeError("Text content required");
    }

    const bytes = Buffer.from(text, "utf8");
    const expected = createHash("sha256").update(bytes).digest("hex");

    records.set(handle, {
      id: current.id,
      filename: current.filename,
      destination: current.destination,
      state: "writing"
    });

    try {
      const evidence = await writeAndVerify({
        filename: current.filename,
        destination: current.destination,
        bytes: Uint8Array.from(bytes)
      });

      if (
        typeof evidence.target !== "string" ||
        evidence.target.length === 0 ||
        evidence.sha256 !== expected ||
        evidence.bytes !== bytes.length ||
        !Number.isFinite(Date.parse(evidence.verifiedAt))
      ) {
        throw new Error("Write verification mismatch");
      }

      records.set(handle, {
        id: current.id,
        filename: current.filename,
        destination: current.destination,
        state: "written",
        evidence: structuredClone(evidence)
      });
    } catch {
      records.set(handle, {
        id: current.id,
        filename: current.filename,
        destination: current.destination,
        state: "failed",
        reason: "WRITE_OR_VERIFICATION_FAILED",
        writeMayHaveOccurred: true
      });
    }

    return inspect(handle);
  }

  return Object.freeze({ propose, inspect, persist });
}
