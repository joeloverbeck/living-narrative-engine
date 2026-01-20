# RecommendationEngine.js Refactoring Analysis Report

**Date**: 2026-01-19
**Target File**: `src/expressionDiagnostics/services/RecommendationEngine.js`
**Current Size**: 2,056 lines of code
**Project Guideline**: ≤500 lines per file

---

## 1. Executive Summary

The `RecommendationEngine` is a core business logic component in the Expression Diagnostics subsystem. It transforms `DiagnosticFacts` into actionable recommendations for improving expression trigger rates. While the implementation demonstrates several good architectural patterns (explicit constants, private method extraction, clear data contracts), its size is **4x over the project's 500-line guideline** and exhibits multiple Single Responsibility Principle (SRP) violations.

This report provides a prioritized refactoring roadmap to decompose the class into focused, testable components while maintaining full backward compatibility.

---

## 2. Current State Metrics

### 2.1 Size Metrics

| Metric | Current Value | Project Target | Deviation |
|--------|--------------|----------------|-----------|
| Lines of Code | 2,056 | ≤500 | **+311%** |
| Public Methods | 1 | - | ✅ Good (minimal surface) |
| Private Methods | 50+ | - | ⚠️ High extraction debt |
| Module Constants | 22 | - | ✅ Explicit, grouped |
| Constructor Dependencies | 2 (optional) | - | ✅ Loose coupling |

### 2.2 Complexity Indicators

| Indicator | Assessment | Evidence |
|-----------|------------|----------|
| Cyclomatic Complexity | **High** | Multiple nested conditionals in `generate()` |
| Cognitive Load | **High** | 50+ private methods to navigate |
| Method Length | **Mixed** | Some methods >100 lines |
| Nesting Depth | **Moderate** | Up to 4 levels in loops |
| Parameter Count | **Good** | Most methods use destructuring |

### 2.3 Dependency Analysis

```
RecommendationEngine
├── Optional: prototypeSynthesisService
│   └── Used by: #buildPrototypeCreateSuggestion, #synthesizeProposedPrototype
└── Optional: emotionSimilarityService
    └── Used by: #buildEmotionAlternativeOption, #buildOverconstrainedSuggestions
```

**Coupling Assessment**: Low external coupling (good), but high internal coupling between private methods.

---

## 3. Single Responsibility Analysis

### 3.1 Identified Responsibility Clusters

The file contains **6 distinct responsibility clusters**, each handling a different recommendation type:

#### Cluster 1: Overconstrained Conjunction Analysis
**Lines**: 79-102, 1999-2052
**Size**: ~75 lines
**Methods**:
- Inline logic in `generate()` (lines 79-102)
- `#buildOverconstrainedSuggestions(info)`

**Responsibility**: Detects when multiple emotion thresholds are ANDed together with individually low pass rates, making joint probability near-zero.

**Dependencies**: `#emotionSimilarityService` for finding similar emotions

---

#### Cluster 2: Gate Clamp Regime Analysis
**Lines**: 348-793
**Size**: ~450 lines
**Methods**:
- `#buildGateClampRecommendation(clause)`
- `#selectGateClampCandidate(gateClampFacts)`
- `#candidateMeetsGateClampThresholds(candidate, clampRate, gateClampFacts)`
- `#candidateTightensRegime(candidate, gatePredicates)`
- `#constraintTightensBounds(bounds, operator, threshold)`
- `#buildGateClampEvidence(gateClampFacts, candidate)`
- `#buildGateClampActions(candidate)`

**Responsibility**: Identifies when mood regime permits gate-clamped states and suggests constraint tightening.

**Data Structures**: Complex candidate selection with multi-criteria sorting.

---

#### Cluster 3: Sole Blocker Analysis
**Lines**: 405-526
**Size**: ~120 lines
**Methods**:
- `#buildSoleBlockerRecommendation(clause)`

**Responsibility**: Detects clauses that are the "decisive blocker" (all other clauses pass, only this one fails) and suggests threshold edits with percentile-based guidance.

**Output**: Threshold suggestions at P50 and P90 percentiles.

---

#### Cluster 4: Prototype Mismatch Detection
**Lines**: 136-321
**Size**: ~190 lines
**Methods**:
- Inline logic in `generate()` for:
  - Gate mismatch detection
  - Threshold mismatch detection
  - Gate incompatibility detection
  - Axis sign conflict triggering
