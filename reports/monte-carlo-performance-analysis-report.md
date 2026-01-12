# Monte Carlo Simulator Performance Analysis Report

**Date**: 2026-01-11
**Scope**: Performance analysis of the "Run Simulation" button implementation
**Target**: `expression-diagnostics.html` Monte Carlo simulation

---

## Executive Summary

The Monte Carlo simulator in the expression diagnostics tool has **three critical performance bottlenecks** that can be addressed with straightforward changes:

| Priority | Issue | Current Impact | Expected Improvement | Effort |
|----------|-------|----------------|---------------------|--------|
| **P0** | Redundant context building | 4x unnecessary computation | **2-4x speedup** | 2-3 hours |
| **P1** | Unfiltered emotion calculation | 50+ emotions computed, 1-2 needed | **10-50x reduction** | 4-6 hours |
| **P2** | Unbounded array growth | 100K+ values stored | **90%+ memory reduction** | 3-4 hours |

**Total potential improvement**: 20-200x faster execution with 90%+ memory reduction for the standard 10,000 sample simulation.

---

## Analyzed Files

| File | Lines | Role |
|------|-------|------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | 1950 | Core simulation engine |
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | 171 | Random state generation |
| `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js` | 79 | Emotion calculation bridge |
| `src/emotions/emotionCalculatorService.js` | 700+ | Actual emotion computation |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | 500+ | Tree statistics tracking |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | 1200+ | UI controller |

---

## Execution Flow Analysis

```
User clicks "Run Simulation"
    │
    ▼
ExpressionDiagnosticsController.#runMonteCarloSimulation() [line 578]
    │
    ▼
MonteCarloSimulator.simulate(expression, config) [line 157]
    │
    ├── For each sample (10,000 default):
    │   │
    │   ├── RandomStateGenerator.generate() [line 224]
    │   │
    │   ├── #buildContext() ← DUPLICATE CALL #1 [line 227]
    │   │   ├── calculateEmotions (ALL 50+ prototypes)
    │   │   ├── calculateSexualArousal
    │   │   ├── calculateSexualStates (ALL 10+ prototypes)
    │   │   └── Same calculations for previous state
    │   │
    │   ├── #evaluateWithTracking() [line 237]
    │   │   └── #buildContext() ← DUPLICATE CALL #2 [line 431]
    │   │
    │   └── For non-triggering samples:
    │       ├── #countFailedClauses() [line 266]
    │       │   └── #buildContext() ← DUPLICATE CALL #3 [line 1425]
    │       │
    │       └── #getFailedLeavesSummary() [line 272]
    │           └── #buildContext() ← DUPLICATE CALL #4 [line 1487]
    │
    └── Returns SimulationResult
```

---

## P0 - CRITICAL: Redundant Context Building

### Problem Description

The `#buildContext()` method is called **up to 4 times per sample** when it should only be called **once**.

### Code Locations

| Location | File | Line | Method |
|----------|------|------|--------|
| Main loop | `MonteCarloSimulator.js` | 227 | `simulate()` |
| Evaluation | `MonteCarloSimulator.js` | 431 | `#evaluateWithTracking()` |
| Failure count | `MonteCarloSimulator.js` | 1425 | `#countFailedClauses()` |
| Failure summary | `MonteCarloSimulator.js` | 1487 | `#getFailedLeavesSummary()` |

### Current Code (Problem)

