# release-gate.ps1 - ONE-COMMAND RELEASE GATE
# ---------------------------------------------------------------------
# Runs the entire pre-ship validation pipeline in order and stops on the
# first failure:
#
#   1. npx tsc --noEmit          (typecheck)
#   2. node --test desktop tests (desktop suite, incl. updater + vault)
#   3. npm run dist              (next build -> resources -> harden -> installer)
#   4. scripts/smoke-install.ps1 (fresh-boot smoke: install -> login -> kiosk -> restore)
#   5. scripts/smoke-update.mjs  (update-channel smoke: check -> sha -> download -> handoff)
#   6. verify installer exists + report
#
# Exit code: 0 = ship it, 1 = fix something.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\release-gate.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\release-gate.ps1 -SkipSmoke   # dev loop, no machine-install
#   powershell -ExecutionPolicy Bypass -File scripts\release-gate.ps1 -SkipDist    # quick check, existing installer
#
# After a green gate: clean the stale update tags, then publish:
#   powershell -ExecutionPolicy Bypass -File scripts\clean-update-releases.ps1 -Token <PAT>
#   powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1 -Token <PAT>

param(
    [switch]$SkipDist,
    [switch]$SkipSmoke,
    [switch]$SkipUpdateSmoke
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$started = Get-Date
$version = (Get-Content (Join-Path $root "package.json") | ConvertFrom-Json).version

function Step([string]$name) {
    Write-Host ""
    Write-Host "=== $name ===" -ForegroundColor Cyan
}

function Run-Check([string]$name, [scriptblock]$block, [bool]$skip = $false) {
    if ($skip) {
        Write-Host "  [SKIP] $name" -ForegroundColor Yellow
        return $true
    }
    Write-Host "  [RUN ] $name" -ForegroundColor DarkGray
    try {
        & $block
        if ($LASTEXITCODE -ne 0) { throw "exit code $LASTEXITCODE" }
        Write-Host "  [PASS] $name" -ForegroundColor Green
        return $true
    } catch {
        Write-Host ("  [FAIL] {0} - {1}" -f $name, $_.Exception.Message) -ForegroundColor Red
        exit 1
    }
}

Write-Host "=== MANUFACTURING MAX RELEASE GATE (v$version) ===" -ForegroundColor Magenta

Push-Location $root

# 0. Verify module & model counts against MEMORY.md
Step "0/6 Module counts verification"
Run-Check "node scripts/verify-counts.mjs" { node (Join-Path $root "scripts/verify-counts.mjs") 2>&1 | Out-Host }

# 1. Typecheck
Step "1/6 Typecheck"
Run-Check "npx tsc --noEmit" { npx tsc --noEmit 2>&1 | Out-Host }

# 2. Desktop test suite
Step "2/6 Desktop test suite"
Run-Check "node --test desktop/tests/*.test.js" { node --test (Join-Path $root "desktop/tests/*.test.js") 2>&1 | Out-Host }

# 3. Full dist build (next build + resources + harden + electron-builder)
Step "3/6 Dist build"
Run-Check "npm run dist" { npm run dist 2>&1 | Out-Host } $SkipDist

$installer = Get-ChildItem (Join-Path $root "dist\ManufacturingMax-Setup-$version.exe") -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $installer) {
    $installer = Get-ChildItem (Join-Path $root "dist\ManufacturingMax-Setup-*.exe") -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if ($installer) {
    $sizeMb = [math]::Round($installer.Length / 1MB, 1)
    Write-Host ("  Installer: {0}  ({1} MB)" -f $installer.Name, $sizeMb) -ForegroundColor Green
} else {
    Write-Host "  [FAIL] No installer found in dist" -ForegroundColor Red
    exit 1
}

# 4. Fresh-boot smoke (installs the installer to a scratch data dir)
Step "4/6 Fresh-boot smoke"
if ($SkipSmoke) {
    Write-Host "  [SKIP] scripts/smoke-install.ps1" -ForegroundColor Yellow
} else {
    Run-Check "scripts/smoke-install.ps1" { powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\smoke-install.ps1") 2>&1 | Out-Host }
}

# 5. Update-channel smoke (local fake release, no network)
Step "5/6 Update-channel smoke"
Run-Check "node scripts/smoke-update.mjs" { node (Join-Path $root "scripts/smoke-update.mjs") 2>&1 | Out-Host } $SkipUpdateSmoke

Pop-Location

# 6. Summary
$elapsed = ((Get-Date) - $started).TotalSeconds
Write-Host ""
Write-Host "=== GATE RESULT: GREEN in $([math]::Round($elapsed))s (v$version) ===" -ForegroundColor Magenta
Write-Host "Next: clean-update-releases.ps1 -Token <PAT>  then  publish-release.ps1 -Token <PAT>" -ForegroundColor Cyan
exit 0