- `#getMismatchTitle(gateMismatch, thresholdMismatch)`
- `#buildEvidence({...})`
- `#buildActions({gateMismatch, thresholdMismatch})`
- `#buildGateIncompatibilityActions()`

**Responsibility**: Identifies structural misalignments between expression requirements and prototype capabilities.

---

#### Cluster 5: Axis Conflict Analysis
**Lines**: 965-1300
**Size**: ~340 lines
**Methods**:
- `#normalizeAxisConflicts(axisConflicts)`
- `#buildAxisConflictEvidence(axisConflicts, moodSampleCount)`
- `#buildAxisSignConflictActions(axisConflicts, prototypeId)`
- `#buildConflictSummary(axisConflicts, prototypeId)`
- `#buildRequirementText(conflict)`
- `#buildRegimeRelaxationOption(axisConflicts)` → Option A
- `#buildEmotionAlternativeOption(axisConflicts, prototypeId)` → Option B
- `#formatAxisName(axisName)`
- `#getAxisConflictSeverity({axisConflicts, clause, impact})`
- `#getMaxLostIntensity(axisConflicts)`

**Responsibility**: Analyzes when prototype weight signs oppose regime constraints and provides binary choice framing (keep emotion vs. keep regime).

**Dependencies**: `#emotionSimilarityService` for alternative emotion suggestions.

---

#### Cluster 6: Prototype Create Suggestion
**Lines**: 1372-1996
**Size**: ~625 lines (largest cluster)
**Methods**:
- `#buildPrototypeCreateSuggestion(diagnosticFacts)` - main entry
- `#selectAnchorClause(clauses)`
- `#buildCandidateSet(leaderboard, gapDetection)`
- `#findBestExistingPrototype(candidates, thresholdTStar)`
- `#getPAtLeastT(prototype, threshold)`
- `#interpolatePAtLeastT(pAbove, threshold)`
- `#checkNoUsablePrototype(candidates, thresholdTStar)`
- `#isUsablePrototype(proto, thresholdTStar)`
- `#checkGapSignal(gapDetection)`
- `#checkImprovementCondition(predictedFit, best, thresholdTStar)`
- `#getPAtLeastTFromPredicted(predictedFit, threshold)`
- `#synthesizeProposedPrototype(diagnosticFacts, anchorClause, threshold)`
- `#passesSanityCheck(synthesized)`
- `#determineConfidence(A, B, C, sanityPassed)`
- `#buildPrototypeCreateEvidence({...})`
- `#buildPrototypeCreateWhy(A, B, C, shouldEmitAB, shouldEmitC)`
- `#buildPredictedFitPayload(predictedFit, best, thresholdTStar, diagnosticFacts)`
- `#getAnchorPrototypeId(anchorClause, diagnosticFacts)`
- `#serializeTargetSignature(targetSignature)`
- `#summarizeTargetSignature(targetSignature)`

**Responsibility**: Evaluates whether a new prototype should be created based on emission conditions (A && B) || C with spam brake logic.

**Dependencies**: `#prototypeSynthesisService` for prototype synthesis.

**Complexity**: Implements a sophisticated decision algorithm with three conditions, spam brake, and sanity checks.

---

### 3.2 Shared Utilities (Cross-Cutting)

**Lines**: Scattered throughout
**Size**: ~100 lines
**Methods**:
- `#getConfidence(moodSampleCount)` - confidence level from sample size
- `#getSeverity(impact)` - severity level from impact score
- `#buildPopulation(name, count)` - population metadata builder
- `#classifyChokeType({prototype, clause, gateMismatch, thresholdMismatch})`
- `#isThresholdChoke({passGivenGate, meanValueGivenGate, thresholdValue})`
- `#getImpactFromId(id, clauses)`

**Constants**:
- `SEVERITY_ORDER` - severity ranking map
- `CHOKE_GATE_FAIL_RATE`, `CHOKE_PASS_GIVEN_GATE_MAX` - choke classification thresholds

---

## 4. Prioritized Refactoring Recommendations

### 4.1 Priority Matrix

| Priority | Target | Lines | Impact | Risk | Effort |
|----------|--------|-------|--------|------|--------|
| **P1** | PrototypeCreateSuggestionBuilder | 625 | High | Medium | High |
| **P2** | GateClampRecommendationBuilder | 450 | High | Medium | Medium |
| **P3** | AxisConflictAnalyzer | 340 | Medium | Low | Medium |
| **P4** | OverconstrainedConjunctionBuilder | 75 | Low | Low | Low |
| **P5** | SoleBlockerRecommendationBuilder | 120 | Low | Low | Low |
| **P6** | recommendationUtils | 100 | Low | Very Low | Low |

