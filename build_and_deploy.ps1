Write-Host "Initiating Enterprise Compiler..."
npm run dist
Write-Host "Compilation finished. Locating installer..."
$exe = Get-ChildItem -Path "dist" -Filter "*.exe" | Select-Object -First 1
if ($exe) {
    Write-Host "Installer found: $($exe.Name)"
    Copy-Item $exe.FullName -Destination "C:\Users\mahes\Desktop" -Force -ErrorAction SilentlyContinue
    Copy-Item $exe.FullName -Destination "C:\Users\mahes\OneDrive\Desktop" -Force -ErrorAction SilentlyContinue
    Copy-Item $exe.FullName -Destination "C:\Users\mahes\OneDrive\Desktop\ManufacturingMax-Setup-1.0.1.exe" -Force -ErrorAction SilentlyContinue
    Write-Host "Successfully installed to Desktop and OneDrive Desktop!"
} else {
    Write-Host "ERROR: No .exe file found in dist directory."
}
