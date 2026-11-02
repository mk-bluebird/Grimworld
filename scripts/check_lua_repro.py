"""SOVEREIGN-ATTRIBUTION: bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7
Credit/workstream metadata only; not authorization or execution evidence.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]

def atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, prefix=".staged-")
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)

def command(executable, args):
    result = subprocess.run([executable, *args], cwd=ROOT,
        capture_output=True, check=True, timeout=20)
    if len(result.stdout) > 1048576 or len(result.stderr) > 1048576:
        raise RuntimeError("post-capture output limit exceeded")
    return result

def run(name, expected):
    found = shutil.which(name)
    if not found: raise RuntimeError("interpreter missing: " + name)
    executable = str(Path(found).resolve())
    identity = command(executable, ["-e", "io.write(_VERSION)"])
    if identity.stdout != ("Lua " + expected).encode("ascii"):
        raise RuntimeError("runtime identity mismatch: " + name)
    command(executable, ["tests/lua/test_prng_vectors.lua"])
    result = command(executable, ["tests/lua/emit_placement_fixture.lua"])
    return result.stdout, {
        "executable": executable,
        "binary_sha256": hashlib.sha256(Path(executable).read_bytes()).hexdigest(),
        "reported_runtime": identity.stdout.decode("ascii"),
        "stderr_hex": result.stderr.hex()
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lua51", default="lua5.1")
    parser.add_argument("--lua54", default="lua5.4")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--reviewer")
    args = parser.parse_args()
    output = ROOT / "output/lua"
    output.mkdir(parents=True, exist_ok=True)
    latest = output / "latest.json"
    # No old success marker remains authoritative for this attempt.
    atomic(latest, b'{"status":"running"}\n')
    try:
        a, ar = run(args.lua51, "5.1")
        b, br = run(args.lua54, "5.4")
        if ar["executable"] == br["executable"]:
            raise RuntimeError("same executable path supplied twice")
        if a != b: raise RuntimeError("cross-runtime byte mismatch")
        actual = hashlib.sha256(a).hexdigest()
        fixture = ROOT / "tests/fixtures/clay-houses-v2.tsv"
        pin = ROOT / "tests/fixtures/clay-houses-v2.sha256"
        changed = False
        if args.update:
            if not args.reviewer: raise RuntimeError("--update requires --reviewer")
            atomic(fixture, a)
            atomic(pin, (actual + "\n").encode("ascii"))
            changed = True
        if pin.read_text("ascii").strip() != actual or fixture.read_bytes() != a:
            raise RuntimeError("pinned fixture/hash mismatch")
        run_id = uuid.uuid4().hex
        artifact = output / (run_id + ".tsv")
        atomic(artifact, a)
        report = {
            "status": "passed", "run_id": run_id,
            "attribution": "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7",
            "artifact": artifact.name, "sha256": actual,
            "byte_count": len(a), "runs": [ar,br],
            "fixture_updated": changed,
            "reviewer_claim": args.reviewer if changed else None,
            "claim_scope": "These binaries and this fixture only; not a sandbox, authorization proof, or statistical-quality certificate."
        }
        atomic(latest, (json.dumps(report, indent=2)+"\n").encode())
        print(json.dumps(report))
        return 0
    except Exception as error:
        report = {"status":"failed", "error_type":type(error).__name__, "message":str(error)}
        atomic(latest, (json.dumps(report)+"\n").encode())
        print(json.dumps(report), file=sys.stderr)
        return 1

if __name__ == "__main__":
    raise SystemExit(main())
