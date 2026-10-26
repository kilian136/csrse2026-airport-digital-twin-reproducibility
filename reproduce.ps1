$ErrorActionPreference = "Stop"

Write-Host "[1/6] Installing locked dependencies"
npm ci

Write-Host "[2/6] Verifying deterministic replay"
npm run test:paper-replay

Write-Host "[3/6] Verifying invariants"
npm run test:paper-invariants

Write-Host "[4/6] Verifying transition guards and disruption isolation"
npm run test:paper-guards
npm run test:paper-disruptions

Write-Host "[5/6] Regenerating the 100-run batch and seed-42 detail"
npm run experiment:paper-disruptions -- 42 20
npm run experiment:paper-disruptions -- 42 1

Write-Host "[6/6] Printing artifact SHA-256 hashes"
Get-FileHash artifacts/csrse2026/* -Algorithm SHA256 |
  Sort-Object Path |
  Format-Table Hash, Path -AutoSize
