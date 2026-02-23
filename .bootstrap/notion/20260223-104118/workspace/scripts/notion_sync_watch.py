#!/usr/bin/env python3
"""
규칙/스킬/핵심 문서 변경을 감지해서 Notion 설정 스냅샷 동기화를 반자동으로 수행한다.

기본 동작:
- 지정 경로들의 mtime/size 변화를 감시
- 변경이 안정화(debounce)되면 `scripts/notion_sync_settings.py` 실행
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Iterable, List, Tuple


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GLOBAL_CODEX_ROOT = Path.home() / ".codex"
SYNC_SCRIPT = WORKSPACE_ROOT / "scripts" / "notion_sync_settings.py"


FileState = Tuple[float, int]


def collect_targets(include_global: bool) -> List[Path]:
    targets: List[Path] = []

    workspace_patterns = [
        WORKSPACE_ROOT / "AGENTS.md",
        WORKSPACE_ROOT / ".agent" / "Project_Context.md",
        WORKSPACE_ROOT / "docs" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Rules_Skills_Summary.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Backlog.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "PRD" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Flow" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Design" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Playwright_Map_Test_Protocol.md",
        WORKSPACE_ROOT / "scripts" / "notion_sync_settings.py",
        WORKSPACE_ROOT / "scripts" / "notion_sync_watch.py",
        WORKSPACE_ROOT / "scripts" / "notion_bootstrap_pull.py",
        WORKSPACE_ROOT / "docs" / "Resources" / "Notion_Sync_Runbook.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Notion_Human_Guide.md",
    ]
    targets.extend(workspace_patterns)
    targets.extend(sorted((WORKSPACE_ROOT / ".agent" / "skills").glob("*/SKILL.md")))

    if include_global:
        global_patterns = [
            GLOBAL_CODEX_ROOT / "AGENTS.md",
            GLOBAL_CODEX_ROOT / "rules" / "default.rules",
            GLOBAL_CODEX_ROOT / "config.toml",
        ]
        targets.extend(global_patterns)
        targets.extend(sorted((GLOBAL_CODEX_ROOT / "skills").glob("*/SKILL.md")))

    # 중복 제거 + 존재 파일만 유지
    uniq: List[Path] = []
    seen = set()
    for p in targets:
        key = str(p).lower()
        if key in seen:
            continue
        seen.add(key)
        if p.exists() and p.is_file():
            uniq.append(p)
    return uniq


def snapshot(paths: Iterable[Path]) -> Dict[Path, FileState]:
    state: Dict[Path, FileState] = {}
    for p in paths:
        try:
            st = p.stat()
        except FileNotFoundError:
            continue
        state[p] = (st.st_mtime, st.st_size)
    return state


def detect_changes(before: Dict[Path, FileState], after: Dict[Path, FileState]) -> List[Path]:
    changed: List[Path] = []
    all_paths = set(before.keys()) | set(after.keys())
    for p in sorted(all_paths, key=lambda x: str(x).lower()):
        if before.get(p) != after.get(p):
            changed.append(p)
    return changed


def run_sync(dry_run: bool) -> int:
    if dry_run:
        print("WATCH_SYNC=SKIPPED(dry-run)")
        return 0

    cmd = [sys.executable, str(SYNC_SCRIPT)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    print(f"WATCH_SYNC_EXIT={proc.returncode}")
    if proc.stdout.strip():
        print(proc.stdout.strip())
    if proc.stderr.strip():
        print(proc.stderr.strip(), file=sys.stderr)
    return proc.returncode


def main() -> int:
    parser = argparse.ArgumentParser(description="Notion 설정 동기화 watcher")
    parser.add_argument("--interval", type=float, default=15.0, help="폴링 주기(초)")
    parser.add_argument("--debounce", type=float, default=10.0, help="변경 안정화 대기(초)")
    parser.add_argument("--dry-run", action="store_true", help="실제 동기화 호출 없이 감지 로그만 출력")
    parser.add_argument("--once", action="store_true", help="감시 루프 없이 즉시 1회 동기화 실행")
    parser.add_argument(
        "--no-global",
        action="store_true",
        help="~/.codex 전역 파일 감시 제외",
    )
    args = parser.parse_args()

    if not SYNC_SCRIPT.exists():
        print(f"동기화 스크립트를 찾을 수 없습니다: {SYNC_SCRIPT}", file=sys.stderr)
        return 1

    if args.once:
        return run_sync(args.dry_run)

    targets = collect_targets(include_global=not args.no_global)
    print(f"WATCH_TARGETS={len(targets)}")
    for p in targets:
        print(f" - {p}")

    prev = snapshot(targets)
    pending = False
    pending_changed: List[Path] = []
    last_change_at = 0.0

    try:
        while True:
            time.sleep(max(args.interval, 1.0))
            # 새 파일 생성도 감시하기 위해 매 루프 대상 재수집
            targets = collect_targets(include_global=not args.no_global)
            cur = snapshot(targets)
            changed = detect_changes(prev, cur)
            prev = cur
            if changed:
                pending = True
                last_change_at = time.time()
                pending_changed = changed
                print("WATCH_CHANGED:")
                for p in changed:
                    print(f" - {p}")
                continue

            if pending and (time.time() - last_change_at) >= max(args.debounce, 0.0):
                print("WATCH_DEBOUNCE_OK=YES")
                rc = run_sync(args.dry_run)
                if rc != 0:
                    print("WATCH_SYNC_STATUS=FAILED", file=sys.stderr)
                else:
                    print("WATCH_SYNC_STATUS=SUCCESS")
                pending = False
                pending_changed = []
    except KeyboardInterrupt:
        print("WATCH_STOPPED=BY_USER")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
