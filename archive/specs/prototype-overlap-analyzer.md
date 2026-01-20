# Prototype Overlap Analyzer

## Goal

Add an analysis page accessible from the "Emotions" section of `index.html` that programmatically determines whether existing emotion prototypes (defined in `data/mods/core/lookups/emotion_prototypes.lookup.json`) overlap in ways that suggest consolidation or removal.

The analyzer must provide:
- "Prototype A and Prototype B are effectively duplicates; merge/alias one."
- "Prototype A is mostly a subset of Prototype B; remove or tighten one."
- "These prototypes look structurally similar, but are not redundant (keep both)."
- (Optional) "This cluster of 3+ prototypes crowds the same region; consider consolidation."

Results must be **deterministic**, **explainable**, and **grounded in actual prototype behavior**, not just sign patterns.

## Motivation

Two prototypes can share the same sign pattern and still be meaningfully different because of:
- **Weight magnitudes** (one is "mostly engagement", another is "engagement + agency_control hard")
- **Gates** (they carve different regions of state space)
- **Axis mix** (one uses threat as a brake, another uses it as a driver)
- **Output shaping** (rectification/normalization after the dot product)

What we need is a **functional overlap metric**: "Do these two prototypes behave the same across the contexts the engine actually produces?"

## Current Implementation (Reference)

### Prototype Definition Structure

**Location**: `data/mods/core/lookups/emotion_prototypes.lookup.json`

```json
{
  "emotion_name": {
    "weights": {
      "axis_name": number  // Range: [-1.0, 1.0]
    },
    "gates": [
      "axis_name >= threshold",  // e.g., "valence >= 0.20"
      "axis_name <= threshold"   // e.g., "threat <= 0.20"
    ]
  }
}
```

**Available Axes** (15 defined in schema):
- Mood: `valence`, `arousal`, `agency_control`, `threat`, `engagement`, `future_expectancy`, `self_evaluation`
- Sexual: `sexual_arousal`, `sex_excitation`, `sex_inhibition`, `sexual_inhibition`
- Traits: `affective_empathy`, `cognitive_empathy`, `affiliation`, `harm_aversion`

### Key Existing Services (Reusable)

| Service | Location | Purpose |
|---------|----------|---------|
| `PrototypeRegistryService` | `src/expressionDiagnostics/services/PrototypeRegistryService.js` | Get all prototypes by type (`emotion` or `sexual`) |
| `PrototypeIntensityCalculator` | `src/expressionDiagnostics/services/PrototypeIntensityCalculator.js` | Compute intensity from weights and check gates |
| `PrototypeSimilarityMetrics` | `src/expressionDiagnostics/services/PrototypeSimilarityMetrics.js` | Cosine similarity, weight distance, combined distance |
| `PrototypeGateChecker` | `src/expressionDiagnostics/services/PrototypeGateChecker.js` | Parse and evaluate gate constraints |
| `RandomStateGenerator` | `src/expressionDiagnostics/services/simulatorCore/RandomStateGenerator.js` | Generate random contexts (uniform/gaussian) |
| `ContextBuilder` | `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js` | Build normalized evaluation contexts |
| `GateConstraint` | `src/expressionDiagnostics/models/GateConstraint.js` | Parse gate strings like `"valence >= 0.35"` |

### Prototype Intensity Formula (Production)

```javascript
// 1. Weighted sum
let rawSum = 0, sumAbsWeights = 0;
for (const [axis, weight] of Object.entries(prototype.weights)) {
  rawSum += weight * normalizedAxisValue;
  sumAbsWeights += Math.abs(weight);
}

// 2. Average by absolute weights
const rawScore = sumAbsWeights === 0 ? 0 : rawSum / sumAbsWeights;

// 3. Clamp to [0,1]
const intensity = Math.max(0, Math.min(1, rawScore));

// 4. Apply gates (all must pass)
const finalValue = allGatesPass ? intensity : 0;
```

This formula is implemented in `PrototypeIntensityCalculator.computeIntensity()` and **MUST** be the single source of truth for the analyzer.

## Algorithm Overview (Two-Stage)

### Stage A: Candidate Pair Discovery (Cheap Filter)

**Purpose**: Avoid expensive evaluation on every pair (O(n²) comparisons).

For each prototype:
1. **Build dense weight vector** over canonical axis order (missing = 0)
2. **Compute active axes**: `|weight| >= config.activeAxisEpsilon` (default 0.08)
3. **Record sign pattern** for active axes (+ or -)

For each pair (p, q) in the same family (emotion with emotion):