```javascript
// MonteCarloSimulator.js, lines 222-276
for (let i = processed; i < chunkEnd; i++) {
  const { current, previous, affectTraits } =
    this.#randomStateGenerator.generate(distribution, samplingMode);

  // BUILD #1: Context built here
  const context = this.#buildContext(current, previous, affectTraits);

  // Store for sensitivity analysis (uses the built context)
  if (storedContexts !== null && storedContexts.length < sensitivitySampleLimit) {
    storedContexts.push(context);
  }

  // PROBLEM: #evaluateWithTracking rebuilds context internally (BUILD #2)
  const result = this.#evaluateWithTracking(
    expression,
    current,      // Passes raw states
    previous,     // instead of built context
    affectTraits,
    clauseTracking
  );

  if (result.triggered) {
    triggerCount++;
    // ...
  } else if (clauseTracking) {
    // PROBLEM: #countFailedClauses rebuilds context (BUILD #3)
    const failedCount = this.#countFailedClauses(
      clauseTracking, expression, current, previous, affectTraits
    );

    if (failedCount < nearestMissFailedCount) {
      nearestMissFailedCount = failedCount;
      nearestMiss = {
        sample: { current, previous, affectTraits },
        failedLeafCount: failedCount,
        // PROBLEM: #getFailedLeavesSummary rebuilds context (BUILD #4)
        failedLeaves: this.#getFailedLeavesSummary(
          clauseTracking, expression, current, previous, affectTraits
        ),
      };
    }
  }
}
```

### Impact Calculation

| Metric | Current | With Fix |
|--------|---------|----------|
| Context builds per sample | 4 (worst case) | 1 |
| Prototype iterations per build | 6 (emotions + sexual × 2) | 6 |
| Prototypes per iteration | ~60 (50 emotion + 10 sexual) | ~60 |
| **Total prototype calcs (10K samples)** | **2,400,000** | **600,000** |

### Recommended Fix

```javascript
// STEP 1: Modify #evaluateWithTracking to accept context
#evaluateWithTracking(expression, context, clauseTracking) {
  // Remove internal #buildContext call (line 431)
  // Use passed context directly

  if (clauseTracking && expression?.prerequisites) {
    // ... rest of method uses context parameter
  }

  const triggered = this.#evaluateAllPrerequisites(expression, context);
  return { triggered };
}

// STEP 2: Modify #countFailedClauses to accept context
#countFailedClauses(clauseTracking, expression, context) {
  // Remove line 1425: const context = this.#buildContext(...)
  // Use passed context directly
  let failedCount = 0;
  // ...
}

// STEP 3: Modify #getFailedLeavesSummary to accept context
#getFailedLeavesSummary(clauseTracking, expression, context) {
  // Remove line 1487: const context = this.#buildContext(...)
  // Use passed context directly
  const failedLeaves = [];
  // ...
}

// STEP 4: Update main loop to pass context
for (let i = processed; i < chunkEnd; i++) {
  const { current, previous, affectTraits } =
    this.#randomStateGenerator.generate(distribution, samplingMode);

  // Build context ONCE
  const context = this.#buildContext(current, previous, affectTraits);

  if (storedContexts !== null && storedContexts.length < sensitivitySampleLimit) {
    storedContexts.push(context);
  }

  // Pass context instead of raw states
  const result = this.#evaluateWithTracking(expression, context, clauseTracking);

  if (result.triggered) {
    triggerCount++;
    // ...
  } else if (clauseTracking) {
    // Pass context instead of raw states
    const failedCount = this.#countFailedClauses(clauseTracking, expression, context);

    if (failedCount < nearestMissFailedCount) {
      nearestMissFailedCount = failedCount;
      nearestMiss = {
        sample: { current, previous, affectTraits },
        failedLeafCount: failedCount,
        // Pass context instead of raw states
        failedLeaves: this.#getFailedLeavesSummary(clauseTracking, expression, context),
      };
    }
  }
}
```

### Files to Modify

| File | Changes Required |
|------|------------------|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Update method signatures and callers |

### Test Coverage to Verify

```bash
npm run test:unit -- --testPathPattern="monteCarloSimulator"
npm run test:integration -- --testPathPattern="expression-diagnostics"
```

---

## P1 - HIGH: Unfiltered Emotion Calculation

### Problem Description

The `EmotionCalculatorService.calculateEmotions()` method iterates through **ALL emotion prototypes** (50+) even when the expression only references 1-2 specific emotions.

### Code Locations

