# Prototype Redundancy Analyzer v2 Specification

## Overview

This specification documents the enhancements to the prototype overlap analysis system that improve detection of behavioral relationships between emotion prototypes. The v2 system adds new metrics, gate structure analysis, enhanced classifications, and actionable recommendations.

## Goals

1. **Stop confusing "same direction" with "same behavior"** - High Pearson correlation alone misses gate nesting and practical indistinguishability
2. **Detect and label "nested siblings" explicitly** - Examples: interest→curiosity, embarrassment→humiliation
3. **Detect true redundancy even when correlation isn't 0.98** - Example: numbness↔apathy should be merge-worthy
4. **Generate actionable recommendations** - MERGE, KEEP_DISTINCT, NESTED_SIBLINGS, CONVERT_TO_EXPRESSION

## Non-Goals

- No changes to prototype intensity formula
- No changes to expression rendering/UI
- No deep NLP semantics (name-based heuristics are optional/configurable)

---

## Architecture Changes

### Current Pipeline
```
CandidatePairFilter → BehavioralOverlapEvaluator → OverlapClassifier → OverlapRecommendationBuilder
```

### Enhanced Pipeline
```
CandidatePairFilter → BehavioralOverlapEvaluator → GateConstraintExtractor → GateImplicationEvaluator
                                ↓                          ↓                         ↓
                          (Part A metrics)           (Part B.1)               (Part B.2)

        → OverlapClassifier → OverlapRecommendationBuilder → GateBandingSuggestionBuilder
               ↓                       ↓                              ↓
         (Part C)                 (Part D.1)                     (Part D.2)
```

---

## Part A: New Metrics (BehavioralOverlapEvaluator Enhancements)

### A1: Pass Rates and Conditional Pass Probabilities

**Computed from existing counters:**
```javascript
passACount = onBothCount + pOnlyCount
passBCount = onBothCount + qOnlyCount
passARate = passACount / N
passBRate = passBCount / N
pA_given_B = passBCount > 0 ? onBothCount / passBCount : NaN
pB_given_A = passACount > 0 ? onBothCount / passACount : NaN
```

**Purpose:** Detect nestedness programmatically. If `pB_given_A ≈ 1`, then A implies B behaviorally.

### A2: Co-Pass Sample Count with Guardrails

**New field:**
```javascript
coPassCount = onBothCount
```

**Guardrail:** If `coPassCount < minCoPassSamples`:
- `pearsonCorrelation = NaN`
- All co-pass intensity metrics = NaN
- Classifier must not attempt MERGE or SUBSUMED based on correlation alone

### A3: Co-Pass Intensity Similarity Metrics

**Existing:**
- `meanAbsDiff` = mean(|IA - IB|) over co-pass samples

**New:**
- `rmse` = sqrt(mean((IA - IB)²)) over co-pass samples
- `pctWithinEps` = P(|IA - IB| <= eps) over co-pass samples

**Config:**
```javascript
intensityEps: 0.05  // default epsilon for near-equal intensity
```

### A4: Expression-Threshold Co-Activation Metrics

**For each threshold t in `highThresholds` (default: [0.4, 0.6, 0.75]):**
```javascript
pHighA(t) = P(IA >= t)  // using gated intensity (0 if gates fail)
pHighB(t) = P(IB >= t)
pHighBoth(t) = P(IA >= t AND IB >= t)
highJaccard(t) = pHighBoth(t) / P(IA >= t OR IB >= t)  // if denom > 0
highAgreement(t) = P((IA >= t) == (IB >= t))
```

**Implementation Note:** Requires computing intensity whenever `passA || passB`, not just when both pass.

---

## Part B: Gate Structure Analysis (New Services)

### B1: GateConstraintExtractor

**File:** `src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js`

**Purpose:** Parse gate strings into per-axis intervals for deterministic nesting analysis.

**Input:** Array of gate strings (e.g., `['arousal >= 0.30', 'threat <= 0.20']`)

**Output:**
```javascript
{
  intervals: Map<string, {
    lower: number,      // default: -Infinity
    upper: number,      // default: +Infinity
    lowerInclusive: boolean,
    upperInclusive: boolean
  }>,
  unparsedGates: string[],
  parseStatus: 'complete' | 'partial' | 'failed'
}
```

**Parsing Rules:**
- Pattern: `<axis> <op> <number>` where op ∈ {>=, >, <=, <}
- Strict inequalities normalized with `strictEpsilon` (default: 1e-6)
- Multiple constraints on same axis are aggregated
- Invalid gate sets (lower > upper) marked as unsatisfiable

