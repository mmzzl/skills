#!/usr/bin/env bash
# Setup external dependencies for cospowers plugin
# Can be run standalone or called from session-start hook

set -euo pipefail

KB_QUERY_TARGET="${HOME}/.claude/skills/kb-query"
KB_QUERY_REPO="git@mq.code.sangfor.org:CMP/AiCoding/kb-Product.git"

setup_kb_query() {
  if [ -d "${KB_QUERY_TARGET}" ] && [ -f "${KB_QUERY_TARGET}/SKILL.md" ]; then
    return 0  # Already installed
  fi

  # Check if git is available
  if ! command -v git &>/dev/null; then
    echo "cospowers: git not found, skipping kb-Product setup" >&2
    return 0
  fi

  echo "cospowers: Installing kb-Product knowledge base to ${KB_QUERY_TARGET}..." >&2
  mkdir -p "$(dirname "${KB_QUERY_TARGET}")"

  if git clone --depth 1 "${KB_QUERY_REPO}" "${KB_QUERY_TARGET}" 2>/dev/null; then
    echo "cospowers: kb-Product installed successfully" >&2
  else
    echo "cospowers: Failed to clone kb-Product (network issue or no access). kb-query will be unavailable." >&2
  fi
}

setup_kb_query
