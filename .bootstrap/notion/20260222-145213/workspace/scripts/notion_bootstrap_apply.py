#!/usr/bin/env python3
"""
`scripts/notion_bootstrap_pull.py`가 만든 번들을 실제 로컬 파일로 적용한다.

기본 정책:
- workspace 파일만 적용
- global_codex 파일은 `--apply-global` 옵션을 줬을 때만 적용
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GLOBAL_CODEX_ROOT = Path.home() / ".codex"


def load_manifest(bundle_dir: Path) -> Dict:
    mf = bundle_dir / "manifest.json"
    if not mf.exists():
        raise RuntimeError(f"manifest.json을 찾을 수 없습니다: {mf}")
    return json.loads(mf.read_text(encoding="utf-8"))


def resolve_destination(bundle_rel_path: str, apply_global: bool) -> Path | None:
    p = Path(bundle_rel_path)
    parts = p.parts
    if not parts:
        return None

    head = parts[0].lower()
    tail = Path(*parts[1:]) if len(parts) > 1 else Path()

    if head == "workspace":
        return WORKSPACE_ROOT / tail
    if head == "global_codex":
        if not apply_global:
            return None
        return GLOBAL_CODEX_ROOT / tail
    return None


def apply_bundle(bundle_dir: Path, apply_global: bool, dry_run: bool) -> Dict[str, int]:
    manifest = load_manifest(bundle_dir)
    files = manifest.get("files")
    if not isinstance(files, list):
        raise RuntimeError("manifest.json 형식이 올바르지 않습니다(files 누락).")

    stats = {
        "applied": 0,
        "skipped": 0,
        "missing_source": 0,
    }

    for item in files:
        if not isinstance(item, dict):
            stats["skipped"] += 1
            continue
        bundle_rel = item.get("bundle_path")
        if not isinstance(bundle_rel, str) or not bundle_rel:
            stats["skipped"] += 1
            continue

        src = bundle_dir / bundle_rel
        if not src.exists():
            print(f"SKIP_MISSING_SOURCE={src}")
            stats["missing_source"] += 1
            continue

        dst = resolve_destination(bundle_rel, apply_global)
        if dst is None:
            print(f"SKIP_SCOPE={bundle_rel}")
            stats["skipped"] += 1
            continue

        if dry_run:
            print(f"DRYRUN_APPLY {src} -> {dst}")
            stats["applied"] += 1
            continue

        dst.parent.mkdir(parents=True, exist_ok=True)
        content = src.read_text(encoding="utf-8", errors="replace")
        dst.write_text(content, encoding="utf-8")
        print(f"APPLIED {dst}")
        stats["applied"] += 1

    return stats


def main() -> int:
    parser = argparse.ArgumentParser(description="Notion bootstrap bundle 적용")
    parser.add_argument("--bundle-dir", required=True, help="bootstrap 번들 폴더 경로")
    parser.add_argument("--apply-global", action="store_true", help="global_codex 파일도 적용")
    parser.add_argument("--dry-run", action="store_true", help="실제 쓰기 없이 대상만 출력")
    args = parser.parse_args()

    bundle_dir = Path(args.bundle_dir).resolve()
    if not bundle_dir.exists():
        print(f"BUNDLE_NOT_FOUND={bundle_dir}")
        return 1

    try:
        stats = apply_bundle(bundle_dir, apply_global=args.apply_global, dry_run=args.dry_run)
    except Exception as exc:
        print(f"APPLY_RESULT=FAILED")
        print(f"APPLY_ERROR={exc}")
        return 2

    print("APPLY_RESULT=SUCCESS")
    print(f"APPLY_APPLIED={stats['applied']}")
    print(f"APPLY_SKIPPED={stats['skipped']}")
    print(f"APPLY_MISSING_SOURCE={stats['missing_source']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