**Compute metrics**:
- `activeAxisOverlap`: Jaccard overlap of active axis sets
- `signAgreement`: Fraction of shared active axes with same sign
- `weightCosineSimilarity`: Cosine similarity of dense weight vectors

**Candidate rule** (defaults; configurable):
- `activeAxisOverlap >= 0.60`
- `signAgreement >= 0.80`
- `weightCosineSimilarity >= 0.85`

Only candidate pairs proceed to Stage B.

### Stage B: Functional Overlap Scoring (Behavioral Proof)

For each candidate pair (p, q), estimate overlap by sampling contexts and evaluating intensities.

#### Context Sampling Populations

| Population | Description | Priority |
|------------|-------------|----------|
| `global_uniform` | Uniform random sampling across all axes | **Required** |
| `mood_regime` | Contexts satisfying AND-only mood constraints | Optional (future) |
| `empirical_logged` | Contexts from actual gameplay logs | Optional (future) |

**Sampling (global_uniform)**:
- Mood axes: Sample in range evaluator expects (normalized [-1, 1] or raw [-100, 100])
- Traits: Sample in valid range [0, 1] or [0, 100]
- Sexual axes: Sample in valid range [0, 1]

**Critical**: Use existing `RandomStateGenerator` with appropriate distribution. The analyzer **MUST NOT** invent its own normalization.

#### Per-Sample Evaluation

```javascript
for (const context of sampledContexts) {
  const fp = evaluatePrototype(p, context);  // Intensity or 0 if gates fail
  const fq = evaluatePrototype(q, context);

  const onP = fp > 0;
  const onQ = fq > 0;

  // Accumulate stats...
}
```

#### Gate Overlap Stats (Behavioral)

| Metric | Definition |
|--------|------------|
| `onEitherRate` | % where `onP OR onQ` |
| `onBothRate` | % where `onP AND onQ` |
| `pOnlyRate` | % where `onP AND NOT onQ` |
| `qOnlyRate` | % where `onQ AND NOT onP` |

These estimate gate/regime overlap in practice without parsing gates separately.

#### Intensity Similarity Stats

Conditioning set: `onEither` (contexts where at least one prototype activates)

| Metric | Definition |
|--------|------------|
| `pearsonCorrelation` | Correlation between `fp` and `fq` |
| `meanAbsDiff` | Average `|fp - fq|` |
| `dominanceP` | Fraction where `fp >= fq + dominanceDelta` |
| `dominanceQ` | Fraction where `fq >= fp + dominanceDelta` |

**Divergence Examples**: Keep top K contexts by `|fp - fq|` for evidence.

### Final Pair Classification

#### Class: MERGE (Near-Duplicate)

Emit `prototype_merge_suggestion` when **ALL** are true:
- `onEitherRate >= minOnEitherRateForMerge` (default 0.05) — prevents declaring redundancy on dead prototypes
- `onBothRate / onEitherRate >= minGateOverlapRatio` (default 0.90)
- `pearsonCorrelation >= minCorrelationForMerge` (default 0.98)
- `meanAbsDiff <= maxMeanAbsDiffForMerge` (default 0.03)
- Neither dominance is overwhelming: `dominanceP < 0.95 AND dominanceQ < 0.95`

**Action Suggestions**:
- Keep prototype with higher downstream usage count (if computable)
- Else keep one with fewer/cleaner gates
- Else keep one with fewer active axes

#### Class: SUBSUMED (One Is Subset)

Emit `prototype_subsumption_suggestion` when:
- One-sided exclusivity is tiny: `pOnlyRate <= 0.01` OR `qOnlyRate <= 0.01`
- Correlation is high in overlap: `pearsonCorrelation >= 0.95`
- Dominance indicates one typically wins: `dominanceP >= 0.95 OR dominanceQ >= 0.95`

**Action Suggestions**:
- Remove/alias the subsumed prototype
- OR tighten its gates to activate in a distinct region

#### Class: NOT REDUNDANT

If candidate filter matched but merge/subsumption criteria fail:
- Do NOT emit merge/subsumption
- Optionally emit `prototype_overlap_info` with evidence (gate separation or intensity divergence)

## Recommendation Payload Schema

