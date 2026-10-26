# CSRSE 2026 Multi-Airport Digital-Twin Reproducibility Package

This repository is the public evidence package for the manuscript **“A Deterministic and Auditable 72-Hour Multi-Airport Digital-Twin Simulation Framework for Operational Disruption Experiments.”**

It contains the executable simulation source, frozen three-airport input snapshots, focused verification tests, the formal 100-run result set, deterministic-replay evidence, the paper source, and Chinese/English PDFs. The package is intended to let reviewers trace every reported result back to machine-readable evidence and rerun the experiment locally.

## Evidence at a glance

| Claim | Public evidence |
|---|---|
| Three airports and one 65-aircraft fleet | `src/airportPackages/`, `src/data/`, `public/airport-data/` |
| Five paired operating conditions | `src/application/simulation/operationalDisruptionExperiment.ts` |
| Seeds 42–61 and 100 formal runs | `artifacts/csrse2026/operational-disruption-batch-seeds-42-61.json` |
| Deterministic replay | `src/application/simulation/deterministicReplay.ts`, `simulationReplayAudit.ts`, and seed-42 fingerprints |
| Rule and transition validation | `simulationInvariants.ts`, `simulationTransitionGuard.ts`, and focused tests |
| Paper results | `paper/csrse2026-airport-digital-twin/output/pdf/` and machine-readable JSON/CSV artifacts |
| File integrity | `MANIFEST.sha256` |

## Quick reproduction

Requirements: Node.js 24.x and npm 11.x. On Windows PowerShell:

```powershell
npm ci
npm run test:paper-replay
npm run test:paper-invariants
npm run test:paper-guards
npm run test:paper-disruptions
npm run experiment:paper-disruptions -- 42 20
npm run experiment:paper-disruptions -- 42 1
```

Alternatively, run `./reproduce.ps1`; it performs the focused tests, regenerates both result sets, and prints their SHA-256 hashes.

## Reading order

1. `REPRODUCIBILITY.md` — experiment contract, commands, expected outputs, and interpretation limits.
2. `paper/csrse2026-airport-digital-twin/EXPERIMENT_EVIDENCE.md` — claim-to-file evidence map.
3. `artifacts/csrse2026/*.json` — complete structured results and audit fields.
4. `artifacts/csrse2026/*.csv` — compact reviewer-friendly result tables.
5. `paper/csrse2026-airport-digital-twin/output/pdf/` — English and Chinese manuscripts.

## Scope and limitations

The package supports verification of the reported **internal simulation results**. It does not claim that the current parameterization has been calibrated for real-airport predictive deployment. Airport geometry is based on frozen project snapshots; operational rules and resource assumptions are documented in the included source and configuration files. Author affiliation and correspondence details remain to be completed before submission.

## Author

Kilian Sui (`kiliansui`). No personal email is embedded in this public package; a submission correspondence address can be added after confirmation.