---

### 4.2 P1: Extract PrototypeCreateSuggestionBuilder

**Rationale**: Largest cohesive cluster with clear boundaries. Self-contained decision algorithm.

**Target Location**: `src/expressionDiagnostics/services/recommendationBuilders/PrototypeCreateSuggestionBuilder.js`

**Interface Design**:
```javascript
class PrototypeCreateSuggestionBuilder {
  constructor({ prototypeSynthesisService }) {
    // Required dependency (not optional in this context)
  }

  /**
   * @param {object} diagnosticFacts
   * @returns {object|null} Recommendation or null
   */
  build(diagnosticFacts) {
    // Move all prototype create logic here
  }
}
```

**Constants to Move**:
```javascript
const DEFAULT_THRESHOLD_T_STAR = 0.55;
const CANDIDATE_SET_SIZE = 10;
const USABLE_GATE_PASS_RATE_MIN = 0.30;
const USABLE_P_AT_LEAST_T_MIN = 0.10;
const USABLE_CONFLICT_RATE_MAX = 0.20;
const IMPROVEMENT_DELTA_MIN = 0.15;
const IMPROVEMENT_BOTH_LOW_THRESHOLD = 0.05;
const GAP_NEAREST_DISTANCE_THRESHOLD = 0.45;
const GAP_PERCENTILE_THRESHOLD = 95;
const SANITY_GATE_PASS_RATE_MIN = 0.20;
const SANITY_MIN_NON_ZERO_WEIGHTS = 3;
const SPAM_BRAKE_DISTANCE_MAX = 0.35;
const SPAM_BRAKE_P_AT_LEAST_T_MIN = 0.15;
```

**Expected Outcome**: RecommendationEngine reduced by ~600 lines.

---

### 4.3 P2: Extract GateClampRecommendationBuilder

**Rationale**: Complex candidate selection algorithm deserves isolation.

**Target Location**: `src/expressionDiagnostics/services/recommendationBuilders/GateClampRecommendationBuilder.js`

**Interface Design**:
```javascript
class GateClampRecommendationBuilder {
  /**
   * @param {object} clause - Clause with gateClampRegimePermissive facts
   * @returns {object|null} Recommendation or null
   */
  build(clause) {
    // Move gate clamp logic here
  }
}
```

**Constants to Move**:
```javascript
const GATE_CLAMP_MIN_RATE = 0.2;
const GATE_CLAMP_MIN_KEEP = 0.5;
const GATE_CLAMP_MIN_DELTA = 0.1;
```

**Expected Outcome**: RecommendationEngine reduced by ~420 lines.

---

### 4.4 P3: Extract AxisConflictAnalyzer

**Rationale**: Clear analysis responsibility with distinct output structure.

**Target Location**: `src/expressionDiagnostics/services/analyzers/AxisConflictAnalyzer.js`

**Interface Design**:
```javascript
class AxisConflictAnalyzer {
  constructor({ emotionSimilarityService = null }) {
    // Optional for alternative suggestions
  }

  /**
   * @param {Array} axisConflicts
   * @param {string} prototypeId
   * @param {number} moodSampleCount
   * @returns {{ actions: string[], structuredActions: object, evidence: Array }}
   */
  analyze(axisConflicts, prototypeId, moodSampleCount) {
    // Consolidated analysis
  }

  /**
   * @param {object} params
   * @returns {string} Severity level
   */
  getSeverity({ axisConflicts, clause, impact }) {
    // Severity calculation
  }
}
```

**Expected Outcome**: RecommendationEngine reduced by ~340 lines.

---

### 4.5 P4: Extract OverconstrainedConjunctionBuilder

**Rationale**: Distinct recommendation type with EmotionSimilarity dependency.

**Target Location**: `src/expressionDiagnostics/services/recommendationBuilders/OverconstrainedConjunctionBuilder.js`

**Interface Design**:
```javascript
class OverconstrainedConjunctionBuilder {
  constructor({ emotionSimilarityService = null }) {}

  /**
   * @param {object} info - OverconstrainedConjunctionInfo
   * @returns {object} Recommendation object
   */
  build(info) {
    // Build overconstrained recommendation
  }
}
```

**Expected Outcome**: RecommendationEngine reduced by ~75 lines.

---

### 4.6 P5: Extract SoleBlockerRecommendationBuilder