```typescript
interface PrototypeOverlapRecommendation {
  type: 'prototype_merge_suggestion' | 'prototype_subsumption_suggestion' | 'prototype_overlap_info';
  prototypeFamily: 'emotion' | 'sexual';
  prototypes: { a: string; b: string };
  severity: number;      // 0-1, higher = more urgent
  confidence: number;    // 0-1, derived from sample size + metric strength
  actions: string[];     // Concrete action suggestions

  candidateMetrics: {
    activeAxisOverlap: number;
    signAgreement: number;
    weightCosineSimilarity: number;
  };

  behaviorMetrics: {
    onEitherRate: number;
    onBothRate: number;
    pOnlyRate: number;
    qOnlyRate: number;
    pearsonCorrelation: number;
    meanAbsDiff: number;
    dominanceP: number;
    dominanceQ: number;
  };

  evidence: {
    sharedDrivers: Array<{ axis: string; weightA: number; weightB: number }>;
    keyDifferentiators: Array<{ axis: string; reason: string }>;
    gateDiffSummary?: string;
    divergenceExamples: Array<{
      context: Record<string, number>;
      intensityA: number;
      intensityB: number;
      absDiff: number;
    }>;
  };
}
```

### Severity Scoring

**For MERGE**:
- Increases with correlation and gate overlap ratio
- Decreases with meanAbsDiff

**For SUBSUMED**:
- Increases with dominance and one-sided exclusivity

Formula: Weighted average of normalized metrics; must be deterministic, monotonic, in [0, 1].

## Configuration Defaults

Create `src/expressionDiagnostics/config/prototypeOverlapConfig.js`:

```javascript
export const PROTOTYPE_OVERLAP_CONFIG = {
  // Stage A: Candidate filtering
  activeAxisEpsilon: 0.08,
  candidateMinActiveAxisOverlap: 0.60,
  candidateMinSignAgreement: 0.80,
  candidateMinCosineSimilarity: 0.85,

  // Stage B: Behavioral sampling
  sampleCountPerPair: 8000,
  divergenceExamplesK: 5,
  dominanceDelta: 0.05,

  // Classification thresholds
  minOnEitherRateForMerge: 0.05,
  minGateOverlapRatio: 0.90,
  minCorrelationForMerge: 0.98,
  maxMeanAbsDiffForMerge: 0.03,
  maxExclusiveRateForSubsumption: 0.01,
  minCorrelationForSubsumption: 0.95,
  minDominanceForSubsumption: 0.95,

  // Safety limits
  maxCandidatePairs: 5000,
  maxSamplesTotal: 1000000,
};
```

## Invariants (Must Always Hold)

### Determinism
- Same seed + same prototype set + same config → identical recommendations
- Different seed → slight metric variation but stable classification for strong overlaps

### Symmetry
- Candidate metrics must be symmetric (overlap, cosine, sign agreement)
- Behavioral metrics symmetric except `dominanceP/Q` and `pOnly/qOnly`
- If (A, B) reported, do NOT separately report (B, A)

### Metric Validity
- All rates in [0, 1]
- Correlation in [-1, 1]
- `meanAbsDiff >= 0`
- `confidence` and `severity` in [0, 1]

### No "Merge" on Dead Prototypes
- Must not emit merge/subsumption if `onEitherRate < minOnEitherRateForMerge`

### Evidence Correctness
- `absDiff === |intensityA - intensityB|` for all divergence examples
- Context fields within valid axis ranges
- Intensities match evaluator output for that context

### Performance Safety
- Hard cap on candidate pairs processed
- Hard cap on samples per pair
- Must not block report generation as prototype count grows

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Create New HTML Page

**File**: `prototype-analysis.html`

```html
<!-- Similar structure to expression-diagnostics.html -->
<div class="diagnostics-container">
  <header class="diagnostics-header">
    <h1>Prototype Overlap Analysis</h1>
    <button id="back-button">Back to Menu</button>
  </header>

  <main class="diagnostics-main">
    <section class="panel controls-panel">
      <h2>Analysis Controls</h2>
      <div class="control-group">
        <label for="prototype-family">Prototype Family:</label>
        <select id="prototype-family">
          <option value="emotion" selected>Emotions</option>
          <option value="sexual">Sexual States</option>
        </select>
      </div>
      <div class="control-group">
        <label for="sample-count">Samples per Pair:</label>
        <select id="sample-count">
          <option value="2000">2,000 (Fast)</option>
          <option value="8000" selected>8,000 (Standard)</option>
          <option value="20000">20,000 (Precise)</option>
        </select>
      </div>
      <button id="run-analysis-btn" class="action-button">Run Analysis</button>
    </section>

    <section class="panel progress-panel" hidden>
      <h2>Analysis Progress</h2>
      <div id="progress-container">
        <div class="progress-bar"></div>
        <span class="progress-label">0%</span>
      </div>
      <p id="progress-status">Preparing...</p>
    </section>

    <section class="panel results-panel" hidden>
      <h2>Overlap Recommendations</h2>
      <div id="recommendations-container"></div>
    </section>
  </main>
</div>
```

