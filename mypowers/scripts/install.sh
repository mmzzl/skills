#!/usr/bin/env bash
#
# cospowers Install Script — opencode + Claude Code
#
# Usage:
#   ./scripts/install.sh                          # Install for all platforms
#   ./scripts/install.sh --platform opencode       # opencode only
#   ./scripts/install.sh --platform claude         # Claude Code only
#   ./scripts/install.sh --source /path/to/cospowers
#   ./scripts/install.sh --version 2.0.0
#
set -euo pipefail

# ---- Colors ----------------------------------------------------------------
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m'

step() { echo -e "\n${CYAN}==>${NC} ${CYAN}$1${NC}"; }
info() { echo -e "    ${GRAY}$1${NC}"; }
ok()   { echo -e "    ${GREEN}[+]${NC} $1"; }
skip() { echo -e "    ${YELLOW}[-]${NC} $1"; }
err()  { echo -e "    ${RED}[!]${NC} $1"; }

# ---- Parse args ------------------------------------------------------------
PLATFORM="all"
SOURCE_PATH=""
VERSION=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --platform)  PLATFORM="$2";  shift 2 ;;
        --source)    SOURCE_PATH="$2"; shift 2 ;;
        --version)   VERSION="$2";   shift 2 ;;
        -h|--help)
            echo "Usage: $0 [--platform opencode|claude|all] [--source PATH] [--version X.Y.Z]"
            exit 0 ;;
        *) err "Unknown: $1"; exit 1 ;;
    esac
done

# ---- Detect source path ----------------------------------------------------
if [[ -z "$SOURCE_PATH" ]]; then
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    SOURCE_PATH="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

PLUGIN_JSON="$SOURCE_PATH/.claude-plugin/plugin.json"
if [[ ! -f "$PLUGIN_JSON" ]]; then
    err "No .claude-plugin/plugin.json at $SOURCE_PATH — is this the cospowers root?"
    exit 1
fi

if [[ -z "$VERSION" ]]; then
    VERSION=$(grep -o '"version": *"[^"]*"' "$PLUGIN_JSON" | head -1 | cut -d'"' -f4)
fi

echo -e "${CYAN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        cospowers v$VERSION Installer          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════╝${NC}"
echo "Source : $SOURCE_PATH"
echo "Platform(s): $PLATFORM"
echo ""

# =============================================================================
# opencode
# =============================================================================
if [[ "$PLATFORM" == "opencode" || "$PLATFORM" == "all" ]]; then
    step "Installing for opencode..."

    OC_SKILLS="$HOME/.opencode/skills"
    OC_TPL="$HOME/.opencode/templates"
    OC_RULES="$HOME/.opencode/rules"
    OC_AGENTS="$HOME/.opencode/agents"
    OC_DOCS="$HOME/.opencode/docs"
    OC_CONFIG="$HOME/.opencode/cospowers.config.json"
    OC_PLUGINS="$HOME/.opencode/plugins"

    mkdir -p "$OC_SKILLS" "$OC_TPL" "$OC_RULES" "$OC_AGENTS" "$OC_DOCS" "$OC_PLUGINS"

    # Copy skills
    info "Copying skills..."
    cp -rf "$SOURCE_PATH/skills/"* "$OC_SKILLS/" 2>/dev/null || true
    skill_count=$(find "$OC_SKILLS" -maxdepth 2 -name 'SKILL.md' | wc -l)
    ok "$skill_count skills installed"

    # Copy templates
    info "Copying templates..."
    cp -rf "$SOURCE_PATH/templates/"* "$OC_TPL/" 2>/dev/null || true
    tpl_count=$(find "$OC_TPL" -type f | wc -l)
    ok "$tpl_count template files"

    # Copy rules
    info "Copying rules..."
    cp -rf "$SOURCE_PATH/rules/"* "$OC_RULES/" 2>/dev/null || true
    rule_dirs=$(find "$OC_RULES" -maxdepth 1 -type d | wc -l)
    ok "$rule_dirs rule directories"

    # Copy agents
    if [[ -d "$SOURCE_PATH/agents" ]]; then
        cp -rf "$SOURCE_PATH/agents/"* "$OC_AGENTS/" 2>/dev/null || true
    fi
    ok "agents copied"

    # Copy docs
    if [[ -d "$SOURCE_PATH/docs" ]]; then
        cp -rf "$SOURCE_PATH/docs/"* "$OC_DOCS/" 2>/dev/null || true
    fi
    ok "docs copied"

    # Copy config (only if not exists)
    if [[ ! -f "$OC_CONFIG" ]]; then
        src_config="$SOURCE_PATH/cospowers.config.json"
        if [[ -f "$src_config" ]]; then
            cp "$src_config" "$OC_CONFIG"
            ok "config created"
        fi
    else
        skip "config already exists — not overwriting"
    fi

    # Create plugin manifest
    plugin_manifest="{\"name\":\"cospowers\",\"version\":\"$VERSION\",\"description\":\"AI-powered end-to-end development workflow\""
    plugin_manifest+=",\"skills\":["
    first=1
    for d in "$SOURCE_PATH/skills/"*/; do
        name=$(basename "$d")
        if [[ -f "$d/SKILL.md" ]]; then
            if [[ $first -eq 0 ]]; then plugin_manifest+=","; fi
            plugin_manifest+="\"$name\""
            first=0
        fi
    done
    plugin_manifest+="]}"
    echo "$plugin_manifest" > "$OC_PLUGINS/cospowers.json"
    ok "plugin manifest created"

    ok "opencode installation complete"
