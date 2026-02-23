#!/usr/bin/env python3
"""
Codex/Workspace 설정 스냅샷을 Notion 페이지로 동기화한다.

전제:
- NOTION_MCP_TOKEN 환경변수에 Notion API 토큰이 설정되어 있어야 한다.
- 대상 페이지(기본: "Notion MCP Server")에 통합 권한이 있어야 한다.
"""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple


NOTION_API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"

DEFAULT_ROOT_TITLE = "Notion MCP Server"
SETTINGS_PAGE_TITLE = "codex_setting"
ARCHIVE_PAGE_TITLE = "old"
SNAPSHOT_TITLE_PREFIX = "Codex Settings Snapshot"
ROOT_PAGE_ID_ENV = "NOTION_SETTINGS_ROOT_PAGE_ID"
TOKEN_ENV = "NOTION_MCP_TOKEN"

MAX_RICH_TEXT_CHARS = 1800
MAX_FILE_CHARS = 12000
APPEND_BATCH_SIZE = 80


WORKSPACE_ROOT = Path(__file__).resolve().parents[1]
GLOBAL_CODEX_ROOT = Path.home() / ".codex"
HOME_ROOT = Path.home()


def eprint(msg: str) -> None:
    print(msg, file=sys.stderr)


def now_utc() -> str:
    return dt.datetime.utcnow().strftime("%Y-%m-%d %H:%M:%SZ")


def _request(
    method: str,
    path: str,
    token: str,
    payload: Optional[Dict] = None,
) -> Tuple[int, str]:
    data = None
    if payload is not None:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    req = urllib.request.Request(
        f"{NOTION_API_BASE}{path}",
        data=data,
        method=method,
    )
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Notion-Version", NOTION_VERSION)
    req.add_header("Content-Type", "application/json")

    try:
        with urllib.request.urlopen(req, timeout=45) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body
    except urllib.error.HTTPError as err:
        try:
            body = err.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return err.code, body


def _json_or_none(text: str) -> Optional[Dict]:
    try:
        obj = json.loads(text)
        return obj if isinstance(obj, dict) else None
    except Exception:
        return None


def _raise_if_failed(code: int, body: str, context: str) -> None:
    if 200 <= code < 300:
        return
    parsed = _json_or_none(body) or {}
    msg = parsed.get("message") or parsed.get("code") or body[:300]
    raise RuntimeError(f"{context} 실패: HTTP {code} / {msg}")


def _extract_page_title(page_obj: Dict) -> str:
    props = page_obj.get("properties")
    if isinstance(props, dict):
        title_prop = props.get("title")
        if isinstance(title_prop, dict):
            items = title_prop.get("title")
            if isinstance(items, list):
                text = "".join(
                    str(item.get("plain_text", ""))
                    for item in items
                    if isinstance(item, dict)
                ).strip()
                if text:
                    return text
    title = page_obj.get("title")
    if isinstance(title, list):
        text = "".join(
            str(item.get("plain_text", ""))
            for item in title
            if isinstance(item, dict)
        ).strip()
        if text:
            return text
    return ""


def find_root_page_id(token: str) -> str:
    pinned = os.getenv(ROOT_PAGE_ID_ENV, "").strip()
    if pinned:
        return pinned

    payload = {
        "query": DEFAULT_ROOT_TITLE,
        "filter": {"property": "object", "value": "page"},
        "page_size": 20,
    }
    code, body = _request("POST", "/search", token, payload)
    _raise_if_failed(code, body, "루트 페이지 검색")
    parsed = _json_or_none(body) or {}
    results = parsed.get("results")
    if not isinstance(results, list):
        raise RuntimeError("루트 페이지 검색 결과 형식이 올바르지 않습니다.")

    # 1) 정확히 제목이 일치하는 페이지 우선
    for page in results:
        if isinstance(page, dict) and _extract_page_title(page) == DEFAULT_ROOT_TITLE:
            page_id = page.get("id")
            if isinstance(page_id, str) and page_id:
                return page_id

    # 2) 없으면 첫 번째 검색 결과 사용
    if results and isinstance(results[0], dict):
        page_id = results[0].get("id")
        if isinstance(page_id, str) and page_id:
            return page_id

    raise RuntimeError(
        f"루트 페이지를 찾을 수 없습니다. 제목 '{DEFAULT_ROOT_TITLE}' 페이지 접근 권한을 확인하세요."
    )