**Rationale**: Self-contained threshold suggestion logic.

**Target Location**: `src/expressionDiagnostics/services/recommendationBuilders/SoleBlockerRecommendationBuilder.js`

**Interface Design**:
```javascript
class SoleBlockerRecommendationBuilder {
  /**
   * @param {object} clause
   * @returns {object|null} Recommendation or null
   */
  build(clause) {
    // Threshold edit suggestions
  }
}
```

**Constants to Move**:
```javascript
const SOLE_BLOCKER_MIN_RATE = 0.1;
const SOLE_BLOCKER_MIN_SAMPLES = 10;
```

**Expected Outcome**: RecommendationEngine reduced by ~120 lines.

---

### 4.7 P6: Extract Shared Utilities

**Rationale**: Enables reuse, reduces duplication in extracted builders.

**Target Location**: `src/expressionDiagnostics/services/utils/recommendationUtils.js`

**Exports**:
```javascript
export const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 };

export function getConfidence(moodSampleCount) { /* ... */ }
export function getSeverity(impact) { /* ... */ }
export function buildPopulation(name, count) { /* ... */ }
export function classifyChokeType({ prototype, clause, gateMismatch, thresholdMismatch }) { /* ... */ }
export function isThresholdChoke({ passGivenGate, meanValueGivenGate, thresholdValue }) { /* ... */ }
export function getImpactFromId(id, clauses) { /* ... */ }
```

**Expected Outcome**: Shared code available to all builders without duplication.

---

## 5. Proposed Architecture

### 5.1 Directory Structure

```
src/expressionDiagnostics/services/
├── RecommendationEngine.js                     (~300 lines - orchestrator only)
│
├── recommendationBuilders/
│   ├── index.js                                (barrel export)
│   ├── PrototypeCreateSuggestionBuilder.js     (~600 lines)
│   ├── GateClampRecommendationBuilder.js       (~420 lines)
│   ├── SoleBlockerRecommendationBuilder.js     (~120 lines)
│   ├── OverconstrainedConjunctionBuilder.js    (~80 lines)
│   └── PrototypeMismatchBuilder.js             (~200 lines, optional P7)
│
├── analyzers/
│   └── AxisConflictAnalyzer.js                 (~350 lines)
│
└── utils/
    └── recommendationUtils.js                  (~100 lines)
```

### 5.2 Refactored RecommendationEngine

After extraction, `RecommendationEngine.js` becomes a **pure orchestrator**:

```javascript
class RecommendationEngine {
  #prototypeCreateBuilder;
  #gateClampBuilder;
  #soleBlockerBuilder;
  #overconstrainedBuilder;
  #axisConflictAnalyzer;

  constructor({
    prototypeSynthesisService = null,
    emotionSimilarityService = null,
  } = {}) {
    // Initialize builders with appropriate dependencies
    this.#prototypeCreateBuilder = prototypeSynthesisService
      ? new PrototypeCreateSuggestionBuilder({ prototypeSynthesisService })
      : null;
    this.#gateClampBuilder = new GateClampRecommendationBuilder();
    this.#soleBlockerBuilder = new SoleBlockerRecommendationBuilder();
    this.#overconstrainedBuilder = new OverconstrainedConjunctionBuilder({
      emotionSimilarityService,
    });
    this.#axisConflictAnalyzer = new AxisConflictAnalyzer({
      emotionSimilarityService,
    });
  }

  generate(diagnosticFacts) {
    if (!diagnosticFacts) return [];
    if (this.#hasInvariantFailure(diagnosticFacts)) return [];

    const recommendations = [];

    // 1. Overconstrained conjunctions
    for (const info of diagnosticFacts.overconstrainedDetails ?? []) {
      recommendations.push(this.#overconstrainedBuilder.build(info));
    }

    // 2. Clause-based recommendations (top 3 by impact)
    const topClauses = this.#getTopClauses(diagnosticFacts.clauses ?? []);
    for (const clause of topClauses) {
      this.#addIfPresent(recommendations, this.#gateClampBuilder.build(clause));
      this.#addIfPresent(recommendations, this.#soleBlockerBuilder.build(clause));
    }

    // 3. Prototype-linked recommendations
    // ... (mismatch, incompatibility, axis conflict)

    // 4. Prototype create suggestion
    if (this.#prototypeCreateBuilder) {
      this.#addIfPresent(
        recommendations,
        this.#prototypeCreateBuilder.build(diagnosticFacts)
      );
    }

    return this.#sortBySeverityAndImpact(recommendations);
  }
}
```

