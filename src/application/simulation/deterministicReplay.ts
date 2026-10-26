export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | { [key: string]: JsonValue }

export interface SimulationExperimentManifest {
  schemaVersion: '1.0'
  experimentId: string
  snapshotId: string
  snapshotVersion: string
  seed: number
  fixedStepMs: number
  horizonMs: number
  datasetVersions: Record<string, string>
}

export interface ReplayEvent<TPayload extends JsonValue = JsonValue> {
  id: string
  sequence: number
  simulationTimeMs: number
  type: string
  aggregateId?: string
  payload: TPayload
}

const normalizeSeed = (seed: number): number => {
  if (!Number.isFinite(seed)) {
    throw new Error('Simulation seed must be a finite number.')
  }

  return Math.trunc(seed) >>> 0
}

/**
 * Small deterministic PRNG for simulation experiments. Its state is explicit so
 * a checkpoint can restore the exact next random value during replay.
 */
export class DeterministicRandom {
  private state: number

  constructor(seed: number) {
    this.state = normalizeSeed(seed)
  }

  next(): number {
    let value = (this.state += 0x6d2b79f5)
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    const result = ((value ^ (value >>> 14)) >>> 0) / 4294967296
    this.state >>>= 0
    return result
  }

  nextInt(minInclusive: number, maxExclusive: number): number {
    if (!Number.isInteger(minInclusive) || !Number.isInteger(maxExclusive)) {
      throw new Error('Deterministic integer bounds must be integers.')
    }
    if (maxExclusive <= minInclusive) {
      throw new Error('maxExclusive must be greater than minInclusive.')
    }

    return minInclusive + Math.floor(this.next() * (maxExclusive - minInclusive))
  }

  getState(): number {
    return this.state >>> 0
  }

  restore(state: number): void {
    this.state = normalizeSeed(state)
  }
}

const canonicalize = (value: unknown): JsonValue => {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }

  if (value !== null && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .reduce<Record<string, JsonValue>>((result, key) => {
        result[key] = canonicalize(record[key])
        return result
      }, {})
  }

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value
  }

  throw new Error(`State fingerprint only supports JSON values, received ${typeof value}.`)
}

export const stableStringify = (value: unknown): string =>
  JSON.stringify(canonicalize(value))

/** FNV-1a fingerprint used for quick checkpoint equality checks. */
export const stateFingerprint = (value: unknown): string => {
  const serialized = stableStringify(value)
  let hash = 0x811c9dc5

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const orderReplayEvents = <TEvent extends ReplayEvent>(
  events: readonly TEvent[],
): TEvent[] =>
  [...events].sort(
    (left, right) =>
      left.simulationTimeMs - right.simulationTimeMs ||
      left.sequence - right.sequence ||
      left.id.localeCompare(right.id),
  )

export const validateExperimentManifest = (
  manifest: SimulationExperimentManifest,
): string[] => {
  const errors: string[] = []

  if (!manifest.experimentId.trim()) errors.push('experimentId is required')
  if (!manifest.snapshotId.trim()) errors.push('snapshotId is required')
  if (!manifest.snapshotVersion.trim()) errors.push('snapshotVersion is required')
  if (!Number.isInteger(manifest.seed)) errors.push('seed must be an integer')
  if (!Number.isInteger(manifest.fixedStepMs) || manifest.fixedStepMs <= 0) {
    errors.push('fixedStepMs must be a positive integer')
  }
  if (!Number.isInteger(manifest.horizonMs) || manifest.horizonMs <= 0) {
    errors.push('horizonMs must be a positive integer')
  }
  if (Object.keys(manifest.datasetVersions).length === 0) {
    errors.push('at least one dataset version is required')
  }

  return errors
}
