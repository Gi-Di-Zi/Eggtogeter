#!/usr/bin/env python3
"""
Notion 설정 스냅샷 페이지에서 파일 본문을 추출해 로컬 bootstrap 번들을 생성한다.

출력은 workspace 내부 `.bootstrap/notion/<timestamp>/`에 생성되며,
원본 경로를 바로 덮어쓰지 않는다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

TOKEN_ENV = "REDACTED"
ROOT_PAGE_ID_ENV = "NOTION_SETTINGS_ROOT_PAGE_ID"
DEFAULT_ROOT_TITLE = "Notion MCP Server"
SETTINGS_PAGE_TITLE = "codex_setting"
ARCHIVE_PAGE_TITLE = "old"
SNAPSHOT_TITLE_PREFIX = "Codex Settings Snapshot"
SNAPSHOT_TITLE_RE = re.compile(r"^Codex Settings Snapshot (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}Z)$")

WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GLOBAL_CODEX_ROOT = Path.home() / ".codex"


def request(method: str, path: str, token: REDACTED
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(f"{NOTION_API_BASE}{path}", data=data, method=method)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as err:
        try:
            body = err.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return err.code, body


def json_or_none(text: str) -> Optional[Dict]:
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def raise_if_failed(code: int, body: str, context: str) -> None:
    if 200 <= code < 300:
        return
    parsed = json_or_none(body) or {}
    msg = parsed.get("message") or parsed.get("code") or body[:300]
    raise RuntimeError(f"{context} 실패: HTTP {code} / {msg}")


def rich_text_to_plain(rich_text: object) -> str:
    if not isinstance(rich_text, list):
        return ""
    out = []
    for item in rich_text:
        if isinstance(item, dict):
            out.append(str(item.get("plain_text", "")))
    return "".join(out)


def extract_page_title(page_obj: Dict) -> str:
    props = page_obj.get("properties")
    if isinstance(props, dict):
        title_prop = props.get("title")
        if isinstance(title_prop, dict):
            t = rich_text_to_plain(title_prop.get("title"))
            if t:
                return t.strip()
    title = page_obj.get("title")
    if isinstance(title, list):
        t = rich_text_to_plain(title)
        if t:
            return t.strip()
    return ""


def find_root_page_id(token: REDACTED
    pinned = os.getenv(ROOT_PAGE_ID_ENV, "").strip()
    if pinned:
        return pinned

    payload = {
        "query": DEFAULT_ROOT_TITLE,
        "filter": {"property": "object", "value": "page"},
        "page_size": 20,
    }
    code, body = request("POST", "/search", token, payload)
    raise_if_failed(code, body, "루트 페이지 검색")
    parsed = json_or_none(body) or {}
    results = parsed.get("results")
    if not isinstance(results, list):
        raise RuntimeError("루트 페이지 검색 결과 형식 오류")

    for page in results:
        if isinstance(page, dict) and extract_page_title(page) == DEFAULT_ROOT_TITLE:
            pid = page.get("id")
            if isinstance(pid, str) and pid:
                return pid
    if results and isinstance(results[0], dict):
        pid = results[0].get("id")
        if isinstance(pid, str) and pid:
            return pid
    raise RuntimeError(f"'{DEFAULT_ROOT_TITLE}' 페이지를 찾을 수 없습니다.")


def list_block_children(token: REDACTED
    out: List[Dict] = []
    cursor: Optional[str] = None
    while True:
        suffix = f"?page_size=100{f'&start_cursor={cursor}' if cursor else ''}"
        code, body = request("GET", f"/blocks/{block_id}/children{suffix}", token)
        raise_if_failed(code, body, "블록 목록 조회")
        parsed = json_or_none(body) or {}
        results = parsed.get("results")
        if isinstance(results, list):
            for item in results:
                if isinstance(item, dict):
                    out.append(item)
        if not parsed.get("has_more"):
            break
        cursor = parsed.get("next_cursor")
        if not isinstance(cursor, str) or not cursor:
            break
    return out


def find_child_page_by_title(token: REDACTED
    children = list_block_children(token, parent_page_id)
    for blk in children:
        if blk.get("type") != "child_page":
            continue
        child_page = blk.get("child_page")
        child_title = ""
        if isinstance(child_page, dict):
            child_title = str(child_page.get("title", "")).strip()
        if child_title != title:
            continue
        page_id = blk.get("id")
        if isinstance(page_id, str) and page_id:
            return page_id
    return None


def get_page_created_time(token: REDACTED
    code, body = request("GET", f"/pages/{page_id}", token)
    raise_if_failed(code, body, "페이지 조회")
    parsed = json_or_none(body) or {}
    created_time = parsed.get("created_time")
    return created_time if isinstance(created_time, str) else ""


def snapshot_sort_key(title: str, created_time: str) -> Tuple[int, str]:
    m = SNAPSHOT_TITLE_RE.match(title.strip())
    if m:
        return (1, m.group(1))
    return (0, created_time)


def collect_snapshot_candidates(token: REDACTED
    candidates: List[Tuple[str, str, str]] = []
    children = list_block_children(token, parent_page_id)
    for blk in children:
        if blk.get("type") != "child_page":
            continue
        title = ""
        child_page = blk.get("child_page")
        if isinstance(child_page, dict):
            title = str(child_page.get("title", "")).strip()
        if not title.startswith(SNAPSHOT_TITLE_PREFIX):
            continue
        page_id = blk.get("id")
        if not isinstance(page_id, str) or not page_id:
            continue
        created = get_page_created_time(token, page_id)
        candidates.append((page_id, title, created))
    return candidates


def find_latest_snapshot_page(token: REDACTED
    settings_page_id = find_child_page_by_title(token, root_page_id, SETTINGS_PAGE_TITLE)
    if settings_page_id:
        settings_candidates = collect_snapshot_candidates(token, settings_page_id)
        if settings_candidates:
            settings_candidates.sort(key=lambda x: snapshot_sort_key(x[1], x[2]))
            page_id, title, _ = settings_candidates[-1]
            return page_id, title

    candidates: List[Tuple[str, str, str]] = collect_snapshot_candidates(token, root_page_id)

    if not candidates and settings_page_id:
        old_page_id = find_child_page_by_title(token, settings_page_id, ARCHIVE_PAGE_TITLE)
        if old_page_id:
            candidates = collect_snapshot_candidates(token, old_page_id)

    if not candidates:
        raise RuntimeError("복구 가능한 스냅샷 페이지를 찾지 못했습니다.")

    candidates.sort(key=lambda x: snapshot_sort_key(x[1], x[2]))
    page_id, title, _ = candidates[-1]
    return page_id, title


def parse_snapshot_files(blocks: List[Dict]) -> Dict[str, str]:
    files: Dict[str, str] = {}
    current_path: Optional[str] = None

    for blk in blocks:
        btype = blk.get("type")
        if btype in ("heading_1", "heading_2", "heading_3"):
            current_path = None
            continue

        if btype == "bulleted_list_item":
            item = blk.get("bulleted_list_item")
            text = ""
            if isinstance(item, dict):
                text = rich_text_to_plain(item.get("rich_text")).strip()
            if text.lower().startswith("path:"):
                current_path = text.split(":", 1)[1].strip()
                if current_path:
                    files.setdefault(current_path, "")
            continue

        if btype == "code" and current_path:
            code_obj = blk.get("code")
            if isinstance(code_obj, dict):
                chunk = rich_text_to_plain(code_obj.get("rich_text"))
                files[current_path] = files.get(current_path, "") + chunk

    return files


def safe_rel(path_str: str) -> str:
    s = path_str.replace("\\", "/")
    s = re.sub(r"^[A-Za-z]:", "", s)
    s = s.lstrip("/")
    s = s.replace("..", "__")
    return s or "unknown"


def map_output_path(original_path: str) -> Path:
    p = Path(original_path)
    ol = str(p).lower()
    ws = str(WORKSPACE_ROOT).lower()
    gc = str(GLOBAL_CODEX_ROOT).lower()

    if p.is_absolute():
        if ol.startswith(ws):
            try:
                rel = p.relative_to(WORKSPACE_ROOT)
            except Exception:
                rel = Path(safe_rel(original_path))
            return Path("workspace") / rel
        if ol.startswith(gc):
            try:
                rel = p.relative_to(GLOBAL_CODEX_ROOT)
            except Exception:
                rel = Path(safe_rel(original_path))
            return Path("global_codex") / rel
        return Path("external") / Path(safe_rel(original_path))

    return Path("workspace") / Path(safe_rel(original_path))


def write_bundle(
    files: Dict[str, str],
    output_dir: Path,
    source_page_id: str,
    source_page_title: str,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = {
        "generated_at_utc": dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%SZ"),
        "source_page_id": source_page_id,
        "source_page_title": source_page_title,
        "workspace_root": str(WORKSPACE_ROOT),
        "global_codex_root": str(GLOBAL_CODEX_ROOT),
        "files": [],
    }

    for original_path, content in sorted(files.items(), key=lambda kv: kv[0].lower()):
        rel = map_output_path(original_path)
        target = output_dir / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", errors="replace")
        manifest["files"].append(
            {
                "original_path": original_path,
                "bundle_path": str(rel),
                "bytes": len(content.encode("utf-8", errors="replace")),
            }
        )

    (output_dir / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    guide = [
        "# Notion Bootstrap Bundle",
        "",
        f"- source_page_id: `{source_page_id}`",
        f"- source_page_title: `{source_page_title}`",
        "",
        "## 적용 가이드",
        "1. `manifest.json`을 열어 필요한 파일 목록을 확인합니다.",
        "2. `workspace/` 하위 파일은 현재 레포에 덮어쓰기 전 diff를 확인합니다.",
        "3. `global_codex/` 하위 파일은 `~/.codex`로 수동 복사합니다.",
        "4. 민감정보(토큰/키)는 별도 환경변수로 다시 설정합니다.",
        "",
        "## 주의",
        "- 이 번들은 자동 복구용 중간 산출물이며, 원본 파일을 즉시 덮어쓰지 않습니다.",
        "- 경로 이동/리네임은 별도 검토 후 진행합니다.",
    ]
    (output_dir / "README.md").write_text("\n".join(guide) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Notion 스냅샷에서 bootstrap 번들 추출")
    parser.add_argument("--page-id", help="직접 가져올 스냅샷 page_id")
    parser.add_argument("--output-dir", help="번들 출력 폴더(기본: .bootstrap/notion/<ts>)")
    args = parser.parse_args()

    token = REDACTED
    if not token:
        REDACTED
        return 1

    ts = dt.datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    out_dir = (
        Path(args.output_dir).resolve()
        if args.output_dir
        else (WORKSPACE_ROOT / ".bootstrap" / "notion" / ts)
    )

    try:
        if args.page_id:
            source_page_id = args.page_id.strip()
            source_title = "(manual page id)"
        else:
            root_page_id = find_root_page_id(token)
            source_page_id, source_title = find_latest_snapshot_page(token, root_page_id