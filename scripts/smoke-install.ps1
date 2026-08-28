# smoke-install.ps1 — FIRST-BOOT SMOKE TEST for the desktop installer
# ---------------------------------------------------------------------
# Simulates a brand-new machine: installs the current installer, boots the
# app against a SCRATCH data dir (real data in MfgMaxData is NEVER touched),
# and verifies the whole first-run chain end-to-end:
#
#   install -> launcher boots -> initdb (scratch) -> schema+seed ->
#   server up -> health(version) -> login 1001/factory123 ->
#   /command 200 -> operator kiosk 200 -> scratch config initialized
#
# Then it shuts the scratch instance down and relaunches the REAL app so the
# machine is left exactly as found (real cluster restarted, data intact).
#
# IMPORTANT: this reinstalls the app with the given installer (the registered
# copy is replaced by the same build — safe for the current 1.0.0, and the
# intended behavior when validating a future build). Postgres on :5432 is
# briefly stopped during the test and restarted by the real app afterwards.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-install.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-install.ps1 -Installer dist\ManufacturingMax-Setup-1.0.0.exe
#   powershell -ExecutionPolicy Bypass -File scripts\smoke-install.ps1 -KeepScratch   # keep scratch dir for forensics

param(
    [string]$Installer = "",
    [switch]$KeepScratch,
    [string]$Log = (Join-Path $env:TEMP "mfgmax-smoke.log")
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$pkg = Get-Content (Join-Path $root "package.json") | ConvertFrom-Json
$expectedVersion = $pkg.version

# Mirror ALL output to a log file so the run survives a killed pipe / timeout.
Start-Transcript -Path $Log -Force | Out-Null
Write-Host "=== Manufacturing Max FIRST-BOOT SMOKE TEST (log: $Log) ==="

# ---- locate installer -----------------------------------------------------
if (-not $Installer) {
    $Installer = Get-ChildItem (Join-Path $root "dist\ManufacturingMax-Setup-*.exe") -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $Installer -or -not (Test-Path $Installer)) {
    Write-Error "No installer found. Pass -Installer <path> or run npm run dist first."
    exit 1
}
$installerName = Split-Path $Installer -Leaf
$fromName = [regex]::Match($installerName, "ManufacturingMax-Setup-(\d+\.\d+\.\d+)\.exe")
$expectedVersion = if ($fromName.Success) { $fromName.Groups[1].Value } else { $expectedVersion }

$appExe = "$env:LOCALAPPDATA\Programs\Manufacturing Max\Manufacturing Max.exe"
$pgBin = "$env:LOCALAPPDATA\Programs\Manufacturing Max\resources\pgbin\bin\pg_ctl.exe"

$results = @()   # name, ok, detail
function Add-Result([string]$name, [bool]$ok, [string]$detail) {
    $script:results += [pscustomobject]@{ Name = $name; OK = $ok; Detail = $detail }
    $mark = if ($ok) { "PASS" } else { "FAIL" }
    Write-Host ("[{0}] {1} {2}" -f $mark, $name, $detail) -ForegroundColor $(if ($ok) { "Green" } else { "Red" })
}

function Stop-App {
    Get-Process -Name "Manufacturing Max" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

function Stop-Postgres([string]$pgdataDir) {
    # Prefer graceful pg_ctl when we know the data dir; else kill the listener.
    # NOTE: pg_ctl stop on a NOT-running cluster prints to stderr, which with
    # $ErrorActionPreference=Stop becomes a terminating error — swallow it.
    $pgdataExists = $pgdataDir -and (Test-Path $pgBin) -and (Test-Path (Join-Path $pgdataDir "PG_VERSION"))
    if ($pgdataExists) {
        try {
            & $pgBin -D $pgdataDir stop -m fast 2>$null | Out-Null
        } catch {
            # already stopped — fine
        }
    }
    # Belt and braces: whatever still holds :5432 (e.g. a stray scratch
    # postmaster from an earlier test) must be gone or the scratch cluster
    # cannot bind. pg_ctl's own stop above already handles the real one.
    # NOTE: $pid is a READ-ONLY automatic variable — never assign to it.
    $listenerIds = (netstat -ano | Select-String ":5432\s.*LISTENING") | ForEach-Object { ($_ -split "\s+")[-1] } | Sort-Object -Unique
    foreach ($procId in $listenerIds) { Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 3
}

function Wait-Health([int]$timeoutSec = 120) {
    $deadline = (Get-Date).AddSeconds($timeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            # curl.exe avoids the Invoke-RestMethod "script execution risk" prompt
            # that Windows PowerShell raises on web calls.
            $raw = & curl.exe -s -m 3 "http://localhost:3000/api/health"
            if ($raw) { return ($raw | ConvertFrom-Json) }
        } catch { }
        Start-Sleep -Seconds 2
    }
    return $null
}

function Get-SessionCookie {
    # IMPORTANT: PowerShell 5.1 mangles embedded double-quotes when passing
    # inline JSON to native curl.exe (-d '{"a":"b"}' arrives truncated -> the
    # server's request.json() throws -> 500). Always write the body to a temp
    # file and use -d @file — immune to PS native-arg quoting. (This was the
    # cause of the smoke run's "login 500" while bash curl got 200.)
    $token = [guid]::NewGuid().ToString("N")
    $jar = Join-Path $env:TEMP ("mfgmax-cookies-" + $token + ".txt")
    $bodyFile = Join-Path $env:TEMP ("mfgmax-login-" + $token + ".json")
    Set-Content -Path $bodyFile -Value '{"username":"1001","password":"factory123"}' -Encoding Ascii -NoNewline
    $lastCode = 0
    $lastBody = ""
    for ($i = 0; $i -lt 4; $i++) {
        try {
            $resp = & curl.exe -s -c $jar -X POST "http://localhost:3000/api/auth/login" -H "Content-Type: application/json" --data-binary "@$bodyFile" -w "`n%{http_code}"
            $lastBody = ($resp -join "`n").Trim()
            $lastCode = [int](($resp | Select-Object -Last 1))
            if ($lastCode -eq 200) {
                Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue
                return @{ Code = 200; Jar = $jar; Body = $lastBody }
            }
            if ($lastCode -ne 500 -and $lastCode -ne 0) { break }
        } catch {
            $lastCode = 0
        }
        Start-Sleep -Seconds 3
    }
    Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue
    return @{ Code = $lastCode; Jar = $null; Body = $lastBody }
}

Write-Host "" -ForegroundColor Cyan
Write-Host "Installer : $installerName"
Write-Host "Expected  : v$expectedVersion"
Write-Host "Scratch   : data dir isolated via MFGMAX_DATA_DIR (real data untouched)"

# ---- 0. capture current state --------------------------------------------
$realDataDir = "$env:USERPROFILE\MfgMaxData"
$realPg = "$realDataDir\pgdata"

# ---- 1. install -----------------------------------------------------------
Write-Host "[1/6] Stopping app + postgres, installing..." -ForegroundColor Cyan
Stop-App
Stop-Postgres $realPg
$install = Start-Process -FilePath $Installer -ArgumentList "/S" -Wait -PassThru
Add-Result "Installer ran" ($install.ExitCode -eq 0) "exit=$($install.ExitCode)"

# ---- 2. boot scratch instance ---------------------------------------------
$scratch = Join-Path $env:TEMP ("MfgMaxSmoke-" + [guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Path $scratch -Force | Out-Null
$env:MFGMAX_DATA_DIR = $scratch
Write-Host "[2/6] First boot against scratch data dir: $scratch" -ForegroundColor Cyan
Start-Process -FilePath $appExe | Out-Null

$health = Wait-Health 240
if ($health) {
    Add-Result "Server up + health" $true "version=$($health.version) status=$($health.status) db=$($health.db.ok)"
    Add-Result "Version matches package.json" ($health.version -eq $expectedVersion) "got=$($health.version) want=$expectedVersion"
    Add-Result "DB healthy (scratch cluster)" ($health.db.ok -eq $true) "sizeMb=$($health.db.sizeMb)"
} else {
    Add-Result "Server up + health" $false "no /api/health within 180s"
}

# ---- 3. login + pages ------------------------------------------------------
$login = Get-SessionCookie
Add-Result "Login 1001/factory123" ($login.Code -eq 200) "http=$($login.Code) body=$($login.Body)"

if ($login.Jar -and (Test-Path $login.Jar)) {
    try {
        $code = & curl.exe -s -o NUL -w "%{http_code}" -b $login.Jar "http://localhost:3000/command"
        Add-Result "/command renders" ($code -eq 200) "http=$code"
    } catch {
        Add-Result "/command renders" $false "http=ERR"
    }
    if ($login.Jar -and (Test-Path $login.Jar)) { Remove-Item $login.Jar -Force -ErrorAction SilentlyContinue }
}

# ---- 4. operator kiosk (anonymous by design) -------------------------------
try {
    $k = & curl.exe -s -o NUL -w "%{http_code}" "http://localhost:3000/api/operator/init"
    Add-Result "Operator kiosk API (anonymous)" ($k -eq 200) "http=$k"
} catch {
    Add-Result "Operator kiosk API (anonymous)" $false "http=ERR"
}

# ---- 5. scratch data dir verified ------------------------------------------
$scratchCfg = Join-Path $scratch "config.json"
if (Test-Path $scratchCfg) {
    $cfg = Get-Content $scratchCfg | ConvertFrom-Json
    Add-Result "Scratch cluster initialized" ($cfg.initialized -eq $true) "initialized=$($cfg.initialized) pgdata=$([bool](Test-Path (Join-Path $scratch "pgdata\PG_VERSION")))"
} else {
    Add-Result "Scratch cluster initialized" $false "config.json missing at $scratch"
}

# ---- 6. teardown + restore real app ----------------------------------------
Write-Host "[6/6] Teardown + restoring real app..." -ForegroundColor Cyan
Stop-App
# Stop the SCRATCH postmaster so the real cluster can rebind :5432.
Stop-Postgres (Join-Path $scratch "pgdata")
Remove-Item Env:MFGMAX_DATA_DIR -ErrorAction SilentlyContinue
if (-not $KeepScratch) { Remove-Item $scratch -Recurse -Force -ErrorAction SilentlyContinue }

Start-Process -FilePath $appExe | Out-Null
$realHealth = Wait-Health 120
if ($realHealth) {
    Add-Result "Real app restored" ($realHealth.ok -eq $true) "version=$($realHealth.version) db=$($realHealth.db.ok)"
    $rl = Get-SessionCookie
    Add-Result "Real app login works" ($rl.Code -eq 200) "http=$($rl.Code)"
    if ($rl.Jar -and (Test-Path $rl.Jar)) { Remove-Item $rl.Jar -Force -ErrorAction SilentlyContinue }
} else {
    Add-Result "Real app restored" $false "no /api/health within 120s"
}

# ---- summary ---------------------------------------------------------------
Write-Host ""
Write-Host "=== SUMMARY ===" -ForegroundColor Cyan
$fails = @($results | Where-Object { -not $_.OK })
$results | ForEach-Object {
    $mark = if ($_.OK) { "PASS" } else { "FAIL" }
    Write-Host ("  {0,-4} {1,-38} {2}" -f $mark, $_.Name, $_.Detail)
}
Write-Host ("TOTAL: {0}/{1} passed" -f ($results.Count - $fails.Count), $results.Count)
if ($fails.Count -gt 0) { exit 1 }
exit 0
