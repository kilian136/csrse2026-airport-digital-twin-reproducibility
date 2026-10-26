# Reproducibility record

## Frozen experiment contract

- Scenario identifier: `SIM-72H-1792713600000`
- Scenario start: `2026-10-23T00:00:00.000Z`
- Horizon: 72 hours
- Airports: ZSHC, ZSPD, and ZSNJ
- Fleet: 65 aircraft shared across the three airports
- Conditions: baseline, low visibility, runway closure, equipment outage, and combined disruption
- Formal seeds: 42 through 61
- Formal run count: 20 seeds × 5 conditions = 100
- Detailed replay matrix: seed 42, five conditions

All five conditions within a seed use the same frozen scenario and base task-generation stream. The disruption adapters are deterministic functions of the scenario and simulation time, which permits paired within-seed comparisons.

## Authoritative entry point

`scripts/run-operational-disruption-experiment.mjs` compiles the three frozen airport networks, builds the scenario snapshot, runs the resource-constrained event engine, executes the audits, and writes JSON and CSV evidence.

Formal batch:

```powershell
npm run experiment:paper-disruptions -- 42 20
```

Detailed seed-42 matrix:

```powershell
npm run experiment:paper-disruptions -- 42 1
```

## Verification tests

| Command | Intended verification | Expected tests |
|---|---|---:|
| `npm run test:paper-replay` | deterministic checkpoints and audit trail | 5 |
| `npm run test:paper-invariants` | lifecycle and resource invariants | 3 |
| `npm run test:paper-guards` | transition rejection/acceptance rules | 10 |
| `npm run test:paper-disruptions` | scenario isolation and output aggregation | 3 |

The focused suite contains 21 tests in total. A rerun is acceptable only when all commands exit successfully and the regenerated artifacts satisfy their embedded validity fields.

## Formal artifacts

- `operational-disruption-batch-seeds-42-61.json`: complete formal batch, per-seed metrics, validity fields, fingerprints, and aggregate statistics.
- `operational-disruption-batch-seeds-42-61.csv`: compact batch results.
- `operational-disruption-seed-42.json`: detailed five-condition replay matrix.
- `operational-disruption-seed-42.csv`: compact seed-42 results.

The batch JSON records `totalRunCount=100`, `allRunsOperationallyValid=true`, and `deterministicReplayVerified=true`. These are simulation audit results, not evidence of real-world predictive validity.

## Seed-42 event-log fingerprints

| Condition | Fingerprint | Replay checkpoints |
|---|---|---:|
| baseline | `fnv1a32:46b42e2d` | 289 |
| low visibility | `fnv1a32:cad81eda` | 289 |
| runway closure | `fnv1a32:f19328bd` | 289 |
| equipment outage | `fnv1a32:2c52bc3c` | 289 |
| combined disruption | `fnv1a32:a8a9f7ab` | 289 |

## Integrity and schema evolution

`MANIFEST.sha256` contains SHA-256 hashes for the public package. The formal batch JSON and CSV were reproduced byte-for-byte in the last verification run. The detailed seed-42 JSON contains the current audit schema, including empty `transitionRejectionEvidence` arrays where no rejection occurred; its numerical outputs and event fingerprints remain unchanged.

## What a reviewer can and cannot conclude

The package enables inspection of inputs, code paths, formal results, deterministic replay, and implemented rule audits. It supports claims of computational traceability and internal consistency. It does not by itself establish empirical calibration, airport authority approval, or operational deployment readiness.