#### 1.2 Add Navigation Link

**File**: `index.html` (Emotions section)

Add link: "Prototype Overlap Analysis" → `prototype-analysis.html`

#### 1.3 Create Entry Point

**File**: `src/prototype-analysis-main.js`

Similar to `src/expression-diagnostics-main.js`:
- Initialize DI container
- Resolve controller
- Call `initialize()`

#### 1.4 Update Build Configuration

**File**: `esbuild.config.js`

Add entry point for `prototype-analysis.js` bundle.

### Phase 2: Core Services

#### 2.1 PrototypeOverlapConfig

**File**: `src/expressionDiagnostics/config/prototypeOverlapConfig.js`

Exports `PROTOTYPE_OVERLAP_CONFIG` as defined above.

#### 2.2 CandidatePairFilter

**File**: `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`

```javascript
class CandidatePairFilter {
  constructor({ prototypeRegistryService, config, logger }) { }

  // Returns candidate pairs that pass Stage A thresholds
  filterCandidates(prototypes: Prototype[]): CandidatePair[]

  // Internal methods
  #buildDenseWeightVector(prototype): Map<string, number>
  #computeActiveAxes(weights): Set<string>
  #computeSignPattern(weights, activeAxes): Map<string, '+' | '-'>
  #computeActiveAxisOverlap(axesA, axesB): number  // Jaccard
  #computeSignAgreement(signA, signB, sharedAxes): number
  #computeCosineSimilarity(vecA, vecB): number
}
```

#### 2.3 BehavioralOverlapEvaluator

**File**: `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`

```javascript
class BehavioralOverlapEvaluator {
  constructor({
    prototypeIntensityCalculator,
    randomStateGenerator,
    contextBuilder,
    config,
    logger
  }) { }

  // Evaluates behavioral overlap for a candidate pair
  evaluate(prototypeA, prototypeB, sampleCount, onProgress?): BehaviorMetrics

  // Internal methods
  #sampleContext(distribution): Context
  #evaluatePrototype(prototype, context): number  // Uses PrototypeIntensityCalculator
  #computeGateOverlapStats(evaluations): GateOverlapStats
  #computeIntensitySimilarityStats(evaluations): IntensitySimilarityStats
  #selectDivergenceExamples(evaluations, k): DivergenceExample[]
}
```

#### 2.4 OverlapClassifier

**File**: `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`

```javascript
class OverlapClassifier {
  constructor({ config, logger }) { }

  // Classifies a candidate pair based on metrics
  classify(candidateMetrics, behaviorMetrics): Classification

  // Returns: { type: 'merge' | 'subsumed' | 'not_redundant' | 'info', ... }
}
```

#### 2.5 RecommendationBuilder

**File**: `src/expressionDiagnostics/services/prototypeOverlap/RecommendationBuilder.js`

```javascript
class RecommendationBuilder {
  constructor({ config, logger }) { }

  // Builds recommendation payload from classification + metrics
  build(prototypeA, prototypeB, classification, metrics, evidence): Recommendation

  #computeSeverity(classification, metrics): number
  #computeConfidence(sampleCount, metrics): number
  #generateActions(classification, prototypeA, prototypeB): string[]
  #extractSharedDrivers(prototypeA, prototypeB): SharedDriver[]
  #extractKeyDifferentiators(prototypeA, prototypeB): Differentiator[]
}
```

#### 2.6 PrototypeOverlapAnalyzer (Orchestrator)

**File**: `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`

```javascript
class PrototypeOverlapAnalyzer {
  constructor({
    prototypeRegistryService,
    candidatePairFilter,
    behavioralOverlapEvaluator,
    overlapClassifier,
    recommendationBuilder,
    config,
    logger
  }) { }

  // Main entry point
  async analyze(options: AnalysisOptions): AnalysisResult {
    // 1. Get all prototypes of specified family
    // 2. Run Stage A: filter to candidate pairs
    // 3. For each candidate pair (with progress):
    //    a. Run Stage B: behavioral evaluation
    //    b. Classify
    //    c. Build recommendation if applicable
    // 4. Return sorted recommendations + metadata
  }
}
```

### Phase 3: UI Controller

#### 3.1 PrototypeAnalysisController

**File**: `src/domUI/prototype-analysis/PrototypeAnalysisController.js`