### B2: GateImplicationEvaluator

**File:** `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js`

**Purpose:** Determine deterministic nesting via interval subset checking.

**Logic:** A implies B iff for every axis: `A.lower >= B.lower AND A.upper <= B.upper`

**Output:**
```javascript
{
  A_implies_B: boolean,
  B_implies_A: boolean,
  counterExampleAxes: string[],  // axes where implication fails
  evidence: Array<{
    axis: string,
    A: { lower, upper },
    B: { lower, upper },
    relation: 'wider' | 'narrower' | 'disjoint' | 'equal'
  }>
}
```

---

## Part C: New Classification Types

### Classification Enum
```javascript
type ClassificationTypeV2 =
  | 'merge_recommended'
  | 'subsumed_recommended'
  | 'nested_siblings'
  | 'needs_separation'
  | 'keep_distinct'
  | 'convert_to_expression'
```

### C1: Priority Order

Classifications are checked in this order (first match wins):
1. MERGE_RECOMMENDED
2. SUBSUMED_RECOMMENDED
3. CONVERT_TO_EXPRESSION (if enabled)
4. NESTED_SIBLINGS
5. NEEDS_SEPARATION
6. KEEP_DISTINCT (default)

### C2: MERGE_RECOMMENDED

**Requires ALL:**
- `onEitherRate >= minOnEitherRateForMerge` (existing: 0.05)
- `gateOverlapRatio >= strongGateOverlapRatio` (new: 0.80)
- `coPassCount >= minCoPassSamples` (new: 200)
- `pearsonCorrelation >= strongCorrelationForMerge` (lowered to 0.97)
- `meanAbsDiff <= maxMeanAbsDiffForMerge` (existing: 0.03)
- `pctWithinEps >= minPctWithinEpsForMerge` (new: 0.85)

**Optional extra signal:**
- At t=0.6: `highJaccard(t) >= minHighJaccardForMergeAtT['0.6']` (new: 0.75)

**Target:** numbness↔apathy

### C3: SUBSUMED_RECOMMENDED

**Requires:**
- Gate implication OR behavioral conditional indicates nesting:
  - `(A_implies_B AND NOT B_implies_A)` OR
  - `(pB_given_A >= nestedConditionalThreshold AND pA_given_B < 0.995)`
- `coPassCount >= minCoPassSamples`
- `pearsonCorrelation >= minCorrelationForSubsumption` (existing: 0.95)
- Broader prototype has exclusive rate >= `minExclusiveForBroader` (new: 0.01)

### C4: NESTED_SIBLINGS

**Trigger when:**
- Nesting exists (deterministic OR behavioral) but MERGE not satisfied
- Formally: `(A_implies_B XOR B_implies_A) OR (pB_given_A >= threshold XOR pA_given_B >= threshold)` AND NOT MERGE_RECOMMENDED

**Target:** interest↔curiosity, embarrassment↔humiliation, frustration↔confusion, contentment↔relief

### C5: NEEDS_SEPARATION

**Trigger when:**
- `gateOverlapRatio >= 0.70`
- Not nested (no implication either way)
- High correlation but `meanAbsDiff` not tiny (MERGE is wrong)

### C6: KEEP_DISTINCT

**Default when:**
- `gateOverlapRatio < 0.25` OR
- `coPassCount < minCoPassSamples` OR
- Clear behavioral separation

**Target:** freeze↔submission, anxiety↔panic, stress_acute↔fear

### C7: CONVERT_TO_EXPRESSION (Optional)

**Feature-flagged:** `enableConvertToExpression: true`

**Trigger when:**
- Classification is NESTED_SIBLINGS or SUBSUMED_RECOMMENDED
- Name matches `changeEmotionNameHints` OR structural heuristic:
  - Gates enforce low-threat steady state (threat <= 0.20)
  - Weights strongly negative on threat
  - Nested under another low-threat positive state

**Target:** relief (suggest delta gate on threat drop)

---

## Part D: Recommendation Generation

### D1: Enhanced Evidence Payload

