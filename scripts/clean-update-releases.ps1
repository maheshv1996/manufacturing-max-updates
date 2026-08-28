# clean-update-releases.ps1 - REMOVE STALE RELEASES FROM THE UPDATE REPO
# ---------------------------------------------------------------------
# The public updates repo (maheshv1996/manufacturing-max-updates) still has
# OLD v1.0.0 and v1.0.1 release tags from before the rebrand. If the new
# 1.0.0 build were published on top, installed copies would be offered the
# BROKEN v1.0.1 as an update (semver 1.0.1 > 1.0.0) and downgrade/break.
#
# This deletes those stale releases AND their tags so the publish script
# (scripts/publish-release.ps1) can tag a clean v1.0.0.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\clean-update-releases.ps1 -Token <PAT>
#   powershell -ExecutionPolicy Bypass -File scripts\clean-update-releases.ps1 -Token <PAT> -Tags v1.0.0,v1.0.1
#
# Token: fine-grained PAT with Contents -> Read and write on the repo
#        (or a classic token with the repo scope).
param(
    [string]$Repo = 'maheshv1996/manufacturing-max-updates',
    [string]$Token = $env:GITHUB_TOKEN,
    [string]$Tags = 'v1.0.0,v1.0.1',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$api = 'https://api.github.com'
if (-not $Token) { Write-Error 'No GitHub token. Set -Token or $env:GITHUB_TOKEN.'; exit 1 }
$headers = @{
    Authorization = 'Bearer ' + $Token
    'User-Agent'  = 'MfgMax-Cleanup'
    Accept        = 'application/vnd.github+json'
}

function Invoke-GH {
    param([string]$Method, [string]$Uri)
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

foreach ($tag in ($Tags -split ',')) {
    $tag = $tag.Trim()
    if (-not $tag) { continue }

    $release = $null
    try {
        $release = Invoke-GH -Method GET -Uri ($api + '/repos/' + $Repo + '/releases/tags/' + $tag)
    } catch {
        Write-Host ('  ' + $tag + ' : no release found (skipping)') -ForegroundColor Yellow
        continue
    }

    if ($DryRun) {
        Write-Host ('  ' + $tag + ' : WOULD delete release id=' + $release.id + ' + tag') -ForegroundColor Cyan
        continue
    }

    Invoke-GH -Method DELETE -Uri ($api + '/repos/' + $Repo + '/releases/' + $release.id) | Out-Null
    Write-Host ('  ' + $tag + ' : release deleted') -ForegroundColor Green

    try {
        Invoke-GH -Method DELETE -Uri ($api + '/repos/' + $Repo + '/git/refs/tags/' + $tag) | Out-Null
        Write-Host ('  ' + $tag + ' : tag deleted') -ForegroundColor Green
    } catch {
        Write-Host ('  ' + $tag + ' : tag delete failed (may not exist) - ' + $_.Exception.Message) -ForegroundColor Yellow
    }
}

Write-Host ''
Write-Host 'Done. Now publish the rebranded build:' -ForegroundColor Cyan
Write-Host '  powershell -ExecutionPolicy Bypass -File scripts\publish-release.ps1 -Token <PAT>'