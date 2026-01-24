# PROANAOVEV3-005: PrototypeProfileCalculator Service

## Summary

Create a service that computes per-prototype profile signals for generality, sparsity, and novelty - enabling proliferation guardrails and expression candidate detection.

## Motivation

The system needs signals to identify prototypes that:
- Are too general (high gate volume)
- Are too narrow/niche (single-axis focus)
- Should be converted to expressions (low novelty + narrow scope)

## Files to Create

### Service
- `src/expressionDiagnostics/services/prototypeOverlap/PrototypeProfileCalculator.js`

### Unit Tests
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/prototypeProfileCalculator.test.js`

## Implementation Details

### Assumptions (Reassessed)
- Prototype overlap v3 services use dependency validation via `validateDependency` and require a logger with debug/warn/error.
- `PrototypeOutputVector` comes from `PrototypeVectorEvaluator` and includes `activationRate`, `gateResults`, and `intensities`.
- There is no existing clustering utility; implement a deterministic k-means (first K vectors as initial centroids) directly inside the service.
- Configuration is provided via constructor options with sensible defaults (no `prototypeOverlapConfig.js` changes in this ticket).
- Only unit tests are required here; no integration wiring or DI registration is in scope.

### Interface

```javascript
class PrototypeProfileCalculator {
  /**
   * @param {object} options
   * @param {object} options.config - Configuration with thresholds
   * @param {object} options.logger - Logger instance
   */
  constructor(options)

  /**
   * Calculate profile metrics for all prototypes.
   * @param {Array<object>} prototypes
   * @param {Map<string, PrototypeOutputVector>} outputVectors
   * @returns {Map<string, PrototypeProfile>}
   */
  calculateAll(prototypes, outputVectors)

  /**
   * Calculate profile for a single prototype.
   * @param {object} prototype
   * @param {PrototypeOutputVector} outputVector
   * @param {Array<{centroid: Float32Array, id: string}>} clusterCentroids
   * @returns {PrototypeProfile}
   */
  calculateSingle(prototype, outputVector, clusterCentroids)

  /**
   * Compute cluster centroids from all output vectors.
   * @param {Map<string, PrototypeOutputVector>} outputVectors
   * @returns {Array<{centroid: Float32Array, id: string}>}
   */
  computeClusterCentroids(outputVectors)
}

/**
 * @typedef {object} PrototypeProfile
 * @property {string} prototypeId
 * @property {number} gateVolume - Activation rate under broad sampling [0,1]
 * @property {number} weightEntropy - Shannon entropy of normalized |weights|
 * @property {number} weightConcentration - Max |weight| / sum |weights|
 * @property {number} deltaFromNearestCenter - L2 distance to nearest cluster centroid
 * @property {string} nearestClusterId - ID of nearest cluster centroid
 * @property {boolean} isExpressionCandidate - Low-volume + low-novelty + single-axis
 */
```

### Key Calculations

**Weight Entropy**:
```javascript
function weightEntropy(weights) {
  const values = Object.values(weights).map(Math.abs).filter(v => v > 0);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const probs = values.map(v => v / sum);
  return -probs.reduce((h, p) => h + (p > 0 ? p * Math.log2(p) : 0), 0);
}
```

**Weight Concentration**:
```javascript
function weightConcentration(weights) {
  const values = Object.values(weights).map(Math.abs);
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  return Math.max(...values) / sum;
}
```

**Expression Candidate**:
```javascript
const isExpressionCandidate =
  profile.gateVolume < config.lowVolumeThreshold &&
  profile.deltaFromNearestCenter < config.lowNoveltyThreshold &&
  profile.weightConcentration > config.singleAxisFocusThreshold;
```

### Clustering
- Simple deterministic k-means on intensity vectors (seeded by first K vectors)
- Configurable cluster count (default: 10)
- Fixed small iteration cap (e.g., 10) to keep runtime predictable

## Out of Scope

- Creating output vectors (ticket 002)
- Using profiles in classification (ticket 010)
- DI registration (ticket 009)
- Updating global config defaults (use constructor options instead)

## Acceptance Criteria

- [x] Gate volume calculated from activation rate
- [x] Weight entropy calculated correctly using Shannon formula
- [x] Weight concentration calculated correctly
- [x] Cluster centroids computed via deterministic k-means
- [x] Delta-from-nearest-center computed as L2 distance to nearest centroid
- [x] Expression candidate flag set based on thresholds
- [x] Unit tests cover:
  - Gate volume calculation
  - Weight entropy calculation
  - Weight concentration calculation
  - Delta-from-nearest-center
  - Expression candidate detection
  - Clustering behavior
- [x] 80%+ branch coverage on new code (unit tests)

## Status

Completed

## Outcome

Implemented `PrototypeProfileCalculator` with deterministic k-means clustering, profile calculations, and unit tests. Configuration stays local to constructor defaults (no global config updates or DI wiring added).

## Dependencies

- PROANAOVEV3-002 (PrototypeVectorEvaluator) - provides output vectors

## Estimated Complexity

Medium-High - k-means clustering and multiple metric calculations.