| Component | File | Lines |
|-----------|------|-------|
| Full prototype iteration | `emotionCalculatorService.js` | 592-618 |
| Prototype iteration loop | `emotionCalculatorService.js` | 606-614 |
| Referenced emotions extraction | `MonteCarloSimulator.js` | 1894-1926 |

### Current Code (Problem)

```javascript
// EmotionCalculatorService.js, lines 606-614
for (const [emotionName, prototype] of Object.entries(prototypes)) {
  const intensity = this.#calculatePrototypeIntensity(
    prototype,
    normalizedAxes,
    sexualAxes,
    traitAxes
  );
  result.set(emotionName, intensity);
}
// ^ Calculates ALL emotions even if expression only needs 2
```

### Existing Infrastructure (Underutilized)

The `#extractReferencedEmotions()` method already exists and correctly identifies which emotions are referenced:

```javascript
// MonteCarloSimulator.js, lines 1894-1926
#extractReferencedEmotions(expression) {
  const emotionNames = new Set();
  // Walks JSON Logic tree to find emotions.* and previousEmotions.* paths
  // Returns Set of emotion names (e.g., 'anger', 'grief')
  // ...
}
```

**Current usage**: Only used for filtering witness output (line 212, 254-259)
**Should be used for**: Limiting emotion calculations

### Impact Calculation

| Scenario | Emotions Calculated | With Fix |
|----------|---------------------|----------|
| Expression: `emotions.anger >= 0.5` | 50+ | 1 |
| Expression: `emotions.joy >= 0.3 AND emotions.sadness >= 0.2` | 50+ | 2 |
| Expression: Complex with 5 emotions | 50+ | 5 |

**Typical reduction**: 90-98% fewer emotion calculations

### Recommended Fix

#### Option A: Add Filtered Method to Adapter (Recommended)

```javascript
// EmotionCalculatorAdapter.js - Add new method
/**
 * Calculate only specified emotions from mood state.
 * @param {object} mood - Mood axes with values in [-100, 100]
 * @param {object|null} sexualState - Optional sexual state axes
 * @param {object|null} affectTraits - Optional affect trait modifiers
 * @param {Set<string>} emotionFilter - Set of emotion names to calculate
 * @returns {object} Emotion intensities (only for filtered emotions)
 */
calculateEmotionsFiltered(mood, sexualState, affectTraits, emotionFilter) {
  if (!emotionFilter || emotionFilter.size === 0) {
    // Fallback to full calculation if no filter
    return this.calculateEmotions(mood, sexualState, affectTraits);
  }

  const results = this.#emotionCalculatorService.calculateEmotionsFiltered(
    mood,
    null,
    sexualState,
    affectTraits,
    emotionFilter
  );
  return this.#mapToObject(results);
}
```

#### Option B: Add Filtered Method to Service

```javascript
// EmotionCalculatorService.js - Add new method
/**
 * Calculate emotions for specified prototypes only.
 * @param {object} moodData - Mood axes
 * @param {number|null} sexualArousal - Sexual arousal value
 * @param {object|null} sexualState - Sexual state axes
 * @param {object|null} affectTraits - Affect traits
 * @param {Set<string>} emotionFilter - Emotion names to calculate
 * @returns {Map<string, number>}
 */
calculateEmotionsFiltered(moodData, sexualArousal, sexualState, affectTraits, emotionFilter) {
  const result = new Map();

  const prototypes = this.#ensureEmotionPrototypes();
  if (!prototypes) return result;

  const normalizedAxes = this.#normalizeMoodAxes(moodData);
  const sexualAxes = this.#normalizeSexualAxes(sexualState, sexualArousal);
  const traitAxes = this.#normalizeAffectTraits(affectTraits);

  // Only iterate filtered emotions
  for (const emotionName of emotionFilter) {
    const prototype = prototypes[emotionName];
    if (!prototype) continue;

    const intensity = this.#calculatePrototypeIntensity(
      prototype,
      normalizedAxes,
      sexualAxes,
      traitAxes
    );
    result.set(emotionName, intensity);
  }

  return result;
}
```