```javascript
class PrototypeAnalysisController {
  constructor({ prototypeOverlapAnalyzer, logger }) { }

  initialize(): void
  #bindEventListeners(): void
  #runAnalysis(): Promise<void>
  #renderResults(result: AnalysisResult): void
  #renderRecommendation(rec: Recommendation): HTMLElement
  #updateProgress(completed, total, status): void
}
```

### Phase 4: DI Registration

**File**: `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`

Register all new services with appropriate tokens.

**File**: `src/dependencyInjection/tokens/tokens-diagnostics.js`

Add tokens:
- `ICandidatePairFilter`
- `IBehavioralOverlapEvaluator`
- `IOverlapClassifier`
- `IRecommendationBuilder`
- `IPrototypeOverlapAnalyzer`
- `IPrototypeAnalysisController`

## Test Requirements

### Unit Tests: Candidate Stage

1. **Active axis extraction**: Verify axes below epsilon excluded; boundary behavior deterministic
2. **Sign agreement**: Only counts shared active axes; handles no shared axes (not candidate)
3. **Cosine similarity**: Identical → ~1, orthogonal → ~0, opposite → ~-1
4. **Candidate gating**: Pairs below thresholds not forwarded

### Unit Tests: Behavioral Stage (Stub Evaluator)

5. **Gate overlap stats**: Identical gates → `onBothRate == onEitherRate`; disjoint → `onBothRate == 0`
6. **Similarity metrics**: Identical prototypes → correlation ~1, meanAbsDiff ~0
7. **Dominance**: Always-larger prototype → dominance ~1
8. **Divergence examples**: Top K by abs difference; stable with same seed

### Unit Tests: Classification

9. **Merge classification**: Near-identical behavior → `prototype_merge_suggestion`
10. **Subsumption classification**: Behavioral subset + dominance → `prototype_subsumption_suggestion`
11. **Not redundant**: Similar weights but different gates → no merge/subsumption

### Determinism Tests

12. **Same seed deterministic**: Run twice → deep-equal output
13. **Different seed stability**: Strong duplicate pair → still classified "merge" (tolerance)

### Integration Tests

14. **Full pipeline**: Load real prototypes → analyze → verify recommendations sensible
15. **Performance**: 100 prototypes with 8000 samples per pair completes in reasonable time

## Files to Create/Modify

### New Files
- `prototype-analysis.html` - Analysis page HTML
- `css/prototype-analysis.css` - Page-specific styles
- `src/prototype-analysis-main.js` - Entry point
- `src/expressionDiagnostics/config/prototypeOverlapConfig.js` - Configuration
- `src/expressionDiagnostics/services/prototypeOverlap/CandidatePairFilter.js`
- `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js`
- `src/expressionDiagnostics/services/prototypeOverlap/OverlapClassifier.js`
- `src/expressionDiagnostics/services/prototypeOverlap/RecommendationBuilder.js`
- `src/expressionDiagnostics/services/PrototypeOverlapAnalyzer.js`
- `src/domUI/prototype-analysis/PrototypeAnalysisController.js`
- `src/dependencyInjection/registrations/prototypeOverlapRegistrations.js`
- Test files in `tests/unit/expressionDiagnostics/services/prototypeOverlap/`

### Modified Files
- `index.html` - Add navigation link in Emotions section
- `esbuild.config.js` - Add entry point
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Add new tokens

## Verification

### Manual Testing
1. Navigate to prototype analysis page from index
2. Run analysis with default settings
3. Verify progress indicator updates smoothly
4. Verify recommendations display with all required fields
5. Verify determinism: re-run produces identical results

### Automated Testing
```bash
npm run test:unit -- --grep "prototypeOverlap"
npm run test:integration -- --grep "PrototypeOverlapAnalyzer"
```

## Implementation Notes

1. **Do not parse gates if you don't need to.** Infer gate overlap behaviorally using evaluator outputs (on/off), which automatically respects gates and hidden normalization logic.

2. **Use the real evaluator.** `PrototypeIntensityCalculator.computeIntensity()` must be the single source of truth. If overlap detection uses a different interpretation than production, results will be misleading.

3. **Make population support extensible.** Even if only `global_uniform` is implemented initially, structure code to add `mood_regime` and `empirical_logged` later without rewriting core logic.

4. **Reuse existing services.** `PrototypeSimilarityMetrics` already has cosine similarity and weight distance. `RandomStateGenerator` and `ContextBuilder` handle sampling. Don't duplicate this logic.
