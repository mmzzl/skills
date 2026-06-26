#!/usr/bin/env pwsh
<#
.SYNOPSIS
    One-click install of cospowers for opencode and/or Claude Code.

.DESCRIPTION
    Detects available platforms, copies skills/configuration, and registers
    cospowers as a plugin. Supports both opencode and Claude Code.

.PARAMETER Platform
    Target platform: 'opencode', 'claude', or 'all' (default: all)

.PARAMETER SourcePath
    Path to the cospowers plugin root (default: auto-detected from script location)

.PARAMETER Version
    Plugin version for Claude Code registration (default: auto-read from plugin.json)

.EXAMPLE
    .\scripts\install.ps1                     # Install for all detected platforms
    .\scripts\install.ps1 -Platform opencode   # opencode only
    .\scripts\install.ps1 -Platform claude     # Claude Code only
#>

param(
    [ValidateSet('opencode', 'claude', 'all')]
    [string]$Platform = 'all',

    [string]$SourcePath = '',

    [string]$Version = ''
)

function Write-Step { param([string]$Msg) Write-Host "`n==> $Msg" -ForegroundColor Cyan }
function Write-Info  { param([string]$Msg) Write-Host "    $Msg" -ForegroundColor Gray }
function Write-OK   { param([string]$Msg) Write-Host "    [+] $Msg" -ForegroundColor Green }
function Write-Skip { param([string]$Msg) Write-Host "    [-] $Msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$Msg) Write-Host "    [!] $Msg" -ForegroundColor Red }

# Join-Path in PS5.1 only accepts 2 args; this wrapper handles n args
function Join-Paths {
    $result = $null
    foreach ($part in $args) {
        if ($result -eq $null) { $result = $part } else { $result = Join-Path $result $part }
    }
    return $result
}

# --- Auto-detect source path -------------------------------------------------
if (-not $SourcePath) {
    $scriptDir = Split-Path -Parent $PSCommandPath
    $SourcePath = Split-Path -Parent $scriptDir
}
$SourcePath = Resolve-Path $SourcePath

$pluginJsonPath = Join-Paths $SourcePath '.claude-plugin' 'plugin.json'
if (-not (Test-Path $pluginJsonPath)) {
    Write-Err "No .claude-plugin/plugin.json found at $SourcePath — is this the cospowers root?"
    exit 1
}

if (-not $Version) {
    $pluginMeta = Get-Content $pluginJsonPath -Raw | ConvertFrom-Json
    $Version = $pluginMeta.version
}

Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        cospowers v$Version Installer          ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "Source : $SourcePath"
Write-Host "Platform(s): $Platform"
Write-Host ""

# =============================================================================
# opencode
# =============================================================================
if ($Platform -in @('opencode', 'all')) {
    Write-Step "Installing for opencode..."

    $ocRoot    = Join-Path $env:USERPROFILE '.opencode'
    $ocSkills  = Join-Path $ocRoot 'skills'
    $ocTpl     = Join-Path $ocRoot 'templates'
    $ocRules   = Join-Path $ocRoot 'rules'
    $ocAgents  = Join-Path $ocRoot 'agents'
    $ocDocs    = Join-Path $ocRoot 'docs'
    $ocConfig  = Join-Path $ocRoot 'cospowers.config.json'

    foreach ($d in @($ocSkills, $ocTpl, $ocRules, $ocAgents, $ocDocs)) {
        New-Item -ItemType Directory -Force -Path $d | Out-Null
    }

    Write-Info "Copying skills..."
    $srcSkills = Join-Path $SourcePath 'skills'
    robocopy $srcSkills $ocSkills /E /NJH /NJS /NDL /NP > $null 2>&1
    $skillCount = (Get-ChildItem $ocSkills -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') }).Count
    Write-OK "$skillCount skills installed"

    Write-Info "Copying templates..."
    robocopy (Join-Path $SourcePath 'templates') $ocTpl /E /NJH /NJS /NDL /NP > $null 2>&1
    $tplCount = (Get-ChildItem $ocTpl -Recurse -File).Count
    Write-OK "$tplCount template files"

    Write-Info "Copying rules..."
    robocopy (Join-Path $SourcePath 'rules') $ocRules /E /NJH /NJS /NDL /NP > $null 2>&1
    $ruleDirs = (Get-ChildItem $ocRules -Directory).Count
    Write-OK "$ruleDirs rule directories"

    Write-Info "Copying agents..."
    if (Test-Path (Join-Path $SourcePath 'agents')) {
        robocopy (Join-Path $SourcePath 'agents') $ocAgents /E /NJH /NJS /NDL /NP > $null 2>&1
    }
    Write-OK "agents copied"

    Write-Info "Copying docs..."
    if (Test-Path (Join-Path $SourcePath 'docs')) {
        robocopy (Join-Path $SourcePath 'docs') $ocDocs /E /NJH /NJS /NDL /NP > $null 2>&1
    }
    Write-OK "docs copied"

    if (-not (Test-Path $ocConfig)) {
        $srcConfig = Join-Path $SourcePath 'cospowers.config.json'
        if (Test-Path $srcConfig) {
            Get-Content $srcConfig -Raw | Set-Content $ocConfig
            Write-OK "config created"
        }
    } else {
        Write-Skip "config already exists — not overwriting"
    }

    $ocPluginDir = Join-Path $ocRoot 'plugins'
    New-Item -ItemType Directory -Force -Path $ocPluginDir | Out-Null
    $ocPluginManifest = Join-Path $ocPluginDir 'cospowers.json'
    $skillNames = Get-ChildItem (Join-Path $SourcePath 'skills') -Directory | Where-Object { Test-Path (Join-Path $_.FullName 'SKILL.md') } | Select-Object -ExpandProperty Name
    @{
        name        = "cospowers"
        version     = $Version
        description = "AI-powered end-to-end development workflow"
        skills      = @($skillNames)
    } | ConvertTo-Json | Set-Content $ocPluginManifest
    Write-OK "plugin manifest created"

    Write-OK "opencode installation complete"
}

# =============================================================================
# Claude Code
# =============================================================================
if ($Platform -in @('claude', 'all')) {
    Write-Step "Installing for Claude Code..."

    $claudeDir = Join-Path $env:USERPROFILE '.claude'
    $cacheBase = Join-Paths $claudeDir 'plugins' 'cache'
    $marketplaceDir = Join-Paths $claudeDir 'plugins' 'marketplaces'
    $marketplaceName = 'cospowers-local'
    $pluginName = 'cospowers'
    $installPath = Join-Paths $cacheBase $marketplaceName $pluginName $Version

    if (-not (Test-Path $claudeDir)) {
        Write-Skip "Claude Code not found (~/.claude/ missing)"
        return
    }

    # 1. Copy plugin files to cache
    Write-Info "Copying plugin files to cache..."
    New-Item -ItemType Directory -Force -Path $installPath | Out-Null
    robocopy $SourcePath $installPath /E /NJH /NJS /NDL /NP /XD .git node_modules > $null 2>&1
    Write-OK "Plugin copied to $installPath"

    # 2. Register marketplace in known_marketplaces.json
    $knownMarketplacesPath = Join-Paths $claudeDir 'plugins' 'known_marketplaces.json'
    $knownMarketplaces = @{}
    if (Test-Path $knownMarketplacesPath) {
        try { $knownMarketplaces = Get-Content $knownMarketplacesPath -Raw | ConvertFrom-Json } catch {}
    }
    $nameExists = $false
    try { $nameExists = $knownMarketplaces.PSObject.Properties.Name -contains $marketplaceName } catch {}
    if (-not $nameExists) {
        $entry = New-Object PSObject
        $entry | Add-Member -NotePropertyName 'source' -NotePropertyValue @{ source = 'local'; path = $SourcePath }
        $entry | Add-Member -NotePropertyName 'installLocation' -NotePropertyValue $marketplaceDir
        $entry | Add-Member -NotePropertyName 'lastUpdated' -NotePropertyValue (Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ')
        $knownMarketplaces | Add-Member -NotePropertyName $marketplaceName -NotePropertyValue $entry -Force
        $knownMarketplaces | ConvertTo-Json -Depth 10 | Set-Content $knownMarketplacesPath
        Write-OK "Marketplace '$marketplaceName' registered"
    } else {
        Write-Skip "Marketplace '$marketplaceName' already registered"
    }

    # 3. Register installed plugin
    $installedPluginsPath = Join-Paths $claudeDir 'plugins' 'installed_plugins.json'
    $installedPlugins = @{ version = 2; plugins = @{} }
    if (Test-Path $installedPluginsPath) {
        try { $installedPlugins = Get-Content $installedPluginsPath -Raw | ConvertFrom-Json } catch {}
    }
    $pluginKey = "$pluginName@$marketplaceName"
    $now = Get-Date -Format 'yyyy-MM-ddTHH:mm:ss.fffZ'
    $existing = $null
    try { $existing = $installedPlugins.plugins.$pluginKey } catch {}
    if ($existing) {
        $existing[0].installPath = $installPath
        $existing[0].version = $Version
        $existing[0].lastUpdated = $now
        Write-Skip "Plugin '$pluginKey' updated"
    } else {
        $newEntry = @( , @{
            scope       = 'user'
            installPath = $installPath
            version     = $Version
            installedAt = $now
            lastUpdated = $now
        })
        if (-not $installedPlugins.plugins) { $installedPlugins = @{ version = 2; plugins = @{} } }
        $installedPlugins.plugins | Add-Member -NotePropertyName $pluginKey -NotePropertyValue $newEntry -Force
        Write-OK "Plugin '$pluginKey' registered"
    }
    $installedPlugins | ConvertTo-Json -Depth 10 | Set-Content $installedPluginsPath

    # 4. Create marketplace entry
    $mpPluginDir = Join-Path $marketplaceDir $marketplaceName
    New-Item -ItemType Directory -Force -Path (Join-Path $mpPluginDir '.claude-plugin') | Out-Null
    $mpMarketplaceJson = Join-Paths $mpPluginDir '.claude-plugin' 'marketplace.json'
    if (-not (Test-Path $mpMarketplaceJson)) {
        @{
            name        = $marketplaceName
            description = "Local cospowers plugin"
            owner       = @{ name = "cospowers" }
            plugins     = @( , @{
                name        = $pluginName
                description = "AI-powered end-to-end development workflow"
                version     = $Version
                source      = "./"
                author      = @{ name = "cospowers" }
            })
        } | ConvertTo-Json -Depth 10 | Set-Content $mpMarketplaceJson
        Write-OK "Marketplace plugin listing created"
    }

    Write-OK "Claude Code installation complete"
    Write-Info "Restart Claude Code to pick up the plugin."
}

Write-Host ""
Write-Host "Done!" -ForegroundColor Green