### 5.3 Dependency Injection Updates

**New Tokens** (in `tokens-diagnostics.js`):
```javascript
export const diagnosticsTokens = {
  // Existing
  RecommendationEngine: 'RecommendationEngine',
  // New
  PrototypeCreateSuggestionBuilder: 'PrototypeCreateSuggestionBuilder',
  GateClampRecommendationBuilder: 'GateClampRecommendationBuilder',
  SoleBlockerRecommendationBuilder: 'SoleBlockerRecommendationBuilder',
  OverconstrainedConjunctionBuilder: 'OverconstrainedConjunctionBuilder',
  AxisConflictAnalyzer: 'AxisConflictAnalyzer',
};
```

---

## 6. Migration Strategy

### Phase 1: Extract Utilities (Foundation)
1. Create `recommendationUtils.js` with pure functions
2. Import into `RecommendationEngine.js`
3. Replace private method calls with imported function calls
4. Run existing tests - expect 100% pass rate
5. Commit checkpoint

### Phase 2: Extract PrototypeCreateSuggestionBuilder (Highest Value)
1. Create new class file with constructor accepting `prototypeSynthesisService`
2. Move all 17 prototype-create methods and 13 constants
3. Implement `build(diagnosticFacts)` public method
4. Update `RecommendationEngine` to delegate to builder
5. Run tests - expect 100% pass rate
6. Commit checkpoint

### Phase 3: Extract GateClampRecommendationBuilder
1. Create new class file
2. Move 7 gate-clamp methods and 3 constants
3. Implement `build(clause)` public method
4. Update `RecommendationEngine` delegation
5. Run tests
6. Commit checkpoint

### Phase 4: Extract AxisConflictAnalyzer
1. Create new class with optional `emotionSimilarityService`
2. Move 10 axis-conflict methods
3. Implement `analyze()` and `getSeverity()` methods
4. Update `RecommendationEngine` delegation
5. Run tests
6. Commit checkpoint

### Phase 5: Extract Remaining Builders
1. `OverconstrainedConjunctionBuilder`
2. `SoleBlockerRecommendationBuilder`
3. Update DI registrations
4. Final test verification
5. Commit

### Phase 6: Final Cleanup
1. Remove dead code from `RecommendationEngine`
2. Update imports and exports
3. Verify all tests pass
4. Update any documentation

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Test coverage gaps | Medium | High | Review coverage before each phase |
| Subtle behavior changes | Medium | Medium | Snapshot testing for recommendation output |
| DI registration errors | Low | Medium | Integration tests catch missing registrations |
| Performance regression | Low | Low | Builders are stateless, no overhead |
| Breaking external consumers | Low | High | Public API unchanged |

---

## 8. Verification Checklist

### Per-Phase Verification
- [ ] `npm run test:unit` passes
- [ ] `npx eslint <modified-files>` passes
- [ ] `npm run typecheck` passes
- [ ] Coverage maintained or improved
- [ ] No new lint warnings

### Final Verification
- [ ] `npm run test:integration` passes
- [ ] Monte Carlo report generation produces identical output
- [ ] All recommendation types still emitted correctly
- [ ] DI container resolves all new tokens
- [ ] No circular dependencies introduced

---

## 9. Metrics After Refactoring (Projected)

| Metric | Before | After | Change |
|--------|--------|-------|--------|
| RecommendationEngine LOC | 2,056 | ~300 | **-85%** |
| Largest file in subsystem | 2,056 | ~600 | **-71%** |
| Files in recommendationBuilders/ | 0 | 5 | +5 |
| Average file size | N/A | ~350 | Within guideline |
| Cyclomatic complexity (main file) | High | Low | Significant reduction |

---

## 10. Conclusion

The `RecommendationEngine.js` file has accumulated significant technical debt through organic growth. The 6-priority extraction plan addresses:

1. **SRP violations** by separating 6 distinct responsibility clusters
2. **Size violations** by reducing the file from 2,056 to ~300 lines
3. **Testability** by creating focused, injectable components
4. **Maintainability** by isolating change-prone recommendation logic

The migration can be executed incrementally with low risk, maintaining full backward compatibility at each phase. The resulting architecture aligns with patterns already established in the codebase (e.g., section generators, analyzers).

**Recommended first action**: Extract `recommendationUtils.js` as a foundation, then proceed with `PrototypeCreateSuggestionBuilder` for maximum impact.