#### Update MonteCarloSimulator to Use Filtered Calculation

```javascript
// MonteCarloSimulator.js - In simulate() method
async simulate(expression, config = {}) {
  // Extract referenced emotions ONCE at simulation start
  const referencedEmotions = this.#extractReferencedEmotions(expression);
  const referencedSexualStates = this.#extractReferencedSexualStates(expression);

  // ... in #buildContext or a new #buildFilteredContext:
  const emotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
    currentState.mood,
    currentState.sexual,
    affectTraits,
    referencedEmotions  // Only calculate needed emotions
  );
}
```

### Files to Modify

| File | Changes Required |
|------|------------------|
| `src/emotions/emotionCalculatorService.js` | Add `calculateEmotionsFiltered()` method |
| `src/expressionDiagnostics/adapters/EmotionCalculatorAdapter.js` | Add `calculateEmotionsFiltered()` wrapper |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Use filtered calculation in `#buildContext()` |

---

## P2 - MEDIUM: Unbounded Array Growth

### Problem Description

`HierarchicalClauseNode` stores **every observed value** for percentile calculations without any limit, causing memory growth linear with sample count.

### Code Locations

| Field | File | Line | Purpose |
|-------|------|------|---------|
| `#observedValues` | `HierarchicalClauseNode.js` | 61 | All observed values for p99 |
| `#violationValues` | `HierarchicalClauseNode.js` | 52 | All violation magnitudes |

### Current Code (Problem)

```javascript
// HierarchicalClauseNode.js
class HierarchicalClauseNode {
  /** @type {number[]} All observed values for p99 calculation */
  #observedValues = [];  // Grows unbounded

  /** @type {number[]} Individual violation values for percentile calculation */
  #violationValues = [];  // Grows unbounded

  // ...

  recordObservedValue(value) {
    this.#observedValues.push(value);  // No limit
    // ...
  }

  recordEvaluation(passed, violation = 0) {
    // ...
    if (!passed && violation > 0) {
      this.#violationValues.push(violation);  // No limit
    }
  }
}
```

### Impact Calculation

| Sample Count | Leaf Nodes | Values Stored | Memory (approx) |
|--------------|------------|---------------|-----------------|
| 1,000 | 10 | 10,000 | 80 KB |
| 10,000 | 10 | 100,000 | 800 KB |
| 100,000 | 10 | 1,000,000 | 8 MB |

### Existing Configuration (Unused)

```javascript
// advancedMetricsConfig.js, line 57
maxViolationsSampled: Infinity, // No limit currently
```

### Recommended Fix: Reservoir Sampling

```javascript
// HierarchicalClauseNode.js - Add reservoir sampling
class HierarchicalClauseNode {
  static MAX_STORED_VALUES = 1000;  // Configurable limit

  #observedValues = [];
  #violationValues = [];
  #observedCount = 0;  // Total count for reservoir sampling
  #violationCount = 0;

  /**
   * Record observed value with reservoir sampling.
   * Maintains representative sample while bounding memory.
   */
  recordObservedValue(value) {
    this.#observedCount++;

    if (this.#observedValues.length < HierarchicalClauseNode.MAX_STORED_VALUES) {
      // Fill reservoir
      this.#observedValues.push(value);
    } else {
      // Reservoir sampling: randomly replace with decreasing probability
      const j = Math.floor(Math.random() * this.#observedCount);
      if (j < HierarchicalClauseNode.MAX_STORED_VALUES) {
        this.#observedValues[j] = value;
      }
    }

    // Update running min/max (O(1) memory)
    if (value > this.#maxObservedValue) this.#maxObservedValue = value;
    if (value < this.#minObservedValue) this.#minObservedValue = value;
  }

  /**
   * Record violation value with reservoir sampling.
   */
  #recordViolationValue(violation) {
    this.#violationCount++;

    if (this.#violationValues.length < HierarchicalClauseNode.MAX_STORED_VALUES) {
      this.#violationValues.push(violation);
    } else {
      const j = Math.floor(Math.random() * this.#violationCount);
      if (j < HierarchicalClauseNode.MAX_STORED_VALUES) {
        this.#violationValues[j] = violation;
      }
    }
  }
}
```

