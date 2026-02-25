#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_line() {
  printf '%s\n' "$1"
}

check_cmd_path() {
  local name="$1"
  local path
  path="$(command -v "$name" 2>/dev/null || true)"
  if [ -z "$path" ]; then
    print_line "${name}: missing"
    return
  fi
  print_line "${name}: ${path}"
  case "$path" in
    /mnt/c/*)
      print_line "  warn: Windows 경로를 참조 중입니다. WSL 네이티브 설치 권장"
      ;;
  esac
}

print_line "[WSL Doctor]"
print_line "workspace: ${ROOT_DIR}"
print_line "uname: $(uname -s) $(uname -m)"
print_line ""

check_cmd_path node
check_cmd_path npm
check_cmd_path npx
check_cmd_path docker
check_cmd_path supabase

print_line ""
print_line "[Supabase CLI]"
if npx supabase --version >/tmp/supabase_npx_version.txt 2>&1; then
  print_line "supabase_npx: ok"
  cat /tmp/supabase_npx_version.txt
else
  print_line "supabase_npx: failed"
  cat /tmp/supabase_npx_version.txt
  print_line "fallback: scripts/supabase_cli_wsl.sh"
  if bash "$ROOT_DIR/scripts/supabase_cli_wsl.sh" --version >/tmp/supabase_wsl_version.txt 2>&1; then
    print_line "supabase_cli_wsl: ok"
    cat /tmp/supabase_wsl_version.txt
  else
    print_line "supabase_cli_wsl: failed"
    cat /tmp/supabase_wsl_version.txt
  fi
fi

print_line ""
print_line "[Docker Reachability]"
if docker ps >/tmp/docker_ps_out.txt 2>&1; then
  print_line "docker ps: ok"
else
  print_line "docker ps: failed"
  sed -n '1,20p' /tmp/docker_ps_out.txt
fi

print_line ""
print_line "[Notion Token]"
if python3 - <<'PY'
import os
print('set' if os.getenv('NOTION_MCP_TOKEN') else 'missing')
PY
then
  true
fi
