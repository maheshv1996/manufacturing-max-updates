# publish-release.ps1
# Publishes a stable release to the PUBLIC update repo that the desktop app
# checks (GITHUB_UPDATE_REPO in desktop/lib/updater.js, configured via the
# "updateRepo" field in package.json).
#
# Flow:
#   1. (default) run `npm run dist` -> builds the hardened NSIS installer
#   2. locate dist\ManufacturingMax-Setup-<version>.exe
#   3. compute sha256 (the app verifies this checksum before installing)
#   4. create a GitHub Release v<version> in the public repo
#   5. upload the .exe + .exe.sha256 as release assets
#
# Requirements:
#   - A GitHub token: -Token <PAT> or $env:GITHUB_TOKEN.
#     Fine-grained PAT: Contents -> Read and write on the public repo.
#     (Classic token with the `repo` scope also works.)
#   - The public repo must already exist (https://github.com/<Repo>).
#   - Bump the version first (npm version patch) so the tag is new.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1 -SkipBuild -Notes "Bugfix release"
#   powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1 -Draft -Token ghp_xxx
param(
    [string]$Repo = "maheshv1996/manufacturing-max-updates",
    [string]$Version = "",
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$Notes = "",
    [switch]$SkipBuild,
    [switch]$Draft
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$api = "https://api.github.com"

if (-not $Token) {
    Write-Error "No GitHub token. Set -Token <PAT> or \$env:GITHUB_TOKEN (Contents: Read and write on $Repo)."
    exit 1
}
if (-not $Version) {
    $Version = (Get-Content (Join-Path $root "package.json") | ConvertFrom-Json).version
}
if ($Version -like "v*") { $Version = $Version.Substring(1) }
$tag = "v$Version"

function Invoke-GH {
    param([string]$Method, [string]$Uri, $Body = "", [string]$InFile = "", [string]$ContentType = "application/json")
    $headers = @{
        Authorization = "Bearer $Token"
        "User-Agent"  = "MfgMax-Publish"
        Accept        = "application/vnd.github+json"
    }
    $params = @{ Method = $Method; Uri = $Uri; Headers = $headers; ContentType = $ContentType }
    if ($Body)  { $params.Body = $Body }
    if ($InFile) { $params.InFile = $InFile }
    return Invoke-RestMethod @params
}

# ---- 1. build -------------------------------------------------------------
if (-not $SkipBuild) {
    Write-Host "[1/5] Building installer (npm run dist)..." -ForegroundColor Cyan
    Push-Location $root
    npm run dist
    if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Error "npm run dist failed (exit $LASTEXITCODE)."; exit 1 }
    Pop-Location
} else {
    Write-Host "[1/5] SkipBuild set - using existing installer." -ForegroundColor Cyan
}

# ---- 2. locate installer ---------------------------------------------------
$exePath = Join-Path $root "dist\ManufacturingMax-Setup-$Version.exe"
if (-not (Test-Path $exePath)) {
    $fallback = Get-ChildItem (Join-Path $root "dist\*.exe") -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($fallback) {
        Write-Warning "Expected $exePath not found; using newest installer: $($fallback.Name)"
        $exePath = $fallback.FullName
    }
}
if (-not (Test-Path $exePath)) {
    Write-Error "No installer found in dist\ (expected ManufacturingMax-Setup-$Version.exe)."
    exit 1
}
$exeName = Split-Path $exePath -Leaf
Write-Host "[2/5] Installer: $exeName" -ForegroundColor Cyan

# ---- 3. sha256 --------------------------------------------------------------
$hash = (Get-FileHash $exePath -Algorithm SHA256).Hash.ToLowerInvariant()
$shaName = "$exeName.sha256"
$shaPath = Join-Path $env:TEMP $shaName
Set-Content -Path $shaPath -Value "$hash *$exeName" -Encoding Ascii
Write-Host "[3/5] sha256: $hash" -ForegroundColor Cyan

# ---- 4. tag must not exist yet ----------------------------------------------
Write-Host "[4/5] Checking tag $tag in $Repo ..." -ForegroundColor Cyan
try {
    Invoke-GH -Method GET -Uri "$api/repos/$Repo/releases/tags/$tag" | Out-Null
    Write-Error "Release $tag already exists in $Repo - bump the version (npm version patch) or delete the old release."
    exit 1
} catch {
    $status = [int]$_.Exception.Response.StatusCode
    if ($status -ne 404) { throw }
}

# ---- 5. create release + upload assets --------------------------------------
if (-not $Notes) {
    $Notes = "Auto-published build of Manufacturing Max $Version.

sha256: $hash

Download ManufacturingMax-Setup-$Version.exe and run it. Company data is preserved by the installer."
}
$releaseBody = @{ tag_name = $tag; name = "Manufacturing Max $Version"; body = $Notes; draft = [bool]$Draft; prerelease = $false } | ConvertTo-Json

Write-Host "[5/5] Creating release $tag ..." -ForegroundColor Cyan
$release = Invoke-GH -Method POST -Uri "$api/repos/$Repo/releases" -Body $releaseBody

$uploadBase = $release.upload_url -replace '\{\?name,label\}', ''
foreach ($asset in @(
    @{ File = $exePath; Name = $exeName },
    @{ File = $shaPath; Name = $shaName }
)) {
    Write-Host "  uploading $($asset.Name) ..." -ForegroundColor Yellow
    $url = "$uploadBase`?name=" + [Uri]::EscapeDataString($asset.Name)
    Invoke-GH -Method POST -Uri $url -InFile $asset.File -ContentType "application/octet-stream" | Out-Null
}

Write-Host ""
Write-Host "Published: $($release.html_url)" -ForegroundColor Green
Write-Host "Installed copies will now find the update (tray -> Check for Updates)."