### Update Configuration

```javascript
// advancedMetricsConfig.js
maxViolationsSampled: 1000, // Bounded for memory efficiency
```

### Files to Modify

| File | Changes Required |
|------|------------------|
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Implement reservoir sampling |
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | Set reasonable limit |

---

## P3 - LOW: Minor Optimizations

### 3.1 Map to Object Conversion

**Location**: `EmotionCalculatorAdapter.js:65-75`

```javascript
// Current (creates iterator, iterates, builds new object)
#mapToObject(map) {
  if (!map || typeof map[Symbol.iterator] !== 'function') {
    return {};
  }
  const obj = {};
  for (const [key, value] of map) {
    obj[key] = value;
  }
  return obj;
}

// Alternative: Use Object.fromEntries (single native call)
#mapToObject(map) {
  return map ? Object.fromEntries(map) : {};
}
```

### 3.2 JSON Deep Clone in Sensitivity Analysis

**Location**: `MonteCarloSimulator.js:1812`

```javascript
// Current (expensive for large logic trees)
const clone = JSON.parse(JSON.stringify(logic));

// Alternative: Structured clone (if available) or targeted mutation
// Note: For sensitivity analysis, consider mutating a single copy
// and restoring, rather than cloning for each grid point
```

### 3.3 setTimeout Overhead

**Location**: `MonteCarloSimulator.js:282`

```javascript
// Current: ~4ms minimum delay per chunk
await new Promise((resolve) => setTimeout(resolve, 0));

// Alternative: Use requestIdleCallback if available
await new Promise((resolve) => {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(resolve);
  } else {
    setTimeout(resolve, 0);
  }
});
```

---

## Implementation Priority Summary

| Priority | Issue | Speedup | Memory | Effort | Dependencies |
|----------|-------|---------|--------|--------|--------------|
| **P0** | Redundant context building | 2-4x | - | 2-3h | None |
| **P1** | Unfiltered emotion calculation | 10-50x | - | 4-6h | P0 recommended first |
| **P2** | Unbounded array growth | - | 90%+ | 3-4h | None |
| **P3** | Minor optimizations | 5-10% | - | 1-2h | None |

**Recommended order**: P0 → P1 → P2 → P3

---

## Verification Procedures

### 1. Unit Tests

```bash
# Run all Monte Carlo related tests
npm run test:unit -- --testPathPattern="monteCarloSimulator"
npm run test:unit -- --testPathPattern="HierarchicalClauseNode"
npm run test:unit -- --testPathPattern="emotionCalculator"
```

### 2. Integration Tests

```bash
npm run test:integration -- --testPathPattern="expression-diagnostics"
```

### 3. Manual Performance Verification

1. Open `expression-diagnostics.html` in browser
2. Select any expression
3. Open DevTools → Performance tab
4. Record while running simulation with 10,000 samples
5. Compare timing before and after each fix

### 4. Result Accuracy Verification

After each fix, verify simulation results are identical:
1. Run simulation on same expression before fix
2. Record: trigger rate, confidence interval, top blockers
3. Apply fix
4. Run simulation again with same settings
5. Verify results match within statistical variance

---

## Appendix: Related Files

| File | Role | Relevance |
|------|------|-----------|
| `reports/expression-diagnostics-monte-carlo-refactor-report.md` | Previous refactoring report | Architecture concerns |
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | Sensitivity analysis | Uses storedContexts |
| `src/expressionDiagnostics/services/ReportOrchestrator.js` | Report generation | Post-simulation |
| `src/expressionDiagnostics/services/FailureExplainer.js` | Blocker analysis | Uses clause results |