def list_block_children(token: str, block_id: str) -> List[Dict]:
    out: List[Dict] = []
    cursor: Optional[str] = None
    while True:
        suffix = f"?page_size=100{f'&start_cursor={cursor}' if cursor else ''}"
        code, body = _request("GET", f"/blocks/{block_id}/children{suffix}", token)
        _raise_if_failed(code, body, "블록 목록 조회")
        parsed = _json_or_none(body) or {}
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


def find_child_page_by_title(token: str, parent_page_id: str, title: str) -> Optional[str]:
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


def create_child_page(
    token: str,
    parent_page_id: str,
    title: str,
    intro_lines: Optional[List[str]] = None,
) -> Tuple[str, str]:
    intro = intro_lines if intro_lines is not None else []
    if not intro:
        intro = ["자동 동기화 스냅샷 페이지입니다.", f"생성 시각(UTC): {now_utc()}"]

    payload = {
        "parent": {"page_id": parent_page_id},
        "properties": {
            "title": {
                "title": [{"type": "text", "text": {"content": title}}],
            }
        },
        "children": [paragraph_block(line) for line in intro if line],
    }
    code, body = _request("POST", "/pages", token, payload)
    _raise_if_failed(code, body, "스냅샷 페이지 생성")
    parsed = _json_or_none(body) or {}
    page_id = parsed.get("id")
    url = parsed.get("url")
    if not isinstance(page_id, str) or not page_id:
        raise RuntimeError("생성된 페이지 ID를 파싱할 수 없습니다.")
    if not isinstance(url, str):
        url = ""
    return page_id, url


def ensure_child_page(token: str, parent_page_id: str, title: str, description: str) -> str:
    existed = find_child_page_by_title(token, parent_page_id, title)
    if existed:
        return existed

    page_id, _ = create_child_page(
        token,
        parent_page_id,
        title,
        intro_lines=[description, f"생성 시각(UTC): {now_utc()}"],
    )
    return page_id


def archive_page(token: str, page_id: str) -> bool:
    payload = {"archived": True}
    code, body = _request("PATCH", f"/pages/{page_id}", token, payload)
    if 200 <= code < 300:
        return True
    parsed = _json_or_none(body) or {}
    msg = parsed.get("message") or parsed.get("code") or body[:300]
    eprint(f"페이지 아카이브 실패(page_id={page_id}): HTTP {code} / {msg}")
    return False


def normalize_block_for_append(block: Dict) -> Optional[Dict]:
    btype = block.get("type")
    if not isinstance(btype, str) or not btype:
        return None
    payload = block.get(btype)
    if not isinstance(payload, dict):
        return None

    rich = payload.get("rich_text")
    if not isinstance(rich, list):
        rich = []

    if btype in ("paragraph", "heading_2", "heading_3", "bulleted_list_item"):
        out_payload = {
            "rich_text": rich,
            "color": payload.get("color", "default"),
        }
        return {
            "object": "block",
            "type": btype,
            btype: out_payload,
        }

    if btype == "code":
        out_payload = {
            "rich_text": rich,
            "language": payload.get("language", "plain text"),
        }
        return {
            "object": "block",
            "type": "code",
            "code": out_payload,
        }

    if btype == "divider":
        return {
            "object": "block",
            "type": "divider",
            "divider": {},
        }

    text = rich_text_to_plain(rich) if rich else f"[unsupported block copied as text] {btype}"
    return paragraph_block(text)


def rich_text_to_plain(rich_text: object) -> str:
    if not isinstance(rich_text, list):
        return ""
    out: List[str] = []
    for item in rich_text:
        if isinstance(item, dict):
            out.append(str(item.get("plain_text", "")))
    return "".join(out)


