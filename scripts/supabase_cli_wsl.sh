#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="$ROOT_DIR/.tools/supabase-cli"
BIN_PATH="$BIN_DIR/supabase"
LOCK_PATH="$BIN_DIR/.install.lock"

resolve_arch() {
  local arch
  arch="$(uname -m)"
  case "$arch" in
    x86_64|amd64) echo "amd64" ;;
    aarch64|arm64) echo "arm64" ;;
    *)
      echo "지원하지 않는 아키텍처: $arch" >&2
      return 1
      ;;
  esac
}

ensure_supabase_cli() {
  mkdir -p "$BIN_DIR"

  # 병렬 호출 시 bootstrap 충돌을 막기 위한 파일 락
  exec 9>"$LOCK_PATH"
  if command -v flock >/dev/null 2>&1; then
    flock 9
  fi

  if [ -x "$BIN_PATH" ]; then
    return 0
  fi

  local arch
  arch="$(resolve_arch)"
  local url
  url="https://github.com/supabase/cli/releases/latest/download/supabase_linux_${arch}.tar.gz"

  echo "SUPABASE_CLI_BOOTSTRAP=START"
  echo "SUPABASE_CLI_URL=$url"

  curl -fsSL "$url" | tar -xz -C "$BIN_DIR"

  if [ ! -f "$BIN_PATH" ]; then
    echo "SUPABASE_CLI_BOOTSTRAP=FAILED" >&2
    echo "supabase 바이너리를 찾을 수 없습니다: $BIN_PATH" >&2
    return 1
  fi

  chmod +x "$BIN_PATH"
  echo "SUPABASE_CLI_BOOTSTRAP=SUCCESS"
}

ensure_supabase_cli
exec "$BIN_PATH" "$@"