fi

# =============================================================================
# Claude Code
# =============================================================================
if [[ "$PLATFORM" == "claude" || "$PLATFORM" == "all" ]]; then
    step "Installing for Claude Code..."

    CLAUDE_DIR="$HOME/.claude"
    CACHE_BASE="$CLAUDE_DIR/plugins/cache"
    MARKETPLACE_DIR="$CLAUDE_DIR/plugins/marketplaces"
    MARKETPLACE_NAME="cospowers-local"
    PLUGIN_NAME="cospowers"
    INSTALL_PATH="$CACHE_BASE/$MARKETPLACE_NAME/$PLUGIN_NAME/$VERSION"

    if [[ ! -d "$CLAUDE_DIR" ]]; then
        skip "Claude Code not found (~/.claude/ missing)"
        echo "    Skipping Claude Code installation."
    fi

    # 1. Copy plugin files to cache
    info "Copying plugin files to cache..."
    mkdir -p "$INSTALL_PATH"
    rsync -a --exclude='.git' --exclude='node_modules' "$SOURCE_PATH/" "$INSTALL_PATH/" 2>/dev/null || \
        cp -rf "$SOURCE_PATH"/* "$INSTALL_PATH/" 2>/dev/null || true
    ok "Plugin copied to $INSTALL_PATH"

    # 2. Register marketplace in known_marketplaces.json
    KM_PATH="$CLAUDE_DIR/plugins/known_marketplaces.json"
    if [[ -f "$KM_PATH" ]]; then
        if grep -q "\"$MARKETPLACE_NAME\"" "$KM_PATH" 2>/dev/null; then
            skip "Marketplace '$MARKETPLACE_NAME' already registered"
        else
            # Append entry (using Python if available for safe JSON manipulation)
            if command -v python3 &>/dev/null; then
                python3 -c "
import json, datetime
with open('$KM_PATH', 'r') as f: data = json.load(f)
data['$MARKETPLACE_NAME'] = {
    'source': {'source': 'local', 'path': '$SOURCE_PATH'},
    'installLocation': '$MARKETPLACE_DIR',
    'lastUpdated': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.%fZ')
}
with open('$KM_PATH', 'w') as f: json.dump(data, f, indent=2)
" 2>/dev/null && ok "Marketplace '$MARKETPLACE_NAME' registered" || err "Failed to register marketplace"
            fi
    else
        cat > "$KM_PATH" <<EOF
{
  "$MARKETPLACE_NAME": {
    "source": { "source": "local", "path": "$SOURCE_PATH" },
    "installLocation": "$MARKETPLACE_DIR",
    "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%S.%fZ)"
  }
}
EOF
        ok "Marketplace '$MARKETPLACE_NAME' created"
    fi

    # 3. Register installed plugin
    IP_PATH="$CLAUDE_DIR/plugins/installed_plugins.json"
    PLUGIN_KEY="${PLUGIN_NAME}@${MARKETPLACE_NAME}"
    NOW=$(date -u +%Y-%m-%dT%H:%M:%S.%fZ)

    if command -v python3 &>/dev/null; then
        python3 -c "
import json, os
path = '$IP_PATH'
if os.path.exists(path):
    with open(path, 'r') as f: data = json.load(f)
else:
    data = {'version': 2, 'plugins': {}}
key = '$PLUGIN_KEY'
entry = {
    'scope': 'user',
    'installPath': '$INSTALL_PATH',
    'version': '$VERSION',
    'installedAt': '$NOW',
    'lastUpdated': '$NOW'
}
data.setdefault('plugins', {})[key] = [entry]
with open(path, 'w') as f: json.dump(data, f, indent=2)
print('ok')
" 2>/dev/null && ok "Plugin '$PLUGIN_KEY' registered" || err "Failed to register plugin"
    else
        # Fallback: write file directly
        cat > "$IP_PATH" <<EOF
{
  "version": 2,
  "plugins": {
    "$PLUGIN_KEY": [
      {
        "scope": "user",
        "installPath": "$INSTALL_PATH",
        "version": "$VERSION",
        "installedAt": "$NOW",
        "lastUpdated": "$NOW"
      }
    ]
  }
}
EOF
        ok "Plugin '$PLUGIN_KEY' registered"
    fi

    # 4. Create marketplace directory and plugin listing
    mkdir -p "$MARKETPLACE_DIR/$MARKETPLACE_NAME/.claude-plugin"
    MP_JSON="$MARKETPLACE_DIR/$MARKETPLACE_NAME/.claude-plugin/marketplace.json"
    if [[ ! -f "$MP_JSON" ]]; then
        cat > "$MP_JSON" <<EOF
{
  "name": "$MARKETPLACE_NAME",
  "description": "Local cospowers plugin",
  "owner": { "name": "cospowers" },
  "plugins": [
    {
      "name": "$PLUGIN_NAME",
      "description": "AI-powered end-to-end development workflow",
      "version": "$VERSION",
      "source": "./",
      "author": { "name": "cospowers" }
    }
  ]
}
EOF
        ok "Marketplace plugin listing created"
    fi

    ok "Claude Code installation complete"
    info "Restart Claude Code to pick up the plugin."
fi

echo -e "\n${GREEN}Done!${NC}"
