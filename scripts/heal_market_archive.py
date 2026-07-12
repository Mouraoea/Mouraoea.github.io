#!/usr/bin/env python3
"""Merge market monthly archives from git commits to recover from parallel-fetch corruption.

Typical usage after a race between deploy-triggered and scheduled fetches:

  python scripts/heal_market_archive.py \\
    --base 344d44690f8d97f270f9bf2397dd0ba4a8f3002a \\
    --delta f7045814b7e9064ec122aea5e5c359683ac8917a \\
    --also 492eaba \\
    --file public/data/market/2026-07.txt

--base is the last known-good archive. --delta supplies new snapshots to append.
--also (repeatable) restores snapshots dropped by an earlier race (e.g. the 03:14
snapshot lost when 08:21 overwrote 492eaba).
"""

from __future__ import annotations

import argparse
import base64
import gzip
import json
import subprocess
import sys
from pathlib import Path
from typing import Any

HEADER = "# idleclans-market v1 gzip+base64"


def git_show(commit: str, repo_path: str, file_path: str) -> str:
    result = subprocess.run(
        ["git", "show", f"{commit}:{file_path}"],
        cwd=repo_path,
        check=True,
        capture_output=True,
    )
    return result.stdout.decode("utf-8")


def strip_comment_lines(text: str) -> str:
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("#"):
            lines.append(stripped)
    return "\n".join(lines)


def decompress_archive(text: str) -> dict[str, Any]:
    payload = strip_comment_lines(text)
    raw = gzip.decompress(base64.b64decode(payload))
    archive = json.loads(raw.decode("utf-8"))
    if archive.get("version") != 1 or not isinstance(archive.get("snapshots"), list):
        raise ValueError("Invalid archive format")
    return archive


def compress_archive(archive: dict[str, Any]) -> str:
    raw = json.dumps(archive, separators=(",", ":")).encode("utf-8")
    payload = base64.b64encode(gzip.compress(raw)).decode("ascii")
    return f"{HEADER}\n{payload}"


def upsert_snapshot(archive: dict[str, Any], snapshot: dict[str, Any]) -> None:
    captured_at = snapshot["capturedAt"]
    archive["snapshots"] = [
        snap for snap in archive["snapshots"] if snap["capturedAt"] != captured_at
    ]
    archive["snapshots"].append(snapshot)
    archive["snapshots"].sort(key=lambda snap: snap["capturedAt"])


def merge_archives(base: dict[str, Any], *others: dict[str, Any]) -> dict[str, Any]:
    merged = json.loads(json.dumps(base))
    seen = {snap["capturedAt"] for snap in merged["snapshots"]}

    for other in others:
        for snapshot in other["snapshots"]:
            captured_at = snapshot["capturedAt"]
            if captured_at in seen:
                continue
            upsert_snapshot(merged, snapshot)
            seen.add(captured_at)

    merged["month"] = base["month"]
    return merged


def load_archive(commit: str, repo_path: str, file_path: str) -> dict[str, Any]:
    return decompress_archive(git_show(commit, repo_path, file_path))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True, help="Last known-good git commit")
    parser.add_argument("--delta", required=True, help="Commit with new snapshots to merge in")
    parser.add_argument(
        "--also",
        action="append",
        default=[],
        help="Extra commits whose missing snapshots should be recovered",
    )
    parser.add_argument(
        "--file",
        default="public/data/market/2026-07.txt",
        help="Archive path inside the repo",
    )
    parser.add_argument(
        "--repo",
        default=".",
        help="Repository root (default: current directory)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print summary without writing the output file",
    )
    args = parser.parse_args()

    repo_path = str(Path(args.repo).resolve())
    file_path = args.file.replace("\\", "/")

    base = load_archive(args.base, repo_path, file_path)
    delta = load_archive(args.delta, repo_path, file_path)
    also_archives = [load_archive(commit, repo_path, file_path) for commit in args.also]

    healed = merge_archives(base, delta, *also_archives)
    base_keys = {snap["capturedAt"] for snap in base["snapshots"]}
    delta_keys = {snap["capturedAt"] for snap in delta["snapshots"]}
    added_from_delta = sorted(delta_keys - base_keys)
    added_from_also = sorted(
        key
        for archive in also_archives
        for key in {snap["capturedAt"] for snap in archive["snapshots"]}
        if key not in base_keys and key not in delta_keys
    )

    print(f"Base commit {args.base[:8]}: {len(base['snapshots'])} snapshot(s)")
    print(f"Delta commit {args.delta[:8]}: adds {added_from_delta or ['(none)']}")
    if args.also:
        print(f"Also commits: adds {added_from_also or ['(none)']}")
    print(f"Healed archive: {len(healed['snapshots'])} snapshot(s)")
    for snap in healed["snapshots"]:
        print(f"  {snap['date']}  {snap['capturedAt']}  {len(snap['items'])} items")

    if args.dry_run:
        return 0

    output_path = Path(repo_path) / file_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(compress_archive(healed), encoding="utf-8", newline="\n")
    print(f"Wrote {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
