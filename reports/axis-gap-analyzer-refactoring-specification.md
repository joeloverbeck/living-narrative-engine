# AxisGapAnalyzer Refactoring Specification

**Document Version**: 1.0
**Date**: 2026-01-24
**Target File**: `src/expressionDiagnostics/services/AxisGapAnalyzer.js`
**Current Size**: ~2,300 lines (4.6x the 500-line project limit)
**Goal**: Refactor to 6 focused services + 3 utilities following Single Responsibility Principle

---

## Executive Summary

The `AxisGapAnalyzer.js` file has grown to contain 6 major responsibilities, 50+ private methods, and 21 test helpers. This specification outlines a phased refactoring approach that:

1. Extracts functionality into focused, independently testable services
2. Maintains full backward compatibility with the existing public API
3. Follows existing project patterns from `services/prototypeOverlap/`
4. Ensures test coverage exists BEFORE any extraction begins

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Test Coverage Gaps (Must Fix First)](#2-test-coverage-gaps-must-fix-first)
3. [Proposed Architecture](#3-proposed-architecture)
4. [Detailed Service Specifications](#4-detailed-service-specifications)
5. [Utility Specifications](#5-utility-specifications)
6. [Extraction Order & Dependencies](#6-extraction-order--dependencies)
7. [DI Registration Plan](#7-di-registration-plan)
8. [Test Migration Strategy](#8-test-migration-strategy)
9. [Risk Assessment](#9-risk-assessment)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Current State Analysis

### 1.1 Identified Responsibilities

| # | Responsibility | Lines (Est.) | Key Methods |
|---|---------------|-------------|-------------|
| 1 | **PCA Analysis** | ~350 | `#runPCAAnalysis`, `#computeEigenDecomposition`, `#computeReconstructionErrors` |
| 2 | **Hub Detection** | ~250 | `#identifyHubPrototypes`, `#buildOverlapGraph`, `#computeHubScore` |
| 3 | **Coverage Gap Detection** | ~350 | `#detectCoverageGaps`, `#performDBSCANClustering`, `#computeClusterCentroid` |
| 4 | **Multi-Axis Conflict Detection** | ~200 | `#detectMultiAxisConflicts`, `#detectHighAxisLoadings`, `#detectSignTensions` |
| 5 | **Report Synthesis** | ~300 | `#synthesizeReport`, `#computePrototypeWeightSummaries`, `#computeConfidenceLevel` |
| 6 | **Main Orchestration** | ~150 | `analyze()`, progress callbacks, phase coordination |

### 1.2 Method Inventory

**Public API**: 1 method (`analyze()`)
**Test Helpers**: 21 methods (`__TEST_ONLY__*`)
**Private Methods**: 50+ methods

### 1.3 Current Dependencies

```javascript
constructor({
  prototypeProfileCalculator,  // IPrototypeProfileCalculator (reserved for future)
  config,                       // PROTOTYPE_OVERLAP_CONFIG
  logger,                       // ILogger
  densityClusteringService = null  // Optional, for DBSCAN
})
```

---

## 2. Test Coverage Gaps (Must Fix First)

### 2.1 Priority 1: CRITICAL - No Direct Tests

These methods have **zero direct test coverage** and must be tested before extraction:

| Method | New Test File | Tests Required |
|--------|--------------|----------------|
| `__TEST_ONLY__computeAdaptiveDistanceThreshold()` | `tests/unit/expressionDiagnostics/utils/adaptiveThresholdUtils.test.js` | Threshold computation, caching, seeded RNG, edge cases |
| `__TEST_ONLY__computeVectorMagnitude()` | `tests/unit/expressionDiagnostics/utils/vectorMathUtils.test.js` | Various vector sizes, zero vector, negative values |
| `__TEST_ONLY__getEffectiveDistanceThreshold()` | `tests/unit/expressionDiagnostics/services/axisGap/coverageGapDetector.test.js` | Static vs adaptive selection, config variations |
| `__TEST_ONLY__performDBSCANClustering()` | `tests/unit/expressionDiagnostics/services/axisGap/coverageGapDetector.test.js` | DBSCAN integration, empty input, service unavailable |

### 2.2 Priority 2: Improve Existing Coverage

These methods are only tested **indirectly** through higher-level methods:

| Method | Current Coverage | Tests Required |
|--------|-----------------|----------------|
| `__TEST_ONLY__detectHighAxisLoadings()` | ~70% via `detectMultiAxisConflicts` | Direct unit tests with threshold variations |
| `__TEST_ONLY__detectSignTensions()` | ~70% via `detectMultiAxisConflicts` | Direct unit tests for sign balance edge cases |
| `__TEST_ONLY__computeMedianAndIQR()` | Partial | Comprehensive statistical tests |

### 2.3 Test Files to Create BEFORE Refactoring

```
tests/unit/expressionDiagnostics/
├── utils/
│   ├── vectorMathUtils.test.js          # NEW - Priority 1
│   ├── statisticalUtils.test.js         # NEW - Priority 2
│   └── adaptiveThresholdUtils.test.js   # NEW - Priority 1
└── services/
    └── axisGapAnalyzer.preRefactor.test.js  # NEW - Priority 1 & 2 gaps
```

---

## 3. Proposed Architecture

### 3.1 Target Directory Structure

```
src/expressionDiagnostics/
├── services/
│   ├── AxisGapAnalyzer.js                 # Refactored orchestrator (~150 lines)
│   └── axisGap/                           # NEW DIRECTORY
│       ├── index.js                       # Barrel exports
│       ├── PCAAnalysisService.js          # ~350 lines
│       ├── HubPrototypeDetector.js        # ~250 lines
│       ├── CoverageGapDetector.js         # ~300 lines
│       ├── MultiAxisConflictDetector.js   # ~200 lines
│       ├── AxisGapRecommendationBuilder.js # ~250 lines
│       └── AxisGapReportSynthesizer.js    # ~200 lines
└── utils/
    ├── vectorMathUtils.js                 # NEW ~100 lines
    ├── statisticalUtils.js                # NEW ~80 lines
    └── adaptiveThresholdUtils.js          # NEW ~120 lines
```

### 3.2 Service Dependency Graph

```
                         ┌─────────────────────────────────┐
                         │    AxisGapAnalyzer              │
                         │    (Orchestrator - 150 lines)   │
                         └───────────────┬─────────────────┘
                                         │
     ┌───────────┬───────────┬───────────┼───────────┬───────────┐
     │           │           │           │           │           │
     ▼           ▼           ▼           ▼           ▼           ▼
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│  PCA    │ │  Hub    │ │Coverage │ │MultiAxis│ │ Report  │ │ Recom-  │
│Analysis │ │Detector │ │  Gap    │ │Conflict │ │Synthe-  │ │mendation│
│Service  │ │         │ │Detector │ │Detector │ │  sizer  │ │ Builder │
└────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
     │           │           │           │           │           │
     └───────────┴───────────┴─────┬─────┴───────────┴───────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
          ▼                        ▼                        ▼
    ┌───────────┐          ┌───────────┐          ┌───────────────┐
    │ vector    │          │statistical│          │ adaptive      │
    │ MathUtils │          │   Utils   │          │ThresholdUtils │
    └───────────┘          └───────────┘          └───────────────┘
```

---

## 4. Detailed Service Specifications

### 4.1 PCAAnalysisService

**File**: `src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js`
**Estimated Lines**: ~350
**Responsibility**: Principal Component Analysis on prototype weight vectors

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#runPCAAnalysis()` | `analyze(prototypes)` | Public |
| `#buildWeightMatrix()` | `buildWeightMatrix(prototypes)` | Public (for testing) |
| `#standardizeMatrix()` | `standardizeMatrix(matrix)` | Public (for testing) |
| `#computeCovariance()` | `computeCovariance(matrix)` | Public (for testing) |
| `#computeEigenDecomposition()` | `computeEigenDecomposition(matrix)` | Public (for testing) |
| `#computeExpectedAxisCount()` | `computeExpectedAxisCount(prototypes, axes)` | Private |
| `#selectTopVarianceAxes()` | `selectTopVarianceAxes(prototypes, axes, limit)` | Private |
| `#computeExtremePrototypes()` | `computeExtremePrototypes(params)` | Private |
| `#computeReconstructionErrors()` | `computeReconstructionErrors(params)` | Public (for testing) |
| `#createEmptyPCAResult()` | `static createEmptyResult()` | Static |

#### Constructor

```javascript
constructor({ logger, config }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['debug', 'info', 'warn', 'error']
  });
  // config subset: pcaKaiserThreshold, activeAxisEpsilon,
  //                pcaResidualVarianceThreshold, reconstructionErrorThreshold
}
```

---

### 4.2 HubPrototypeDetector

**File**: `src/expressionDiagnostics/services/axisGap/HubPrototypeDetector.js`
**Estimated Lines**: ~250
**Responsibility**: Identify hub prototypes via overlap graph analysis

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#identifyHubPrototypes()` | `detect(pairResults, profiles, prototypes)` | Public |
| `#buildOverlapGraph()` | `buildOverlapGraph(pairResults)` | Public (for testing) |
| `#addEdge()` | `#addEdge()` | Private |
| `#extractPairIds()` | `#extractPairIds()` | Private |
| `#coercePrototypeId()` | `#coercePrototypeId()` | Private |
| `#getEdgeWeight()` | `getEdgeWeight(pairResult)` | Public (for testing) |
| `#computeCompositeEdgeWeight()` | `#computeCompositeEdgeWeight()` | Private |
| `#computeHubScore()` | `#computeHubScore()` | Private |
| `#getNeighborhoodDiversity()` | `#getNeighborhoodDiversity()` | Private |
| `#getProfile()` | `#getProfile()` | Private |
| `#suggestAxisConcept()` | `#suggestAxisConcept()` | Private |

#### Constructor

```javascript
constructor({ logger, config }) {
  // config subset: hubMinDegree, hubMaxEdgeWeight, hubMinNeighborhoodDiversity,
  //                compositeScoreGateOverlapWeight, compositeScoreCorrelationWeight,
  //                compositeScoreGlobalDiffWeight
}
```

---

### 4.3 CoverageGapDetector

**File**: `src/expressionDiagnostics/services/axisGap/CoverageGapDetector.js`
**Estimated Lines**: ~300
**Responsibility**: Detect coverage gaps in axis space

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#detectCoverageGaps()` | `detect(profiles, prototypes)` | Public |
| `#performDBSCANClustering()` | `performDBSCANClustering(prototypes, axes)` | Public (for testing) |
| `#extractClusters()` | `extractClusters(profiles)` | Public (for testing) |
| `#computeClusterCentroid()` | `computeClusterCentroid(members, lookup, axes)` | Public (for testing) |
| `#getAxisUnitVectors()` | `#getAxisUnitVectors()` | Private |
| `#computeNearestAxisDistance()` | `#computeNearestAxisDistance()` | Private |
| `#getEffectiveDistanceThreshold()` | `getEffectiveDistanceThreshold(prototypes, axes)` | Public (for testing) |

#### Constructor

```javascript
constructor({ logger, config, densityClusteringService = null }) {
  // config subset: coverageGapClusteringMethod, coverageGapAxisDistanceThreshold,
  //                coverageGapMinClusterSize, enableMagnitudeAwareGapScoring,
  //                enableAdaptiveThresholds, dbscanEpsilon, dbscanMinPoints
}
```

#### External Dependencies

- `vectorMathUtils` (import)
- `adaptiveThresholdUtils` (import)
- `densityClusteringService` (optional DI)

---

### 4.4 MultiAxisConflictDetector

**File**: `src/expressionDiagnostics/services/axisGap/MultiAxisConflictDetector.js`
**Estimated Lines**: ~200
**Responsibility**: Detect high axis loadings and sign tensions

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#detectMultiAxisConflicts()` | `detectAll(prototypes)` | Public |
| `#detectHighAxisLoadings()` | `detectHighAxisLoadings(prototypes)` | Public |
| `#detectSignTensions()` | `detectSignTensions(prototypes)` | Public |
| `#categorizeAxes()` | `#categorizeAxes()` | Private |
| `#countActiveAxes()` | `#countActiveAxes()` | Private |
| `#computeSignBalance()` | `#computeSignBalance()` | Private |

#### Constructor

```javascript
constructor({ logger, config }) {
  // config subset: activeAxisEpsilon, highAxisLoadingThreshold,
  //                signTensionMinMagnitude, signTensionMinHighAxes,
  //                multiAxisSignBalanceThreshold
}
```

#### External Dependencies

- `statisticalUtils` (import for median/IQR)

---

### 4.5 AxisGapRecommendationBuilder

**File**: `src/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js`
**Estimated Lines**: ~250
**Responsibility**: Generate prioritized recommendations from analysis results

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#generateRecommendations()` | `build(pcaResult, hubs, gaps, conflicts)` | Public |
| `#buildRecommendation()` | `#buildRecommendation()` | Private |
| `#sortRecommendationsByPriority()` | `#sortRecommendationsByPriority()` | Private |
| `#findRelatedGap()` | `#findRelatedGap()` | Private |
| `#mergeUniquePrototypes()` | `#mergeUniquePrototypes()` | Private |

#### Constructor

```javascript
constructor({ logger, config }) {
  // config subset: pcaResidualVarianceThreshold
}
```

---

### 4.6 AxisGapReportSynthesizer

**File**: `src/expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js`
**Estimated Lines**: ~200
**Responsibility**: Synthesize final report with summaries and confidence levels

#### Methods to Extract

| Original Method | New Method | Visibility |
|----------------|-----------|------------|
| `#synthesizeReport()` | `synthesize(params)` | Public |
| `#buildEmptyReport()` | `buildEmptyReport(totalPrototypes)` | Public |
| `#countTriggeredMethods()` | `countTriggeredMethods(pcaResult, hubs, gaps, conflicts)` | Public (for testing) |
| `#computeConfidenceLevel()` | `computeConfidenceLevel(methodsTriggered, summaries)` | Public (for testing) |
| `#computePrototypeWeightSummaries()` | `computePrototypeWeightSummaries(params)` | Public (for testing) |

#### Constructor

```javascript
constructor({ logger, config, recommendationBuilder }) {
  validateDependency(recommendationBuilder, 'IAxisGapRecommendationBuilder', logger, {
    requiredMethods: ['build']
  });
  // config subset: pcaResidualVarianceThreshold, reconstructionErrorThreshold,
  //                residualVarianceThreshold
}
```

---

## 5. Utility Specifications

### 5.1 vectorMathUtils.js

**File**: `src/expressionDiagnostics/utils/vectorMathUtils.js`
**Estimated Lines**: ~100

```javascript
/**
 * Compute the magnitude (Euclidean norm) of a vector.
 * @param {number[]} vector
 * @returns {number}
 */
export function computeVectorMagnitude(vector) { ... }

/**
 * Compute cosine distance between two vectors.
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @param {{ useAbsolute?: boolean }} options
 * @returns {number} Distance in [0, 1] (or [0, 2] if not absolute)
 */
export function computeCosineDistance(vecA, vecB, options = {}) { ... }

/**
 * Normalize a vector to unit length.
 * @param {number[]} vector
 * @returns {number[]}
 */
export function normalizeVector(vector) { ... }

/**
 * Clamp a value to [0, 1] range.
 * @param {number} value
 * @returns {number}
 */
export function clamp01(value) { ... }

/**
 * Collect unique axis names from prototypes.
 * @param {Object[]} prototypes
 * @returns {string[]}
 */
export function collectAxes(prototypes) { ... }

/**
 * Build a lookup map from prototype ID to prototype.
 * @param {Object[]} prototypes
 * @returns {Map<string, Object>}
 */
export function buildPrototypeLookup(prototypes) { ... }
```

---

### 5.2 statisticalUtils.js

**File**: `src/expressionDiagnostics/utils/statisticalUtils.js`
**Estimated Lines**: ~80

```javascript
/**
 * Compute median and interquartile range.
 * @param {number[]} values
 * @returns {{ median: number, iqr: number, q1: number, q3: number }}
 */
export function computeMedianAndIQR(values) { ... }

/**
 * Compute median of pre-sorted values.
 * @param {number[]} sortedValues
 * @returns {number}
 */
export function computeMedian(sortedValues) { ... }

/**
 * Compute percentile value.
 * @param {number[]} sortedValues
 * @param {number} percentile - 0-100
 * @returns {number}
 */
export function computePercentile(sortedValues, percentile) { ... }
```

---

### 5.3 adaptiveThresholdUtils.js

**File**: `src/expressionDiagnostics/utils/adaptiveThresholdUtils.js`
**Estimated Lines**: ~120

```javascript
/**
 * Compute adaptive distance threshold using Monte Carlo sampling.
 * @param {Object[]} prototypes
 * @param {string[]} axes
 * @param {Object} config - { adaptiveThresholdPercentile, adaptiveThresholdSeed, adaptiveThresholdIterations }
 * @param {Map} [cache] - Optional cache for memoization
 * @returns {number|null}
 */
export function computeAdaptiveDistanceThreshold(prototypes, axes, config, cache) { ... }

/**
 * Generate cache key for adaptive threshold.
 * @param {Object[]} prototypes
 * @param {number} seed
 * @returns {string}
 */
export function computeAdaptiveThresholdCacheKey(prototypes, seed) { ... }

/**
 * Create a seeded pseudo-random number generator.
 * @param {number} seed
 * @returns {function(): number}
 */
export function createSeededRandom(seed) { ... }
```

---

## 6. Extraction Order & Dependencies

### Phase 1: Utilities (No Dependencies)

| Order | Target | Reason |
|-------|--------|--------|
| 1.1 | `vectorMathUtils.js` | Pure functions, no DI, used by multiple services |
| 1.2 | `statisticalUtils.js` | Pure functions, no DI |
| 1.3 | `adaptiveThresholdUtils.js` | Uses vectorMathUtils only |

### Phase 2: Leaf Services (Depend Only on Utilities)

| Order | Target | Dependencies |
|-------|--------|-------------|
| 2.1 | `PCAAnalysisService.js` | None (self-contained math) |
| 2.2 | `MultiAxisConflictDetector.js` | `statisticalUtils` |

### Phase 3: Mid-Tier Services

| Order | Target | Dependencies |
|-------|--------|-------------|
| 3.1 | `CoverageGapDetector.js` | `vectorMathUtils`, `adaptiveThresholdUtils`, `densityClusteringService` |
| 3.2 | `HubPrototypeDetector.js` | `vectorMathUtils` |

### Phase 4: High-Level Services

| Order | Target | Dependencies |
|-------|--------|-------------|
| 4.1 | `AxisGapRecommendationBuilder.js` | None (receives analysis results) |
| 4.2 | `AxisGapReportSynthesizer.js` | `AxisGapRecommendationBuilder` |

### Phase 5: Orchestrator Refactor

| Order | Target | Action |
|-------|--------|--------|
| 5.1 | `AxisGapAnalyzer.js` | Refactor to pure orchestration, remove extracted code |

---

## 7. DI Registration Plan

### 7.1 New Tokens

**File**: `src/dependencyInjection/tokens/tokens-diagnostics.js`

```javascript
// Add after existing tokens
IPCAAnalysisService: 'IPCAAnalysisService',
IHubPrototypeDetector: 'IHubPrototypeDetector',
ICoverageGapDetector: 'ICoverageGapDetector',
IMultiAxisConflictDetector: 'IMultiAxisConflictDetector',
IAxisGapRecommendationBuilder: 'IAxisGapRecommendationBuilder',
IAxisGapReportSynthesizer: 'IAxisGapReportSynthesizer',
```

### 7.2 Registration Updates

**File**: `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`

Add factory registrations following existing patterns in this file.

---

## 8. Test Migration Strategy

### 8.1 Test Helper Migration Map

| Current `__TEST_ONLY__` Method | New Location | New Access |
|-------------------------------|--------------|------------|
| `__TEST_ONLY__runPCAAnalysis` | `PCAAnalysisService` | `service.analyze()` |
| `__TEST_ONLY__computeReconstructionErrors` | `PCAAnalysisService` | `service.computeReconstructionErrors()` |
| `__TEST_ONLY__identifyHubPrototypes` | `HubPrototypeDetector` | `service.detect()` |
| `__TEST_ONLY__detectCoverageGaps` | `CoverageGapDetector` | `service.detect()` |
| `__TEST_ONLY__computeClusterCentroid` | `CoverageGapDetector` | `service.computeClusterCentroid()` |
| `__TEST_ONLY__detectMultiAxisConflicts` | `MultiAxisConflictDetector` | `service.detectAll()` |
| `__TEST_ONLY__detectHighAxisLoadings` | `MultiAxisConflictDetector` | `service.detectHighAxisLoadings()` |
| `__TEST_ONLY__detectSignTensions` | `MultiAxisConflictDetector` | `service.detectSignTensions()` |
| `__TEST_ONLY__computeMedianAndIQR` | `statisticalUtils` | `import { computeMedianAndIQR }` |
| `__TEST_ONLY__computeCosineDistance` | `vectorMathUtils` | `import { computeCosineDistance }` |
| `__TEST_ONLY__computeVectorMagnitude` | `vectorMathUtils` | `import { computeVectorMagnitude }` |
| `__TEST_ONLY__computeAdaptiveDistanceThreshold` | `adaptiveThresholdUtils` | `import { computeAdaptiveDistanceThreshold }` |
| `__TEST_ONLY__getEffectiveDistanceThreshold` | `CoverageGapDetector` | `service.getEffectiveDistanceThreshold()` |
| `__TEST_ONLY__performDBSCANClustering` | `CoverageGapDetector` | `service.performDBSCANClustering()` |
| `__TEST_ONLY__generateRecommendations` | `AxisGapRecommendationBuilder` | `service.build()` |
| `__TEST_ONLY__synthesizeReport` | `AxisGapReportSynthesizer` | `service.synthesize()` |
| `__TEST_ONLY__buildEmptyReport` | `AxisGapReportSynthesizer` | `service.buildEmptyReport()` |
| `__TEST_ONLY__countTriggeredMethods` | `AxisGapReportSynthesizer` | `service.countTriggeredMethods()` |
| `__TEST_ONLY__computeConfidenceLevel` | `AxisGapReportSynthesizer` | `service.computeConfidenceLevel()` |
| `__TEST_ONLY__computePrototypeWeightSummaries` | `AxisGapReportSynthesizer` | `service.computePrototypeWeightSummaries()` |

### 8.2 Test File Structure After Refactoring

```
tests/unit/expressionDiagnostics/
├── services/
│   ├── axisGap/                           # NEW DIRECTORY
│   │   ├── pcaAnalysisService.test.js
│   │   ├── hubPrototypeDetector.test.js
│   │   ├── coverageGapDetector.test.js
│   │   ├── multiAxisConflictDetector.test.js
│   │   ├── axisGapRecommendationBuilder.test.js
│   │   └── axisGapReportSynthesizer.test.js
│   └── axisGapAnalyzer.test.js            # SIMPLIFIED (orchestration only)
└── utils/
    ├── vectorMathUtils.test.js            # NEW
    ├── statisticalUtils.test.js           # NEW
    └── adaptiveThresholdUtils.test.js     # NEW
```

---

## 9. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Breaking existing tests | High | Add pre-refactoring tests first; keep `__TEST_ONLY__` methods until all tests migrated |
| DI registration errors | Medium | Follow existing `prototypeOverlapRegistrations.js` patterns exactly |
| Missing functionality after extraction | High | Trace every private method; verify method call counts match |
| Performance regression | Low | Service instantiation is minimal; use singletons via DI |
| Circular dependencies | Low | Utilities have no dependencies; services depend only on lower tiers |
| API breaking changes | High | Maintain exact `analyze()` signature and return type |

---

## 10. Implementation Checklist

### Pre-Refactoring (Must Complete First)

- [ ] **P1-1**: Create `tests/unit/expressionDiagnostics/utils/vectorMathUtils.test.js`
  - [ ] Test `computeVectorMagnitude()` with various inputs
  - [ ] Test `computeCosineDistance()` with `useAbsolute` option
  - [ ] Test `normalizeVector()` edge cases
  - [ ] Test `clamp01()` boundary cases

- [ ] **P1-2**: Create `tests/unit/expressionDiagnostics/utils/adaptiveThresholdUtils.test.js`
  - [ ] Test threshold computation with various prototype counts
  - [ ] Test caching behavior
  - [ ] Test seeded RNG reproducibility
  - [ ] Test edge cases (empty input, insufficient prototypes)

- [ ] **P1-3**: Create `tests/unit/expressionDiagnostics/utils/statisticalUtils.test.js`
  - [ ] Test `computeMedianAndIQR()` comprehensively
  - [ ] Test `computePercentile()` for adaptive thresholds

- [ ] **P1-4**: Add direct tests for `__TEST_ONLY__detectHighAxisLoadings()`
- [ ] **P1-5**: Add direct tests for `__TEST_ONLY__detectSignTensions()`
- [ ] **P1-6**: Add tests for `__TEST_ONLY__performDBSCANClustering()`
- [ ] **P1-7**: Add tests for `__TEST_ONLY__getEffectiveDistanceThreshold()`

### Phase 1: Utilities

- [ ] **1.1**: Extract `vectorMathUtils.js`
- [ ] **1.2**: Extract `statisticalUtils.js`
- [ ] **1.3**: Extract `adaptiveThresholdUtils.js`
- [ ] **1.4**: Run all tests, verify green

### Phase 2: Leaf Services

- [ ] **2.1**: Extract `PCAAnalysisService.js`
- [ ] **2.2**: Create unit tests for `PCAAnalysisService`
- [ ] **2.3**: Extract `MultiAxisConflictDetector.js`
- [ ] **2.4**: Create unit tests for `MultiAxisConflictDetector`
- [ ] **2.5**: Run all tests, verify green

### Phase 3: Mid-Tier Services

- [ ] **3.1**: Extract `CoverageGapDetector.js`
- [ ] **3.2**: Create unit tests for `CoverageGapDetector`
- [ ] **3.3**: Extract `HubPrototypeDetector.js`
- [ ] **3.4**: Create unit tests for `HubPrototypeDetector`
- [ ] **3.5**: Run all tests, verify green

### Phase 4: High-Level Services

- [ ] **4.1**: Extract `AxisGapRecommendationBuilder.js`
- [ ] **4.2**: Create unit tests for `AxisGapRecommendationBuilder`
- [ ] **4.3**: Extract `AxisGapReportSynthesizer.js`
- [ ] **4.4**: Create unit tests for `AxisGapReportSynthesizer`
- [ ] **4.5**: Run all tests, verify green

### Phase 5: Orchestrator Refactor

- [ ] **5.1**: Add DI tokens for all new services
- [ ] **5.2**: Add DI registrations for all new services
- [ ] **5.3**: Refactor `AxisGapAnalyzer.js` to orchestration only
- [ ] **5.4**: Remove all `__TEST_ONLY__` methods from `AxisGapAnalyzer`
- [ ] **5.5**: Update/migrate all existing tests
- [ ] **5.6**: Run full test suite, verify green
- [ ] **5.7**: Run integration tests
- [ ] **5.8**: Verify public API unchanged

### Post-Refactoring Validation

- [ ] **V-1**: Verify `AxisGapAnalyzer.js` ≤ 200 lines
- [ ] **V-2**: Verify each new service ≤ 400 lines
- [ ] **V-3**: Verify each utility ≤ 150 lines
- [ ] **V-4**: Run `npm run lint` on all new/modified files
- [ ] **V-5**: Run `npm run typecheck`
- [ ] **V-6**: Run `npm run test:ci`
- [ ] **V-7**: Verify no `__TEST_ONLY__` methods remain in `AxisGapAnalyzer`

---

## Appendix A: Files to Modify

| File | Action |
|------|--------|
| `src/expressionDiagnostics/services/AxisGapAnalyzer.js` | Refactor (reduce from ~2300 to ~150 lines) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Add 6 new tokens |
| `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` | Add 6 new registrations |
| `tests/unit/expressionDiagnostics/services/axisGapAnalyzer.test.js` | Refactor to test orchestration only |

## Appendix B: Files to Create

| File | Lines (Est.) |
|------|-------------|
| `src/expressionDiagnostics/services/axisGap/index.js` | ~20 |
| `src/expressionDiagnostics/services/axisGap/PCAAnalysisService.js` | ~350 |
| `src/expressionDiagnostics/services/axisGap/HubPrototypeDetector.js` | ~250 |
| `src/expressionDiagnostics/services/axisGap/CoverageGapDetector.js` | ~300 |
| `src/expressionDiagnostics/services/axisGap/MultiAxisConflictDetector.js` | ~200 |
| `src/expressionDiagnostics/services/axisGap/AxisGapRecommendationBuilder.js` | ~250 |
| `src/expressionDiagnostics/services/axisGap/AxisGapReportSynthesizer.js` | ~200 |
| `src/expressionDiagnostics/utils/vectorMathUtils.js` | ~100 |
| `src/expressionDiagnostics/utils/statisticalUtils.js` | ~80 |
| `src/expressionDiagnostics/utils/adaptiveThresholdUtils.js` | ~120 |
| `tests/unit/expressionDiagnostics/services/axisGap/pcaAnalysisService.test.js` | ~400 |
| `tests/unit/expressionDiagnostics/services/axisGap/hubPrototypeDetector.test.js` | ~300 |
| `tests/unit/expressionDiagnostics/services/axisGap/coverageGapDetector.test.js` | ~400 |
| `tests/unit/expressionDiagnostics/services/axisGap/multiAxisConflictDetector.test.js` | ~300 |
| `tests/unit/expressionDiagnostics/services/axisGap/axisGapRecommendationBuilder.test.js` | ~300 |
| `tests/unit/expressionDiagnostics/services/axisGap/axisGapReportSynthesizer.test.js` | ~300 |
| `tests/unit/expressionDiagnostics/utils/vectorMathUtils.test.js` | ~200 |
| `tests/unit/expressionDiagnostics/utils/statisticalUtils.test.js` | ~150 |
| `tests/unit/expressionDiagnostics/utils/adaptiveThresholdUtils.test.js` | ~200 |

---

*End of Specification*