```javascript
{
  pearsonCorrelation: number | NaN,
  gateOverlap: {
    onEitherRate: number,
    onBothRate: number,
    pOnlyRate: number,
    qOnlyRate: number,
    gateOverlapRatio: number
  },
  passRates: {
    passARate: number,
    passBRate: number,
    pA_given_B: number | NaN,
    pB_given_A: number | NaN,
    coPassCount: number
  },
  intensitySimilarity: {
    meanAbsDiff: number | NaN,
    rmse: number | NaN,
    pctWithinEps: number | NaN
  },
  highCoactivation: {
    thresholds: Array<{
      t: number,
      pHighA: number,
      pHighB: number,
      pHighBoth: number,
      highJaccard: number,
      highAgreement: number
    }>
  },
  gateImplication: {
    A_implies_B: boolean,
    B_implies_A: boolean,
    evidence: Array<{ axis, A, B, relation }>,
    unparsedGates: string[]
  },
  classification: ClassificationTypeV2,
  recommendations: Array<{
    type: string,
    message: string,
    suggestedActions: string[],
    evidenceRefs: string[]
  }>
}
```

### D2: GateBandingSuggestionBuilder

**File:** `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js`

**Purpose:** Generate gate banding suggestions for NESTED_SIBLINGS and NEEDS_SEPARATION.

**Logic:**
1. Identify axes where one interval is strictly tighter
2. For broader prototype, suggest adding opposite bound with `bandMargin` (default: 0.05)

**Examples:**
- Tighter has `valence <= -0.10` → suggest broader add `valence >= -0.05`
- Tighter has `threat <= 0.20` → suggest broader add `threat >= 0.25`
- Tighter has `arousal >= 0.55` → suggest broader add `arousal <= 0.50`

**Also suggests:** "Expression-level suppression: when higher-tier active, cap lower-tier to 0"

---

## Part E: Required Invariants

### E1: Count Arithmetic
```javascript
onEitherCount == onBothCount + pOnlyCount + qOnlyCount
passACount == onBothCount + pOnlyCount
passBCount == onBothCount + qOnlyCount
rates = counts / N
```

### E2: Probability Bounds
- All rates in [0, 1]
- `gateOverlapRatio` in [0, 1] when `onEitherRate > 0`, else 0
- `pearsonCorrelation` in [-1, 1] or NaN
- `pA_given_B`, `pB_given_A` in [0, 1] or NaN when denom = 0

### E3: Co-Pass Metric Validity
If `coPassCount < minCoPassSamples`:
- `intensitySimilarity` fields = NaN
- Classification cannot be MERGE or SUBSUMED based on intensity/correlation alone

### E4: Gate Parsing Invariants
- For each axis interval: `lower <= upper`, else mark as unsatisfiable
- If any gate unparsed, `parseStatus = 'partial'`, implication falls back to behavioral conditionals

### E5: Determinism for Tests
- BehavioralOverlapEvaluator must support:
  - Injected `contexts[]` for reproducible tests, OR
  - Seeded RNG via config

---

## Configuration

### New Config Properties

Add to `src/expressionDiagnostics/config/prototypeOverlapConfig.js`:

```javascript
{
  // Part A metrics
  minCoPassSamples: 200,
  intensityEps: 0.05,
  minPctWithinEpsForMerge: 0.85,

  // Part B gate analysis
  strictEpsilon: 1e-6,

  // Part C classification thresholds
  nestedConditionalThreshold: 0.97,
  strongGateOverlapRatio: 0.80,
  strongCorrelationForMerge: 0.97,  // lowered from 0.98
  minExclusiveForBroader: 0.01,
  highThresholds: [0.4, 0.6, 0.75],
  minHighJaccardForMergeAtT: { '0.6': 0.75 },

  // Part D features
  changeEmotionNameHints: ['relief', 'surprise_startle', 'release'],
  enableConvertToExpression: true,
  bandMargin: 0.05,
}
```

---

## Implementation Phases