def copy_snapshot_to_archive(
    token: str,
    source_page_id: str,
    source_title: str,
    archive_parent_id: str,
) -> bool:
    existed = find_child_page_by_title(token, archive_parent_id, source_title)
    if existed:
        return True

    new_page_id, _ = create_child_page(
        token,
        archive_parent_id,
        source_title,
        intro_lines=[
            f"archive source page id: {source_page_id}",
            f"archived at(UTC): {now_utc()}",
        ],
    )
    source_blocks = list_block_children(token, source_page_id)
    appendable: List[Dict] = []
    for blk in source_blocks:
        converted = normalize_block_for_append(blk)
        if converted:
            appendable.append(converted)
    if appendable:
        append_children(token, new_page_id, appendable)
    return True


def archive_snapshot_pages(
    token: str,
    source_parent_id: str,
    archive_parent_id: str,
    keep_page_ids: set[str],
    skip_page_ids: set[str],
) -> Tuple[int, int]:
    archived = 0
    failed = 0
    children = list_block_children(token, source_parent_id)
    for blk in children:
        if blk.get("type") != "child_page":
            continue
        page_id = blk.get("id")
        if not isinstance(page_id, str) or not page_id:
            continue
        if page_id in keep_page_ids or page_id in skip_page_ids or page_id == archive_parent_id:
            continue

        title = ""
        child_page = blk.get("child_page")
        if isinstance(child_page, dict):
            title = str(child_page.get("title", "")).strip()
        if not title.startswith(SNAPSHOT_TITLE_PREFIX):
            continue

        try:
            copy_snapshot_to_archive(token, page_id, title, archive_parent_id)
            if archive_page(token, page_id):
                archived += 1
            else:
                failed += 1
        except Exception as exc:
            eprint(f"old 보관 처리 실패(page_id={page_id}): {exc}")
            failed += 1
    return archived, failed


def append_children(token: str, block_id: str, blocks: List[Dict]) -> None:
    for i in range(0, len(blocks), APPEND_BATCH_SIZE):
        batch = blocks[i : i + APPEND_BATCH_SIZE]
        payload = {"children": batch}
        code, body = _request("PATCH", f"/blocks/{block_id}/children", token, payload)
        _raise_if_failed(code, body, "블록 추가")


def heading2_block(text: str) -> Dict:
    return {
        "object": "block",
        "type": "heading_2",
        "heading_2": {"rich_text": [rich_text(text)]},
    }


def heading3_block(text: str) -> Dict:
    return {
        "object": "block",
        "type": "heading_3",
        "heading_3": {"rich_text": [rich_text(text)]},
    }


def paragraph_block(text: str) -> Dict:
    return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {"rich_text": [rich_text(text)]},
    }


def bullet_block(text: str) -> Dict:
    return {
        "object": "block",
        "type": "bulleted_list_item",
        "bulleted_list_item": {"rich_text": [rich_text(text)]},
    }


def code_block(text: str, language: str = "plain text") -> Dict:
    return {
        "object": "block",
        "type": "code",
        "code": {
            "language": language,
            "rich_text": [rich_text(text)],
        },
    }


def rich_text(text: str) -> Dict:
    safe = text[:MAX_RICH_TEXT_CHARS]
    return {"type": "text", "text": {"content": safe}}


def chunk_text(text: str, size: int = MAX_RICH_TEXT_CHARS) -> Iterable[str]:
    if not text:
        yield ""
        return
    start = 0
    text_len = len(text)
    while start < text_len:
        yield text[start : start + size]
        start += size


TOKEN_PATTERNS = [
    (re.compile(r"ntn_[A-Za-z0-9]+"), "ntn_REDACTED"),
    (re.compile(r"secret_[A-Za-z0-9]+"), "secret_REDACTED"),
    (re.compile(r"sk-[A-Za-z0-9_-]+"), "sk-REDACTED"),
]

ASSIGNMENT_RE = re.compile(
    r"(?im)^(\s*[^#\n]*?(token|secret|api[_-]?key|password)[^:=\n]*[:=]\s*)(.+)$"
)


def sanitize_text(text: str) -> str:
    out = text
    for pat, repl in TOKEN_PATTERNS:
        out = pat.sub(repl, out)

    def repl_assign(m: re.Match) -> str:
        prefix = m.group(1)
        value = m.group(3).strip()
        # 따옴표/주석 등 원본 문맥은 보존하되 값만 마스킹
        if value.startswith(("'", '"')):
            q = value[0]
            return f"{prefix}{q}REDACTED{q}"
        return f"{prefix}REDACTED"

    out = ASSIGNMENT_RE.sub(repl_assign, out)
    return out


