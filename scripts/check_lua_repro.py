import argparse
import hashlib
import json
from pathlib import Path
import subprocess

ATTRIBUTION = (
    "bostrom18sd2ujv24ual9c9pshtxys6j8knh6xaead9ye7"
)


def run(interpreter: str) -> dict:
    version = subprocess.run(
        [interpreter, "-v"],
        capture_output=True,
        check=True,
        timeout=10,
    )
    result = subprocess.run(
        [interpreter, "tests/lua/placement_vectors.lua"],
        capture_output=True,
        check=True,
        timeout=15,
    )
    return {
        "interpreter": interpreter,
        "version": (
            version.stdout + version.stderr
        ).decode("utf-8", errors="replace").strip(),
        "bytes": result.stdout,
        "stderr": result.stderr.decode("utf-8", errors="replace"),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lua51", default="lua5.1")
    parser.add_argument("--lua54", default="lua5.4")
    args = parser.parse_args()

    first = run(args.lua51)
    second = run(args.lua54)

    if first["bytes"] != second["bytes"]:
        raise SystemExit("FAIL: interpreter outputs differ byte-for-byte")

    output = Path("output/lua")
    output.mkdir(parents=True, exist_ok=True)
    (output / "clay-houses.tsv").write_bytes(first["bytes"])

    report = {
        "attribution": ATTRIBUTION,
        "status": "passed",
        "comparison": "exact_bytes_then_sha256",
        "sha256": hashlib.sha256(first["bytes"]).hexdigest(),
        "byte_count": len(first["bytes"]),
        "runs": [
            {key: value for key, value in item.items() if key != "bytes"}
            for item in (first, second)
        ],
        "claim_scope": (
            "These recorded interpreters and this fixed test configuration; "
            "not every Lua implementation or configuration."
        ),
    }
    (output / "repro-report.json").write_text(
        json.dumps(report, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