### Phase 1: Configuration and DI Tokens
**Files:**
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js` (modify)
- `src/dependencyInjection/tokens/tokens-diagnostics.js` (modify)

**New tokens:**
- `IGateConstraintExtractor`
- `IGateImplicationEvaluator`
- `IGateBandingSuggestionBuilder`

### Phase 2: BehavioralOverlapEvaluator Enhancements (Part A)
**Files:**
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` (modify)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/behavioralOverlapEvaluator.metrics.test.js` (create)

### Phase 3: Gate Structure Analysis (Part B)
**Files:**
- `src/expressionDiagnostics/services/prototypeOverlap/GateConstraintExtractor.js` (create)
- `src/expressionDiagnostics/services/prototypeOverlap/GateImplicationEvaluator.js` (create)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateConstraintExtractor.test.js` (create)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateImplicationEvaluator.test.js` (create)

### Phase 4: Enhanced Classifications (Part C)
**Files:**
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js` (modify)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/overlapClassifier.v2.test.js` (create)

### Phase 5: Enhanced Recommendations (Part D)
**Files:**
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapRecommendationBuilder.js` (modify)
- `src/expressionDiagnostics/services/prototypeOverlap/GateBandingSuggestionBuilder.js` (create)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/gateBandingSuggestionBuilder.test.js` (create)

### Phase 6: Orchestrator Integration
**Files:**
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js` (modify)
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js` (modify)

### Phase 7: Integration Tests
**Files:**
- `tests/integration/expressionDiagnostics/prototypeOverlap/mergeRecommended.integration.test.js` (create)
- `tests/integration/expressionDiagnostics/prototypeOverlap/nestedSiblings.integration.test.js` (create)
- `tests/integration/expressionDiagnostics/prototypeOverlap/keepDistinct.integration.test.js` (create)
- `tests/integration/expressionDiagnostics/prototypeOverlap/convertToExpression.integration.test.js` (create)
- `tests/unit/expressionDiagnostics/services/prototypeOverlap/outputShape.snapshot.test.js` (create)

---

## Test Plan (Part F)

### F1: Unit Tests - GateConstraintExtractor
**Cases:**
- Parses simple bounds: `"threat <= 0.20"` → upper=0.20
- Combines bounds: `["arousal >= -0.30", "arousal <= 0.35"]` → interval [-0.30, 0.35]
- Handles strict inequality: `"valence > 0.10"` → lower=0.10+eps
- Captures unparsed gates: `"weird gate"` → unparsedGates, parseStatus='partial'

### F2: Unit Tests - GateImplicationEvaluator
**Using actual prototype definitions:**
- frustration gates vs confusion gates → frustration_implies_confusion = true
- contentment gates vs relief gates → contentment_implies_relief = true
- humiliation gates vs embarrassment gates → humiliation_implies_embarrassment = true

### F3: Unit Tests - BehavioralOverlapEvaluator Metrics
**With injected deterministic contexts (10 samples):**
- 4 pass both, 3 pass A only, 2 pass B only, 1 neither
- Assert: count/rate invariants, conditional probabilities, gateOverlapRatio, coPassCount
- Test pctWithinEps with identical intensities in co-pass contexts

### F4: Integration Tests - Classification
**MERGE_RECOMMENDED (numbness vs apathy):**
- Create contexts satisfying both gates frequently
- Assert: classification = 'merge_recommended', evidence fields non-NaN

**NESTED_SIBLINGS (interest vs curiosity):**
- Create contexts where curiosity sometimes fails while interest passes
- Assert: curiosity implies interest, classification = 'nested_siblings'

**KEEP_DISTINCT (freeze vs submission):**
- Construct mostly disjoint gate regions
- Assert: low gateOverlapRatio, classification = 'keep_distinct'

**CONVERT_TO_EXPRESSION (contentment vs relief):**
- With `enableConvertToExpression=true` and 'relief' in hints
- Assert: recommendations include CONVERT_TO_EXPRESSION with delta-axis hint

### F5: Snapshot Tests
- Snapshot full result object for output shape stability

---

## Expected Outcomes

After implementation, the analyzer should produce these results without hardcoding:

| Pair | Expected Classification | Evidence |
|------|-------------------------|----------|
| numbness ↔ apathy | MERGE_RECOMMENDED | High overlap + high similarity + low meanAbsDiff |
| interest ↔ curiosity | NESTED_SIBLINGS | Curiosity implies interest; recommend hierarchy/banding |
| embarrassment ↔ humiliation | NESTED_SIBLINGS | Humiliation implies embarrassment; recommend banding |
| frustration ↔ confusion | NESTED_SIBLINGS | Frustration implies confusion; recommend separation |
| contentment ↔ relief | NESTED_SIBLINGS + CONVERT_TO_EXPRESSION | Nested + low-threat pattern |
| freeze ↔ submission | KEEP_DISTINCT | Tiny overlap |
| anxiety ↔ panic | KEEP_DISTINCT | Clear behavioral separation |
| stress_acute ↔ fear | KEEP_DISTINCT | Different gate regions |

---

## Verification

### Manual Testing
1. Run prototype analysis on full emotion prototype set
2. Verify classifications match expected outcomes table
3. Check recommendations are actionable and include gate banding suggestions

### Automated Testing
```bash
npm run test:unit -- --testPathPattern=prototypeOverlap
npm run test:integration -- --testPathPattern=prototypeOverlap
```

### Lint and Typecheck
```bash
npx eslint src/expressionDiagnostics/services/prototypeOverlap/
npm run typecheck
```