def read_utf8(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="replace")


def display_path(path: Path) -> str:
    raw = str(path).replace("\\", "/")
    home = str(HOME_ROOT).replace("\\", "/")
    home_prefix = home.rstrip("/") + "/"
    if raw.lower() == home.lower():
        return "$HOME"
    if raw.lower().startswith(home_prefix.lower()):
        return "$HOME/" + raw[len(home_prefix) :]
    return raw


def trimmed_for_notion(text: str, limit: int = MAX_FILE_CHARS) -> Tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    return text[:limit], True


def file_blocks(label: str, path: Path, include_body: bool = True) -> List[Dict]:
    blocks: List[Dict] = [heading3_block(label), bullet_block(f"path: {display_path(path)}")]
    if not path.exists():
        blocks.append(paragraph_block("파일이 존재하지 않습니다."))
        return blocks

    stat = path.stat()
    blocks.append(bullet_block(f"size: {stat.st_size} bytes"))
    blocks.append(
        bullet_block(
            "modified(UTC): "
            + dt.datetime.utcfromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M:%SZ")
        )
    )
    if not include_body:
        return blocks

    raw = read_utf8(path)
    sanitized = sanitize_text(raw)
    body, truncated = trimmed_for_notion(sanitized)
    for part in chunk_text(body):
        blocks.append(code_block(part))
    if truncated:
        blocks.append(paragraph_block("본문이 길어 일부를 잘라서 기록했습니다."))
    return blocks


def collect_skill_inventory(skill_root: Path) -> List[Path]:
    if not skill_root.exists():
        return []
    return sorted(skill_root.glob("*/SKILL.md"))


def build_sync_blocks() -> List[Dict]:
    blocks: List[Dict] = []

    # 1) 개요
    blocks.append(heading2_block("동기화 개요"))
    blocks.append(paragraph_block("MCP 우회 경로(Notion REST API)로 설정 스냅샷을 기록합니다."))
    blocks.append(paragraph_block(f"workspace: {display_path(WORKSPACE_ROOT)}"))
    blocks.append(paragraph_block(f"global codex root: {display_path(GLOBAL_CODEX_ROOT)}"))

    # 2) 전역 규칙/설정
    blocks.append(heading2_block("전역 규칙/설정"))
    global_files = [
        ("Global AGENTS", GLOBAL_CODEX_ROOT / "AGENTS.md", True),
        ("Global default.rules", GLOBAL_CODEX_ROOT / "rules" / "default.rules", True),
        ("Global config.toml (sanitized)", GLOBAL_CODEX_ROOT / "config.toml", True),
    ]
    for label, path, include in global_files:
        blocks.extend(file_blocks(label, path, include))

    # 3) 전역 스킬 인벤토리
    blocks.append(heading2_block("전역 스킬 인벤토리"))
    global_skills = collect_skill_inventory(GLOBAL_CODEX_ROOT / "skills")
    if not global_skills:
        blocks.append(paragraph_block("전역 스킬을 찾지 못했습니다."))
    else:
        blocks.append(paragraph_block(f"총 {len(global_skills)}개 SKILL.md"))
        for sk in global_skills:
            blocks.append(bullet_block(display_path(sk)))

    # 4) 워크스페이스 규칙/컨텍스트
    blocks.append(heading2_block("워크스페이스 규칙/컨텍스트"))
    workspace_files = [
        ("Workspace AGENTS", WORKSPACE_ROOT / "AGENTS.md", True),
        ("Project Context", WORKSPACE_ROOT / ".agent" / "Project_Context.md", True),
        ("Rules & Skills Summary", WORKSPACE_ROOT / "docs" / "Resources" / "Rules_Skills_Summary.md", True),
        ("Docs Index", WORKSPACE_ROOT / "docs" / "README.md", True),
        ("Package Scripts", WORKSPACE_ROOT / "package.json", True),
    ]
    for label, path, include in workspace_files:
        blocks.extend(file_blocks(label, path, include))

    # 5) Notion 운영 스크립트
    blocks.append(heading2_block("Notion 운영 스크립트"))
    notion_ops_files = [
        ("Notion Sync Script", WORKSPACE_ROOT / "scripts" / "notion_sync_settings.py", True),
        ("Notion Watch Script", WORKSPACE_ROOT / "scripts" / "notion_sync_watch.py", True),
        ("Notion Bootstrap Pull Script", WORKSPACE_ROOT / "scripts" / "notion_bootstrap_pull.py", True),
        ("Notion Bootstrap Apply Script", WORKSPACE_ROOT / "scripts" / "notion_bootstrap_apply.py", True),
        ("Notion Runbook", WORKSPACE_ROOT / "docs" / "Resources" / "Notion_Sync_Runbook.md", True),
        ("Notion Human Guide", WORKSPACE_ROOT / "docs" / "Resources" / "Notion_Human_Guide.md", True),
    ]
    for label, path, include in notion_ops_files:
        blocks.extend(file_blocks(label, path, include))

    # 6) 워크스페이스 스킬 본문
    blocks.append(heading2_block("워크스페이스 스킬"))
    ws_skills = sorted((WORKSPACE_ROOT / ".agent" / "skills").glob("*/SKILL.md"))
    if not ws_skills:
        blocks.append(paragraph_block("워크스페이스 스킬을 찾지 못했습니다."))
    else:
        for sk in ws_skills:
            blocks.extend(file_blocks(f"Workspace Skill: {sk.parent.name}", sk, True))

    # 7) 문서 예시 목록
    blocks.append(heading2_block("문서 예시"))
    doc_examples = [
        WORKSPACE_ROOT / "docs" / "Resources" / "PRD" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Flow" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Design" / "README.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Backlog.md",
        WORKSPACE_ROOT / "docs" / "Resources" / "Playwright_Map_Test_Protocol.md",
        WORKSPACE_ROOT / "docs" / "TestData" / "README.md",
        WORKSPACE_ROOT / "docs" / "Progress" / "README.md",
    ]
    for p in doc_examples:
        blocks.extend(file_blocks(f"Doc Example: {p.name}", p, True))

    return blocks


def main() -> int:
    token = os.getenv(TOKEN_ENV, "").strip()
    if not token:
        eprint(f"환경변수 {TOKEN_ENV} 이(가) 비어 있습니다.")
        return 1

    try:
        root_page_id = find_root_page_id(token)
        settings_page_id = ensure_child_page(
            token,
            root_page_id,
            SETTINGS_PAGE_TITLE,
            "Codex 설정 스냅샷 전용 페이지",
        )
        archive_page_id = ensure_child_page(
            token,
            settings_page_id,
            ARCHIVE_PAGE_TITLE,
            "오래된 Codex 설정 스냅샷 보관 페이지",
        )

        title = f"{SNAPSHOT_TITLE_PREFIX} {dt.datetime.utcnow().strftime('%Y-%m-%d %H:%M:%SZ')}"
        page_id, page_url = create_child_page(token, settings_page_id, title)
        blocks = build_sync_blocks()
        append_children(token, page_id, blocks)

        moved_a, failed_a = archive_snapshot_pages(
            token,
            source_parent_id=settings_page_id,
            archive_parent_id=archive_page_id,
            keep_page_ids={page_id},
            skip_page_ids=set(),
        )
        moved_b, failed_b = archive_snapshot_pages(
            token,
            source_parent_id=root_page_id,
            archive_parent_id=archive_page_id,
            keep_page_ids={page_id},
            skip_page_ids={settings_page_id, archive_page_id},
        )
    except Exception as exc:
        eprint(f"동기화 실패: {exc}")
        return 2

    print("SYNC_RESULT=SUCCESS")
    print(f"SYNC_PAGE_ID={page_id}")
    print(f"SYNC_PAGE_URL={page_url}")
    print(f"SYNC_SETTINGS_PAGE_ID={settings_page_id}")
    print(f"SYNC_ARCHIVE_PAGE_ID={archive_page_id}")
    print(f"SYNC_ARCHIVED_TO_OLD={moved_a + moved_b}")
    print(f"SYNC_MOVE_FAILED={failed_a + failed_b}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
