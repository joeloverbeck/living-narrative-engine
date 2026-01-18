# Monte Carlo Actionability Improvements

## Goal

Transform Monte Carlo simulation reports from diagnostic tools into actionable guides that directly answer: **"What specific changes will move my trigger rate into the target range?"** This specification introduces five key improvements that convert statistical observations into concrete, prioritized recommendations with validation.

## Motivation

Current Monte Carlo reports provide extensive statistics but require users to mentally synthesize insights into actionable changes. Content creators face these challenges:

1. **Information Overload**: Reports show 19+ clause statistics when only 1-3 actually matter
2. **Missing Threshold Guidance**: No automatic suggestions for threshold values that achieve target pass rates
3. **Dead Ends at Zero Triggers**: When expressions never trigger, reports offer no path forward
4. **OR Block Opacity**: Statistics show coverage percentages but don't recommend restructuring actions
5. **No Rarity Targeting**: Users want to hit specific trigger rate bands but have no guidance on which edits achieve them

The brainstorming document (`brainstorming/monte-carlo-improvements.md`) identified five concrete improvements:
- A. Minimal blocker set ("unsat core" / dominant core)
- B. Threshold suggestions from in-regime quantiles
- C. Constructive witness search when zero triggers
- D. OR block restructure recommendations
- E. Recommended edit set targeting rarity bands

This specification provides the detailed design for implementing all five.

## Scope Boundaries

### In Scope (This Specification)

| Improvement | Description |
|-------------|-------------|
| **A. Minimal Blocker Set** | Algorithmic identification of 1-3 dominant blockers from many clauses |
| **C. Constructive Witness Search** | Optimization search to find nearest-feasible state when zero triggers |
| **D. OR Block Restructure Recommendations** | Dead alternative detection with specific restructuring advice |
| **E. Recommended Edit Set** | Concrete patch proposals targeting rarity bands with importance sampling validation |

### Partially Covered (Extension of Existing Work)

| Improvement | Existing Coverage | This Spec Adds |
|-------------|-------------------|----------------|
| **B. Threshold Suggestions** | `monte-carlo-report-clarity-improvements.md` covers zero-hit quantile tables | Extend to non-zero-hit cases; integrate into Edit Set generation |

### Out of Scope (Covered by Existing Specs)

- Per-clause violation percentiles (see `monte-carlo-advanced-metrics.md`)
- Near-miss rate tracking (see `monte-carlo-advanced-metrics.md`)
- Last-mile blocker rate (see `monte-carlo-advanced-metrics.md`)
- Max observed value tracking (see `monte-carlo-advanced-metrics.md`)
- Three-tier classification system (see `monte-carlo-report-clarity-improvements.md`)
- Plain-English axis conflict explanations (see `monte-carlo-report-clarity-improvements.md`)
- Zero-hit sensitivity table replacement (see `monte-carlo-report-clarity-improvements.md`)
- Percent-change display fixes (see `monte-carlo-report-clarity-improvements.md`)

### Dependencies

This specification **requires** implementation of:
- `monte-carlo-advanced-metrics.md` (provides quantile tracking, last-mile rate)
- `monte-carlo-report-clarity-improvements.md` (provides classification system, quantile display infrastructure)

---

## Current Implementation (Reference)

### Key Files

| File | Purpose | LOC |
|------|---------|-----|
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Core simulation engine | ~1360 |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Report orchestration | ~1400 |
| `src/expressionDiagnostics/models/HierarchicalClauseNode.js` | Per-clause tracking tree | ~1500 |
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Recommendation generation | ~800 |
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | Failure tree rendering | ~1600 |
| `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` | Sensitivity table formatting | ~600 |

### Current Recommendation Flow

```
SimulationResult
    ↓
RecommendationFactsBuilder → DiagnosticFacts
    ↓
RecommendationEngine → Recommendations[]
    ↓
BlockerSectionGenerator → Report Markdown
```

Current recommendations are generic ("Lower threshold X") without quantitative guidance on specific values or predicted outcomes.

### Current Clause Tracking (HierarchicalClauseNode)

```javascript
{
  description: string,
  failureCount: number,
  evaluationCount: number,
  inRegimeFailureCount: number,
  inRegimeEvaluationCount: number,
  violationSum: number,
  violationValues: number[],  // For percentiles (from advanced-metrics spec)
  maxObservedValue: number,
  nearMissCount: number,
  lastMileFailCount: number,   // From advanced-metrics spec
  othersPassedCount: number,   // From advanced-metrics spec
  children: HierarchicalClauseNode[]
}
```

---

## Proposed Changes

### A. Minimal Blocker Set (Dominant Core)

#### Purpose

For expressions with many clauses (often 10-20+), identify the **1-3 clauses that actually determine failure rate**. Distinguish "Core blockers" (tune these first) from "Non-core constraints" (already passing, don't worry about).

#### Key Insight from Brainstorming

> "For AND-heavy expressions, consumers don't want 19 lines—they want the 1–3 clauses that actually matter."
>
> Example output: `Core blockers: confusion>=0.62, OR1 (anxiety/stress_acute)`

#### Algorithm

**Dominant Core Identification**:

1. **Collect Metrics** for each clause:
   - `lastMileFailRate`: Failure rate when ALL other clauses pass (from `advanced-metrics` spec)
   - `impactScore`: Estimated Δ trigger rate if this clause were removed (ablation impact)
   - `inRegimePassRate`: Pass rate within mood regime

2. **Compute Composite Score**:
   ```
   compositeScore = (impactWeight × impactScore) + (lastMileWeight × lastMileRate)
   ```
   Default weights: `impactWeight = 0.6`, `lastMileWeight = 0.4`

3. **Classify Clauses**:
   - **Core Blocker**: Top K clauses by composite score (K ∈ {1, 2, 3})
   - **Non-Core Constraint**: Clauses with `inRegimePassRate >= 0.95`

4. **Select Core Count**:
   - Start with K=1
   - Add clause to core if it explains ≥15% of remaining failures
   - Stop at K=3 or when marginal explanatory power < 5%

#### Output Format

```markdown
## Core Blockers (Tune These First)

| Rank | Clause | Last-Mile | Impact | Action |
|------|--------|-----------|--------|--------|
| 1 | emotions.confusion >= 0.62 | 82.1% | 47.2% | Lower threshold |
| 2 | OR Block #1 (anxiety/stress) | 34.5% | 28.1% | See OR analysis |

## Non-Core Constraints (Already ~96-100% Pass)

- absorption caps (98.2% pass)
- panic/freeze/rage caps (99.1% pass)
- engagement threshold (96.4% pass)

*These constraints are not blocking triggers. Focus on core blockers above.*
```

#### New Service: `MinimalBlockerSetCalculator`

```javascript
// src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js

class MinimalBlockerSetCalculator {
  #config;
  #logger;

  constructor({ logger, config }) {
    this.#logger = logger;
    this.#config = config;
  }

  /**
   * Identifies the dominant blockers from clause data
   * @param {HierarchicalClauseNode[]} clauses - All clauses with tracking data
   * @param {SimulationResult} simulationResult - Full simulation result
   * @returns {DominantCoreResult}
   */
  calculate(clauses, simulationResult) {
    const scored = this.#scoreAllClauses(clauses, simulationResult);
    const ranked = this.#rankByCompositeScore(scored);
    const core = this.#selectCoreBlockers(ranked);
    const nonCore = this.#classifyNonCore(ranked, core);

    return {
      coreBlockers: core,
      nonCoreConstraints: nonCore,
      compositeScores: new Map(scored.map(s => [s.clauseId, s.compositeScore]))
    };
  }

  #scoreAllClauses(clauses, result) {
    return clauses.map(clause => ({
      clauseId: clause.id,
      clauseDescription: clause.description,
      lastMileRate: clause.lastMileFailRate ?? 0,
      impactScore: this.#estimateImpact(clause, result),
      inRegimePassRate: clause.inRegimePassRate,
      compositeScore: this.#computeComposite(clause, result)
    }));
  }

  #computeComposite(clause, result) {
    const { impactWeight, lastMileWeight } = this.#config;
    const impact = this.#estimateImpact(clause, result);
    const lastMile = clause.lastMileFailRate ?? 0;
    return (impactWeight * impact) + (lastMileWeight * lastMile);
  }

  #selectCoreBlockers(ranked) {
    const core = [];
    let remainingFailures = 1.0;

    for (const clause of ranked) {
      if (core.length >= this.#config.maxCoreBlockers) break;

      const marginalExplanation = clause.impactScore / remainingFailures;
      if (core.length > 0 && marginalExplanation < this.#config.minMarginalExplanation) break;

      core.push({ ...clause, classification: 'core' });
      remainingFailures -= clause.impactScore;
    }

    return core;
  }

  #classifyNonCore(ranked, core) {
    const coreIds = new Set(core.map(c => c.clauseId));
    return ranked
      .filter(c => !coreIds.has(c.clauseId))
      .filter(c => c.inRegimePassRate >= this.#config.nonCorePassRateThreshold)
      .map(c => ({ ...c, classification: 'non-core' }));
  }
}
```

---

### B. Threshold Suggestions from In-Regime Quantiles

#### Purpose

For any `>=` or `>` clause, auto-generate threshold suggestions based on observed quantile distributions:

```
If you want ~5% pass rate → set threshold ≤ P95 (0.41)
If you want ~10% pass rate → set threshold ≤ P90 (0.34)
Absolute ceiling: max observed = 0.608 (anything above is dead)
```

#### Extension to Non-Zero-Hit Cases

The `monte-carlo-report-clarity-improvements.md` spec covers threshold suggestions for zero-hit cases. This specification extends that to **all cases** where clause quantiles are available.

#### Output Format

```markdown
### Threshold Suggestions for `emotions.confusion >= 0.62`

| Target Pass Rate | Suggested Threshold | Current | Delta |
|------------------|---------------------|---------|-------|
| 1% | ≤ 0.598 (P99) | 0.620 | -0.022 |
| 5% | ≤ 0.558 (P95) | 0.620 | -0.062 |
| 10% | ≤ 0.512 (P90) | 0.620 | -0.108 |

**Absolute ceiling**: max observed = 0.608
*Threshold > 0.608 will never pass in current regime.*
```

#### Integration Point

Modify `SensitivitySectionGenerator` to include threshold suggestion table for all clauses (not just zero-hit cases):

```javascript
// In SensitivitySectionGenerator.js

#formatThresholdSuggestions(clause, config) {
  if (!clause.quantiles) return '';

  const { targetPassRates } = config;
  const rows = targetPassRates.map(rate => {
    const quantile = this.#getQuantileForRate(clause.quantiles, rate);
    const delta = quantile - clause.threshold;
    return `| ${(rate * 100).toFixed(0)}% | ≤ ${quantile.toFixed(3)} (P${100-rate*100}) | ${clause.threshold.toFixed(3)} | ${delta >= 0 ? '+' : ''}${delta.toFixed(3)} |`;
  });

  return [
    `### Threshold Suggestions for \`${clause.description}\``,
    '',
    '| Target Pass Rate | Suggested Threshold | Current | Delta |',
    '|------------------|---------------------|---------|-------|',
    ...rows,
    '',
    `**Absolute ceiling**: max observed = ${clause.maxObserved.toFixed(3)}`,
    clause.maxObserved < clause.threshold
      ? `*Threshold > ${clause.maxObserved.toFixed(3)} will never pass in current regime.*`
      : ''
  ].filter(Boolean).join('\n');
}
```

---

### C. Constructive Witness Search

#### Purpose

When simulation finds **zero triggers**, perform an optimization search to find:
1. The state that comes **closest** to triggering
2. Which clauses it **still violates** and by how much
3. The **smallest threshold adjustments** to make it a witness

This converts "0 triggers" from a dead end into actionable guidance.

#### Key Insight from Brainstorming

> "This is the single biggest improvement you can make for both humans and LLMs."
>
> Turn "0 triggers" into: "Here is the closest state; lower confusion threshold by 0.012 OR increase X axis cap."

#### Algorithm: Random Search + Hill Climb

**Phase 1: Seeding**
1. Sample N random states from mood-regime (N = 5000 default)
2. Score each state by **AND block satisfaction score**:
   ```
   score = (clauses_passing / total_clauses)
   ```
3. Select top M candidates (M = 10) as hill-climb seeds

**Phase 2: Hill Climbing**
1. For each seed, perform gradient-free optimization:
   - Perturb each variable by small delta (±0.01)
   - Keep perturbation if score improves
   - Repeat for K iterations (K = 100)
2. Track best state found across all climbs

**Phase 3: Analysis**
1. Identify **blocking clauses**: Clauses that still fail in best state
2. For each blocking clause, calculate **minimal adjustment**:
   ```
   delta = threshold - observed_value
   ```
3. Rank adjustments by magnitude (smallest first)

#### Output Format

```markdown
## Constructive Witness Analysis

### Best Candidate State Found

- **AND block score**: 0.857 (6/7 clauses pass)
- **Search method**: Random seed + hill climb (5000 samples, 100 iterations)
- **Search time**: 2.3s

### Blocking Clause

| Clause | Observed | Threshold | Gap |
|--------|----------|-----------|-----|
| emotions.confusion | 0.608 | 0.620 | -0.012 |

### Minimal Adjustments to Create Witness

**Option 1** (Smallest Change):
```diff
- emotions.confusion >= 0.620
+ emotions.confusion >= 0.608
```
*Δ = -0.012 — This single change would create a witness.*

**Option 2** (Alternative):
Increase confusion generation via prototype weight adjustment (requires emotion system changes).

### Nearest-Miss State Snapshot

```json
{
  "emotions": {
    "confusion": 0.608,
    "anxiety": 0.42,
    "joy": 0.15
  },
  "arousal": 0.52,
  "engagement": 0.61,
  "moodAxes": {
    "valence": -12,
    "activation": 45
  }
}
```
*This state was observed during search. Adjust thresholds to make it trigger.*
```

#### New Service: `ConstructiveWitnessSearcher`

```javascript
// src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js

class ConstructiveWitnessSearcher {
  #config;
  #logger;
  #stateGenerator;
  #expressionEvaluator;

  constructor({ logger, config, stateGenerator, expressionEvaluator }) {
    this.#config = config;
    this.#logger = logger;
    this.#stateGenerator = stateGenerator;
    this.#expressionEvaluator = expressionEvaluator;
  }

  /**
   * Search for the nearest state to triggering an expression
   * @param {object} expression - The expression to analyze
   * @param {object} moodRegimeConstraints - Constraints defining valid states
   * @returns {WitnessSearchResult}
   */
  async search(expression, moodRegimeConstraints) {
    const startTime = Date.now();
    const timeout = this.#config.timeoutMs;

    // Phase 1: Generate seed candidates
    const seeds = await this.#generateSeeds(expression, moodRegimeConstraints);

    if (Date.now() - startTime > timeout) {
      return this.#buildTimeoutResult(seeds[0], startTime);
    }

    // Phase 2: Hill climb from best seeds
    const topSeeds = seeds.slice(0, this.#config.hillClimbSeeds);
    const climbed = await Promise.all(
      topSeeds.map(seed => this.#hillClimb(seed, expression, moodRegimeConstraints, timeout - (Date.now() - startTime)))
    );

    // Phase 3: Select best and analyze
    const best = this.#selectBest(climbed);
    const analysis = this.#analyzeBlockers(best, expression);

    return {
      found: best.score >= this.#config.minAndBlockScore,
      bestCandidateState: best.state,
      andBlockScore: best.score,
      blockingClauses: analysis.blockingClauses,
      minimalAdjustments: analysis.adjustments,
      searchStats: {
        samplesEvaluated: seeds.length,
        hillClimbIterations: this.#config.hillClimbIterations,
        timeMs: Date.now() - startTime
      }
    };
  }

  async #generateSeeds(expression, constraints) {
    const samples = [];
    for (let i = 0; i < this.#config.maxSamples; i++) {
      const state = this.#stateGenerator.generateInRegime(constraints);
      const score = this.#scoreState(state, expression);
      samples.push({ state, score });
    }
    return samples.sort((a, b) => b.score - a.score);
  }

  #scoreState(state, expression) {
    const result = this.#expressionEvaluator.evaluateWithTracking(expression, state);
    return result.clausesPassing / result.totalClauses;
  }

  async #hillClimb(seed, expression, constraints, remainingTime) {
    let current = { ...seed };
    const deadline = Date.now() + remainingTime;

    for (let i = 0; i < this.#config.hillClimbIterations; i++) {
      if (Date.now() > deadline) break;

      const neighbor = this.#perturbState(current.state, constraints);
      const neighborScore = this.#scoreState(neighbor, expression);

      if (neighborScore > current.score) {
        current = { state: neighbor, score: neighborScore };
      }
    }

    return current;
  }

  #perturbState(state, constraints) {
    const perturbed = JSON.parse(JSON.stringify(state));
    const keys = Object.keys(this.#getNumericFields(state));
    const keyToPerturb = keys[Math.floor(Math.random() * keys.length)];
    const delta = (Math.random() - 0.5) * 0.02; // ±0.01

    // Apply perturbation within constraints
    this.#applyPerturbation(perturbed, keyToPerturb, delta, constraints);
    return perturbed;
  }

  #analyzeBlockers(best, expression) {
    const result = this.#expressionEvaluator.evaluateWithTracking(expression, best.state);
    const blocking = result.clauseResults
      .filter(c => !c.passed)
      .map(c => ({
        clauseId: c.clauseId,
        clauseDescription: c.description,
        observedValue: c.actualValue,
        threshold: c.threshold,
        gap: c.threshold - c.actualValue
      }));

    const adjustments = blocking.map(b => ({
      clauseId: b.clauseId,
      currentThreshold: b.threshold,
      suggestedThreshold: b.observedValue,
      delta: b.observedValue - b.threshold,
      confidence: Math.abs(b.gap) < 0.05 ? 'high' : 'medium'
    }));

    return {
      blockingClauses: blocking,
      adjustments: adjustments.sort((a, b) => Math.abs(a.delta) - Math.abs(b.delta))
    };
  }
}
```

---

### D. OR Block Restructure Recommendations

#### Purpose

Identify OR alternatives that contribute **negligible coverage** and recommend concrete restructuring actions:
- **Delete**: Remove dead-weight alternatives
- **Lower threshold**: Make weak alternatives contribute
- **Replace**: Substitute with more aligned alternatives

#### Key Insight from Brainstorming

> "anxiety >= 0.38 accounts for ~90% exclusive coverage of OR passes"
> "stress_acute >= 0.5 is nearly irrelevant"
>
> Report should explicitly say: "Delete the stress_acute alternative (it adds complexity without coverage)."

#### Analysis Metrics

For each OR alternative, compute:

| Metric | Definition |
|--------|------------|
| **Exclusive Coverage** | Pass rate when THIS alternative is the ONLY one passing |
| **Marginal Contribution** | Δ OR-block pass rate if this alternative were removed |
| **Overlap Ratio** | Fraction of this alternative's passes also covered by others |

#### Classification Thresholds

| Exclusive Coverage | Classification | Recommendation |
|-------------------|----------------|----------------|
| < 1% | Dead Weight | Delete or replace |
| 1% - 5% | Weak Contributor | Lower threshold or replace |
| > 5% | Meaningful | Keep as-is |

#### Output Format

```markdown
## OR Block Restructure Analysis

### OR Block #1: `anxiety >= 0.38 OR stress_acute >= 0.5`

| Alternative | Exclusive | Marginal Δ | Overlap | Classification |
|-------------|-----------|------------|---------|----------------|
| anxiety >= 0.38 | 89.2% | -83.1% | 10.8% | ✅ MEANINGFUL |
| stress_acute >= 0.5 | 2.1% | -0.3% | 97.9% | ⚠️ DEAD WEIGHT |

### Recommendations

**For `stress_acute >= 0.5`** (Dead Weight):

1. **Delete** — Simplifies expression without meaningful coverage loss
   ```diff
   - anxiety >= 0.38 OR stress_acute >= 0.5
   + anxiety >= 0.38
   ```

2. **Lower threshold** — `>= 0.35` would achieve ~8% exclusive coverage
   ```diff
   - stress_acute >= 0.5
   + stress_acute >= 0.35
   ```

3. **Replace** — Consider `cognitive_load >= 0.4` for better regime alignment

### Impact Summary

Deleting `stress_acute >= 0.5` would:
- Reduce OR block complexity by 50%
- Decrease OR pass rate by only 0.3% (6.83% → 6.51%)
- Have negligible impact on overall trigger rate
```

#### New Service: `OrBlockAnalyzer`

```javascript
// src/expressionDiagnostics/services/OrBlockAnalyzer.js

class OrBlockAnalyzer {
  #config;
  #logger;

  constructor({ logger, config }) {
    this.#config = config;
    this.#logger = logger;
  }

  /**
   * Analyze OR block for restructuring recommendations
   * @param {object} orBlock - OR block with alternative tracking data
   * @param {SimulationResult} simulationResult - Full simulation context
   * @returns {OrBlockAnalysis}
   */
  analyze(orBlock, simulationResult) {
    const alternatives = orBlock.alternatives.map((alt, index) =>
      this.#analyzeAlternative(alt, index, orBlock, simulationResult)
    );

    const deadWeight = alternatives.filter(a => a.classification === 'dead-weight');
    const recommendations = deadWeight.map(a => this.#generateRecommendations(a, orBlock));

    return {
      blockId: orBlock.id,
      blockDescription: orBlock.description,
      alternatives,
      deadWeightCount: deadWeight.length,
      recommendations: recommendations.flat(),
      impactSummary: this.#summarizeImpact(deadWeight, orBlock)
    };
  }

  #analyzeAlternative(alt, index, orBlock, result) {
    const exclusivePasses = this.#countExclusivePasses(alt, orBlock, result);
    const totalOrPasses = orBlock.passCount;
    const exclusiveCoverage = totalOrPasses > 0 ? exclusivePasses / totalOrPasses : 0;

    const marginalContribution = this.#estimateMarginalContribution(alt, orBlock, result);
    const overlapRatio = 1 - exclusiveCoverage;

    return {
      alternativeIndex: index,
      clauseDescription: alt.description,
      exclusiveCoverage,
      marginalContribution,
      overlapRatio,
      classification: this.#classify(exclusiveCoverage)
    };
  }

  #classify(exclusiveCoverage) {
    if (exclusiveCoverage < this.#config.deadWeightThreshold) return 'dead-weight';
    if (exclusiveCoverage < this.#config.weakContributorThreshold) return 'weak';
    return 'meaningful';
  }

  #generateRecommendations(deadWeightAlt, orBlock) {
    const recommendations = [];

    // Option 1: Delete
    recommendations.push({
      action: 'delete',
      targetAlternative: deadWeightAlt.alternativeIndex,
      rationale: 'Simplifies expression without meaningful coverage loss',
      predictedImpact: `OR pass rate -${(deadWeightAlt.marginalContribution * 100).toFixed(1)}%`
    });

    // Option 2: Lower threshold (if numeric clause)
    if (this.#hasNumericThreshold(deadWeightAlt)) {
      const suggestedThreshold = this.#calculateThresholdForTargetCoverage(
        deadWeightAlt,
        this.#config.targetExclusiveCoverage
      );
      recommendations.push({
        action: 'lower-threshold',
        targetAlternative: deadWeightAlt.alternativeIndex,
        suggestedValue: suggestedThreshold,
        rationale: `Would achieve ~${(this.#config.targetExclusiveCoverage * 100).toFixed(0)}% exclusive coverage`,
        predictedImpact: 'Increased contribution without removal'
      });
    }

    // Option 3: Replace (generic suggestion)
    recommendations.push({
      action: 'replace',
      targetAlternative: deadWeightAlt.alternativeIndex,
      suggestedReplacement: null, // Would require domain knowledge
      rationale: 'Consider alternative more aligned with mood regime',
      predictedImpact: 'Depends on replacement choice'
    });

    return recommendations;
  }
}
```

---

### E. Recommended Edit Set (Targeting Rarity Band)

#### Purpose

Generate concrete patch proposals that target specific trigger rate bands (e.g., [0.01%, 0.1%]), with importance-sampled validation of predicted outcomes.

#### Key Insight from Brainstorming

> "The report should output a concrete patch proposal like:
> - Lower confusion >= 0.62 → >= 0.41 (to reach ~5% in-regime clause pass)
> - Lower anxiety >= 0.38 → >= 0.28 (if you want OR1 pass > ~10%)
>
> And then re-simulate just the regime (importance sampling) to estimate the new trigger rate."

#### Algorithm

**Phase 1: Target Definition**
- User specifies target rarity band: `[minRate, maxRate]`
- Default: `[0.01%, 0.1%]` (rare but observable)

**Phase 2: Edit Candidate Generation**
From inputs:
- Core blockers (from A) → threshold adjustments
- OR restructure recommendations (from D) → structure changes
- Quantile analysis (from B) → specific threshold values

Generate edit candidates:
```javascript
candidates = [
  { type: 'threshold', clause: 'confusion', from: 0.62, to: 0.41 },
  { type: 'threshold', clause: 'anxiety', from: 0.38, to: 0.28 },
  { type: 'structure', action: 'delete', target: 'stress_acute >= 0.5' },
  // Combinations...
]
```

**Phase 3: Edit Ranking**
Score each candidate by:
```
score = simplicity × predictedEffectiveness × confidence

simplicity = 1 / numEdits
predictedEffectiveness = |predicted - target| (lower is better, inverted)
confidence = based on sample size and variance
```

**Phase 4: Importance Sampling Validation**
For top candidates:
1. Re-evaluate stored contexts with modified thresholds
2. Weight samples by likelihood ratio (importance sampling)
3. Estimate new trigger rate with confidence interval

#### Output Format

```markdown
## Recommended Edits for Target Band [0.01%, 0.1%]

### Primary Recommendation

**Predicted trigger rate**: 0.05% (95% CI: 0.03% - 0.08%)
**Confidence**: HIGH (validated on 2,847 mood-regime samples)

```diff
- emotions.confusion >= 0.62
+ emotions.confusion >= 0.41
```

| Metric | Before | After |
|--------|--------|-------|
| Clause pass rate | 0.0% | ~5.2% |
| Expression trigger rate | 0.0% | ~0.05% |
| Validation method | — | Importance sampling |

### Alternative Edits

| Rank | Edit | Predicted Rate | Confidence |
|------|------|---------------|------------|
| 2 | anxiety >= 0.38 → >= 0.28 | 0.08% | MEDIUM |
| 3 | confusion + anxiety combined | 0.12% | MEDIUM |

### Not Recommended

- Adjusting absorption caps (already 96% pass, minimal impact)
- Lowering panic/freeze thresholds (non-core constraints)
```

#### New Services

**EditSetGenerator**:
```javascript
// src/expressionDiagnostics/services/EditSetGenerator.js

class EditSetGenerator {
  #config;
  #logger;
  #minimalBlockerCalculator;
  #orBlockAnalyzer;
  #importanceSamplingValidator;

  constructor({ logger, config, minimalBlockerCalculator, orBlockAnalyzer, importanceSamplingValidator }) {
    this.#config = config;
    this.#logger = logger;
    this.#minimalBlockerCalculator = minimalBlockerCalculator;
    this.#orBlockAnalyzer = orBlockAnalyzer;
    this.#importanceSamplingValidator = importanceSamplingValidator;
  }

  /**
   * Generate ranked edit proposals for target rarity band
   * @param {SimulationResult} result - Full simulation result with stored contexts
   * @param {object} options - Target band and preferences
   * @returns {RecommendedEditSet}
   */
  async generate(result, options) {
    const { targetBand = this.#config.defaultTargetBand } = options;

    // Gather inputs from other analyzers
    const coreBlockers = this.#minimalBlockerCalculator.calculate(result.clauses, result);
    const orAnalyses = result.orBlocks?.map(ob => this.#orBlockAnalyzer.analyze(ob, result)) ?? [];

    // Generate edit candidates
    const candidates = this.#generateCandidates(coreBlockers, orAnalyses, result);

    // Validate top candidates with importance sampling
    const validated = await this.#validateCandidates(candidates, result, targetBand);

    // Rank and select
    const ranked = this.#rankCandidates(validated, targetBand);

    return {
      targetBand,
      primaryRecommendation: ranked[0] ?? null,
      alternativeEdits: ranked.slice(1, this.#config.maxEditProposals),
      notRecommended: this.#identifyNotRecommended(result)
    };
  }

  #generateCandidates(coreBlockers, orAnalyses, result) {
    const candidates = [];

    // From core blockers: threshold adjustments
    for (const blocker of coreBlockers.coreBlockers) {
      if (blocker.quantiles) {
        for (const rate of this.#config.targetPassRates) {
          candidates.push({
            edits: [{
              clauseId: blocker.clauseId,
              editType: 'threshold',
              before: blocker.threshold,
              after: blocker.quantiles[`p${100 - rate * 100}`]
            }],
            source: 'core-blocker',
            targetClausePassRate: rate
          });
        }
      }
    }

    // From OR analyses: structure changes
    for (const analysis of orAnalyses) {
      for (const rec of analysis.recommendations) {
        if (rec.action === 'delete') {
          candidates.push({
            edits: [{
              clauseId: rec.targetAlternative,
              editType: 'structure',
              before: 'present',
              after: 'deleted'
            }],
            source: 'or-restructure',
            targetClausePassRate: null
          });
        }
      }
    }

    return candidates;
  }

  async #validateCandidates(candidates, result, targetBand) {
    const validated = [];

    for (const candidate of candidates.slice(0, this.#config.maxCandidatesToValidate)) {
      const validation = await this.#importanceSamplingValidator.validate(
        candidate,
        result.storedContexts,
        result.expression
      );

      validated.push({
        ...candidate,
        predictedTriggerRate: validation.estimatedRate,
        confidenceInterval: validation.confidenceInterval,
        confidence: validation.confidence,
        validationMethod: 'importance-sampling'
      });
    }

    return validated;
  }

  #rankCandidates(validated, targetBand) {
    const [minTarget, maxTarget] = targetBand;
    const midTarget = (minTarget + maxTarget) / 2;

    return validated
      .map(c => ({
        ...c,
        score: this.#scoreCandidate(c, midTarget)
      }))
      .sort((a, b) => b.score - a.score);
  }

  #scoreCandidate(candidate, targetRate) {
    const simplicity = 1 / candidate.edits.length;
    const effectiveness = 1 / (1 + Math.abs(candidate.predictedTriggerRate - targetRate));
    const confidenceMultiplier = candidate.confidence === 'high' ? 1.0 :
                                  candidate.confidence === 'medium' ? 0.7 : 0.4;

    return simplicity * effectiveness * confidenceMultiplier;
  }
}
```

**ImportanceSamplingValidator**:
```javascript
// src/expressionDiagnostics/services/ImportanceSamplingValidator.js

class ImportanceSamplingValidator {
  #config;
  #logger;
  #expressionEvaluator;

  constructor({ logger, config, expressionEvaluator }) {
    this.#config = config;
    this.#logger = logger;
    this.#expressionEvaluator = expressionEvaluator;
  }

  /**
   * Validate edit proposal using importance sampling
   * @param {EditProposal} proposal - The edit to validate
   * @param {object[]} storedContexts - Pre-stored evaluation contexts
   * @param {object} originalExpression - The original expression
   * @returns {ValidationResult}
   */
  async validate(proposal, storedContexts, originalExpression) {
    const modifiedExpression = this.#applyEdits(originalExpression, proposal.edits);

    let weightedSum = 0;
    let totalWeight = 0;
    const results = [];

    for (const context of storedContexts) {
      const weight = this.#computeImportanceWeight(context, proposal);
      const triggered = this.#expressionEvaluator.evaluate(modifiedExpression, context);

      weightedSum += triggered ? weight : 0;
      totalWeight += weight;
      results.push({ triggered, weight });
    }

    const estimatedRate = totalWeight > 0 ? weightedSum / totalWeight : 0;
    const { lower, upper } = this.#computeConfidenceInterval(results, this.#config.confidenceLevel);

    return {
      estimatedRate,
      confidenceInterval: [lower, upper],
      confidence: this.#assessConfidence(results, estimatedRate),
      sampleCount: storedContexts.length,
      effectiveSampleSize: this.#computeEffectiveSampleSize(results)
    };
  }

  #computeImportanceWeight(context, proposal) {
    // For threshold changes, weight by proximity to decision boundary
    // Higher weight for samples near the new threshold
    let weight = 1.0;

    for (const edit of proposal.edits) {
      if (edit.editType === 'threshold') {
        const value = this.#extractValue(context, edit.clauseId);
        const distanceToNewThreshold = Math.abs(value - edit.after);
        // Gaussian-like weighting centered on new threshold
        weight *= Math.exp(-distanceToNewThreshold * distanceToNewThreshold / 0.02);
      }
    }

    return Math.max(weight, 0.01); // Floor to prevent division issues
  }

  #computeConfidenceInterval(results, confidenceLevel) {
    // Wilson score interval for weighted proportion
    const n = this.#computeEffectiveSampleSize(results);
    const p = results.reduce((sum, r) => sum + (r.triggered ? r.weight : 0), 0) /
              results.reduce((sum, r) => sum + r.weight, 0);

    const z = this.#zScore(confidenceLevel);
    const denominator = 1 + z * z / n;
    const center = (p + z * z / (2 * n)) / denominator;
    const margin = (z / denominator) * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n));

    return {
      lower: Math.max(0, center - margin),
      upper: Math.min(1, center + margin)
    };
  }

  #assessConfidence(results, estimatedRate) {
    const effectiveN = this.#computeEffectiveSampleSize(results);

    if (effectiveN > 1000 && estimatedRate > 0.001) return 'high';
    if (effectiveN > 200 && estimatedRate > 0.0001) return 'medium';
    return 'low';
  }

  #computeEffectiveSampleSize(results) {
    const weights = results.map(r => r.weight);
    const sumW = weights.reduce((a, b) => a + b, 0);
    const sumW2 = weights.reduce((a, w) => a + w * w, 0);
    return sumW2 > 0 ? (sumW * sumW) / sumW2 : 0;
  }
}
```

---

## Data Model Changes

### New Types

```typescript
// === Minimal Blocker Set (A) ===

interface DominantCoreResult {
  coreBlockers: BlockerInfo[];
  nonCoreConstraints: BlockerInfo[];
  compositeScores: Map<string, number>;
}

interface BlockerInfo {
  clauseId: string;
  clauseDescription: string;
  lastMileRate: number;
  impactScore: number;
  compositeScore: number;
  inRegimePassRate: number;
  classification: 'core' | 'non-core';
}

// === Constructive Witness Search (C) ===

interface WitnessSearchResult {
  found: boolean;
  bestCandidateState: Record<string, unknown> | null;
  andBlockScore: number;
  blockingClauses: BlockingClauseInfo[];
  minimalAdjustments: ThresholdAdjustment[];
  searchStats: SearchStatistics;
}

interface BlockingClauseInfo {
  clauseId: string;
  clauseDescription: string;
  observedValue: number;
  threshold: number;
  gap: number;
}

interface ThresholdAdjustment {
  clauseId: string;
  currentThreshold: number;
  suggestedThreshold: number;
  delta: number;
  confidence: 'high' | 'medium' | 'low';
}

interface SearchStatistics {
  samplesEvaluated: number;
  hillClimbIterations: number;
  timeMs: number;
}

// === OR Block Analysis (D) ===

interface OrBlockAnalysis {
  blockId: string;
  blockDescription: string;
  alternatives: OrAlternativeAnalysis[];
  deadWeightCount: number;
  recommendations: RestructureRecommendation[];
  impactSummary: string;
}

interface OrAlternativeAnalysis {
  alternativeIndex: number;
  clauseDescription: string;
  exclusiveCoverage: number;
  marginalContribution: number;
  overlapRatio: number;
  classification: 'meaningful' | 'weak' | 'dead-weight';
}

interface RestructureRecommendation {
  action: 'delete' | 'lower-threshold' | 'replace';
  targetAlternative: number;
  suggestedValue?: number;
  suggestedReplacement?: string;
  rationale: string;
  predictedImpact: string;
}

// === Recommended Edit Set (E) ===

interface RecommendedEditSet {
  targetBand: [number, number];
  primaryRecommendation: EditProposal | null;
  alternativeEdits: EditProposal[];
  notRecommended: string[];
}

interface EditProposal {
  edits: SingleEdit[];
  predictedTriggerRate: number;
  confidenceInterval: [number, number];
  confidence: 'high' | 'medium' | 'low';
  validationMethod: 'importance-sampling' | 'extrapolation';
  score: number;
}

interface SingleEdit {
  clauseId: string;
  editType: 'threshold' | 'structure';
  before: string | number;
  after: string | number;
  delta?: number;
}

// === Validation ===

interface ValidationResult {
  estimatedRate: number;
  confidenceInterval: [number, number];
  confidence: 'high' | 'medium' | 'low';
  sampleCount: number;
  effectiveSampleSize: number;
}
```

### Configuration Schema

```javascript
// src/expressionDiagnostics/config/actionabilityConfig.js

export const actionabilityConfig = {
  // A. Minimal Blocker Set
  minimalBlockerSet: {
    enabled: true,
    maxCoreBlockers: 3,
    nonCorePassRateThreshold: 0.95,
    impactWeight: 0.6,
    lastMileWeight: 0.4,
    minMarginalExplanation: 0.05,  // 5% marginal explanatory power
  },

  // B. Threshold Suggestions
  thresholdSuggestions: {
    enabled: true,
    targetPassRates: [0.01, 0.05, 0.10, 0.25],
    includeInNonZeroHitCases: true,
    showAbsoluteCeiling: true,
  },

  // C. Constructive Witness Search
  witnessSearch: {
    enabled: true,
    maxSamples: 5000,
    hillClimbSeeds: 10,
    hillClimbIterations: 100,
    perturbationDelta: 0.01,
    timeoutMs: 5000,
    minAndBlockScore: 0.5,
  },

  // D. OR Block Analysis
  orBlockAnalysis: {
    enabled: true,
    deadWeightThreshold: 0.01,       // < 1% exclusive coverage
    weakContributorThreshold: 0.05,  // < 5% exclusive coverage
    targetExclusiveCoverage: 0.08,   // 8% target for threshold lowering
    enableReplacementSuggestions: false,  // Requires domain knowledge
  },

  // E. Edit Set Generation
  editSetGeneration: {
    enabled: true,
    defaultTargetBand: [0.0001, 0.001],  // [0.01%, 0.1%]
    targetPassRates: [0.01, 0.05, 0.10],
    maxCandidatesToValidate: 10,
    maxEditProposals: 5,
    importanceSampling: {
      enabled: true,
      confidenceLevel: 0.95,
    },
  },
};
```

---

## Implementation Plan

### Phase 1: Infrastructure (2-3 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Create `actionabilityConfig.js` | New | 80 |
| Create type definitions | New types file | 120 |
| Create `ActionabilitySectionGenerator.js` | New | 300 |
| Add DI tokens and registrations | Modified | 50 |

**Deliverable**: Configuration and report scaffolding in place

### Phase 2: Minimal Blocker Set (2 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Create `MinimalBlockerSetCalculator.js` | New | 200 |
| Unit tests for calculator | New | 300 |
| Integration with `BlockerSectionGenerator` | Modified | 50 |
| Integration tests | New | 150 |

**Deliverable**: Core blocker identification working end-to-end

### Phase 3: Constructive Witness Search (3-4 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Create `ConstructiveWitnessSearcher.js` | New | 350 |
| Create `WitnessOptimizationService.js` | New | 150 |
| Unit tests for searcher | New | 400 |
| Performance tests | New | 100 |
| Integration with zero-hit handling | Modified | 80 |

**Deliverable**: Witness search produces actionable results for zero-hit expressions

### Phase 4: OR Block Restructure (2 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Create `OrBlockAnalyzer.js` | New | 250 |
| Unit tests for analyzer | New | 250 |
| Integration with `RecommendationEngine` | Modified | 80 |
| Integration tests | New | 100 |

**Deliverable**: OR blocks analyzed with concrete restructure recommendations

### Phase 5: Edit Set Generation (3-4 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Create `EditSetGenerator.js` | New | 300 |
| Create `ImportanceSamplingValidator.js` | New | 200 |
| Create `RarityBandTargeter.js` | New | 120 |
| Unit tests for all three | New | 450 |
| End-to-end integration tests | New | 200 |

**Deliverable**: Complete edit recommendation pipeline with validation

### Phase 6: Integration & Polish (1-2 days)

| Task | Files | Est. LOC |
|------|-------|----------|
| Wire all services into `MonteCarloReportGenerator` | Modified | 100 |
| Create unified "Next Actions" report section | Modified | 150 |
| Performance optimization | Various | 50 |
| Documentation updates | Docs | N/A |

**Deliverable**: Production-ready actionability features

---

## Testing Strategy

### Unit Test Requirements

#### MinimalBlockerSetCalculator Tests

```javascript
// tests/unit/expressionDiagnostics/services/minimalBlockerSetCalculator.test.js

describe('MinimalBlockerSetCalculator', () => {
  describe('calculate', () => {
    it('identifies single dominant blocker when one clause has 80%+ impact', () => {
      const clauses = createMockClauses([
        { lastMileRate: 0.85, impactScore: 0.82 },
        { lastMileRate: 0.10, impactScore: 0.08 },
        { lastMileRate: 0.05, impactScore: 0.05 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.coreBlockers).toHaveLength(1);
      expect(result.coreBlockers[0].impactScore).toBeCloseTo(0.82);
    });

    it('identifies multiple core blockers when impact is distributed', () => {
      const clauses = createMockClauses([
        { lastMileRate: 0.45, impactScore: 0.40 },
        { lastMileRate: 0.35, impactScore: 0.35 },
        { lastMileRate: 0.10, impactScore: 0.10 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.coreBlockers).toHaveLength(2);
    });

    it('classifies high-pass-rate clauses as non-core', () => {
      const clauses = createMockClauses([
        { lastMileRate: 0.80, impactScore: 0.75, inRegimePassRate: 0.20 },
        { lastMileRate: 0.02, impactScore: 0.01, inRegimePassRate: 0.98 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.nonCoreConstraints).toHaveLength(1);
      expect(result.nonCoreConstraints[0].inRegimePassRate).toBeGreaterThan(0.95);
    });

    it('handles single-clause expressions', () => {
      const clauses = createMockClauses([
        { lastMileRate: 1.0, impactScore: 1.0 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.coreBlockers).toHaveLength(1);
      expect(result.nonCoreConstraints).toHaveLength(0);
    });

    it('handles all-passing expressions', () => {
      const clauses = createMockClauses([
        { lastMileRate: 0.0, impactScore: 0.0, inRegimePassRate: 1.0 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.coreBlockers).toHaveLength(0);
    });

    it('respects maxCoreBlockers configuration', () => {
      const clauses = createMockClauses([
        { lastMileRate: 0.30, impactScore: 0.25 },
        { lastMileRate: 0.25, impactScore: 0.25 },
        { lastMileRate: 0.25, impactScore: 0.25 },
        { lastMileRate: 0.20, impactScore: 0.20 }
      ]);
      const result = calculator.calculate(clauses, mockSimResult);

      expect(result.coreBlockers.length).toBeLessThanOrEqual(3);
    });
  });
});
```

#### ConstructiveWitnessSearcher Tests

```javascript
// tests/unit/expressionDiagnostics/services/constructiveWitnessSearcher.test.js

describe('ConstructiveWitnessSearcher', () => {
  describe('search', () => {
    it('finds candidate with high AND block score for near-feasible expression', async () => {
      const expression = createNearFeasibleExpression();
      const result = await searcher.search(expression, moodRegimeConstraints);

      expect(result.found).toBe(true);
      expect(result.andBlockScore).toBeGreaterThan(0.8);
    });

    it('identifies correct blocking clauses', async () => {
      const expression = createExpressionWithKnownBlocker('confusion', 0.62);
      const result = await searcher.search(expression, moodRegimeConstraints);

      expect(result.blockingClauses).toContainEqual(
        expect.objectContaining({ clauseId: expect.stringContaining('confusion') })
      );
    });

    it('calculates minimal adjustments correctly', async () => {
      const expression = createExpressionWithKnownBlocker('confusion', 0.62);
      const result = await searcher.search(expression, moodRegimeConstraints);

      const confusionAdjustment = result.minimalAdjustments.find(
        a => a.clauseId.includes('confusion')
      );
      expect(confusionAdjustment.delta).toBeLessThan(0);
      expect(confusionAdjustment.suggestedThreshold).toBeLessThan(0.62);
    });

    it('respects timeout configuration', async () => {
      const searcher = createSearcher({ timeoutMs: 100 });
      const expression = createComplexExpression();

      const start = Date.now();
      await searcher.search(expression, moodRegimeConstraints);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(200); // Allow some overhead
    });

    it('returns found=false when no reasonable candidate exists', async () => {
      const expression = createImpossibleExpression();
      const result = await searcher.search(expression, moodRegimeConstraints);

      expect(result.found).toBe(false);
      expect(result.andBlockScore).toBeLessThan(0.5);
    });

    it('hill climb improves initial seed score', async () => {
      const expression = createNearFeasibleExpression();

      // Mock to capture before/after scores
      const scores = [];
      const result = await searcher.search(expression, moodRegimeConstraints);

      expect(result.andBlockScore).toBeGreaterThan(result.searchStats.initialBestScore ?? 0);
    });
  });
});
```

#### OrBlockAnalyzer Tests

```javascript
// tests/unit/expressionDiagnostics/services/orBlockAnalyzer.test.js

describe('OrBlockAnalyzer', () => {
  describe('analyze', () => {
    it('identifies dead-weight alternative with < 1% exclusive coverage', () => {
      const orBlock = createOrBlock([
        { description: 'anxiety >= 0.38', exclusivePasses: 892 },
        { description: 'stress_acute >= 0.5', exclusivePasses: 8 }
      ], { totalPasses: 1000 });

      const result = analyzer.analyze(orBlock, mockSimResult);

      const deadWeight = result.alternatives.find(
        a => a.clauseDescription.includes('stress_acute')
      );
      expect(deadWeight.classification).toBe('dead-weight');
      expect(deadWeight.exclusiveCoverage).toBeLessThan(0.01);
    });

    it('correctly calculates marginal contribution', () => {
      const orBlock = createOrBlock([
        { description: 'alt1', passRate: 0.80, exclusivePasses: 700 },
        { description: 'alt2', passRate: 0.15, exclusivePasses: 50 }
      ], { totalPasses: 850 });

      const result = analyzer.analyze(orBlock, mockSimResult);

      const alt2 = result.alternatives.find(a => a.clauseDescription === 'alt2');
      expect(alt2.marginalContribution).toBeCloseTo(0.059, 2); // 50/850
    });

    it('generates delete recommendation for dead-weight alternative', () => {
      const orBlock = createOrBlockWithDeadWeight();
      const result = analyzer.analyze(orBlock, mockSimResult);

      const deleteRec = result.recommendations.find(r => r.action === 'delete');
      expect(deleteRec).toBeDefined();
      expect(deleteRec.rationale).toContain('without meaningful coverage');
    });

    it('generates lower-threshold recommendation with target coverage', () => {
      const orBlock = createOrBlockWithDeadWeight();
      const result = analyzer.analyze(orBlock, mockSimResult);

      const lowerRec = result.recommendations.find(r => r.action === 'lower-threshold');
      expect(lowerRec).toBeDefined();
      expect(lowerRec.suggestedValue).toBeLessThan(orBlock.alternatives[1].threshold);
    });

    it('handles single-alternative OR blocks', () => {
      const orBlock = createOrBlock([
        { description: 'only_alt', exclusivePasses: 100 }
      ], { totalPasses: 100 });

      const result = analyzer.analyze(orBlock, mockSimResult);

      expect(result.alternatives[0].exclusiveCoverage).toBe(1.0);
      expect(result.alternatives[0].classification).toBe('meaningful');
    });

    it('classifies weak contributors correctly (1-5% coverage)', () => {
      const orBlock = createOrBlock([
        { description: 'strong', exclusivePasses: 950 },
        { description: 'weak', exclusivePasses: 30 }
      ], { totalPasses: 1000 });

      const result = analyzer.analyze(orBlock, mockSimResult);

      const weak = result.alternatives.find(a => a.clauseDescription === 'weak');
      expect(weak.classification).toBe('weak');
    });
  });
});
```

#### EditSetGenerator Tests

```javascript
// tests/unit/expressionDiagnostics/services/editSetGenerator.test.js

describe('EditSetGenerator', () => {
  describe('generate', () => {
    it('generates edit targeting specified rarity band', async () => {
      const result = createSimulationResultWithBlockers();
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.001]
      });

      expect(editSet.primaryRecommendation).toBeDefined();
      expect(editSet.primaryRecommendation.predictedTriggerRate).toBeGreaterThan(0.0001);
      expect(editSet.primaryRecommendation.predictedTriggerRate).toBeLessThan(0.001);
    });

    it('ranks simpler edits higher than complex ones', async () => {
      const result = createSimulationResultWithBlockers();
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.01]
      });

      // Primary should be single edit if available
      if (editSet.alternativeEdits.length > 0) {
        expect(editSet.primaryRecommendation.edits.length)
          .toBeLessThanOrEqual(editSet.alternativeEdits[0].edits.length);
      }
    });

    it('validates predictions with importance sampling', async () => {
      const result = createSimulationResultWithStoredContexts(1000);
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.001]
      });

      expect(editSet.primaryRecommendation.validationMethod).toBe('importance-sampling');
      expect(editSet.primaryRecommendation.confidenceInterval).toHaveLength(2);
    });

    it('identifies not-recommended edits', async () => {
      const result = createSimulationResultWithNonBlockingClauses();
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.001]
      });

      expect(editSet.notRecommended.length).toBeGreaterThan(0);
      expect(editSet.notRecommended[0]).toContain('minimal impact');
    });

    it('handles zero stored contexts gracefully', async () => {
      const result = createSimulationResultWithStoredContexts(0);
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.001]
      });

      // Should still generate candidates, but with lower confidence
      expect(editSet.primaryRecommendation?.confidence).toBe('low');
    });

    it('respects maxEditProposals configuration', async () => {
      const result = createSimulationResultWithManyBlockers();
      const editSet = await generator.generate(result, {
        targetBand: [0.0001, 0.01]
      });

      expect(editSet.alternativeEdits.length).toBeLessThanOrEqual(
        config.editSetGeneration.maxEditProposals - 1
      );
    });
  });
});
```

#### ImportanceSamplingValidator Tests

```javascript
// tests/unit/expressionDiagnostics/services/importanceSamplingValidator.test.js

describe('ImportanceSamplingValidator', () => {
  describe('validate', () => {
    it('estimates rate within reasonable bounds', async () => {
      const proposal = createThresholdEditProposal('confusion', 0.62, 0.50);
      const contexts = generateMockContexts(1000);

      const result = await validator.validate(proposal, contexts, expression);

      expect(result.estimatedRate).toBeGreaterThanOrEqual(0);
      expect(result.estimatedRate).toBeLessThanOrEqual(1);
    });

    it('produces calibrated confidence intervals', async () => {
      // Run multiple validations to check calibration
      const results = [];
      for (let i = 0; i < 100; i++) {
        const contexts = generateMockContexts(500);
        const result = await validator.validate(proposal, contexts, expression);
        results.push(result);
      }

      // 95% CI should contain true rate ~95% of the time
      const trueRate = computeTrueRate(proposal, expression);
      const containsTrue = results.filter(
        r => r.confidenceInterval[0] <= trueRate && trueRate <= r.confidenceInterval[1]
      );

      expect(containsTrue.length).toBeGreaterThan(85); // Allow some slack
    });

    it('computes effective sample size correctly', async () => {
      const proposal = createThresholdEditProposal('confusion', 0.62, 0.50);
      const contexts = generateMockContexts(1000);

      const result = await validator.validate(proposal, contexts, expression);

      expect(result.effectiveSampleSize).toBeGreaterThan(0);
      expect(result.effectiveSampleSize).toBeLessThanOrEqual(result.sampleCount);
    });

    it('assigns appropriate confidence levels', async () => {
      const highConfContexts = generateMockContexts(2000);
      const lowConfContexts = generateMockContexts(50);

      const highResult = await validator.validate(proposal, highConfContexts, expression);
      const lowResult = await validator.validate(proposal, lowConfContexts, expression);

      expect(['high', 'medium']).toContain(highResult.confidence);
      expect(lowResult.confidence).toBe('low');
    });
  });
});
```

### Integration Test Requirements

```javascript
// tests/integration/expressionDiagnostics/monteCarloActionability.integration.test.js

describe('Monte Carlo Actionability Integration', () => {
  let simulator;
  let reportGenerator;
  let container;

  beforeAll(async () => {
    container = await createTestContainer();
    simulator = container.resolve(tokens.IMonteCarloSimulator);
    reportGenerator = container.resolve(tokens.IMonteCarloReportGenerator);
  });

  describe('Minimal Blocker Set Integration', () => {
    it('generates core blocker summary in report for multi-clause expression', async () => {
      const expression = loadTestExpression('complex-multi-clause');
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });
      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('## Core Blockers');
      expect(report).toContain('Tune These First');
      expect(report).toMatch(/Last-Mile.*Impact/);
    });

    it('correctly identifies known dominant blocker in controlled expression', async () => {
      const expression = createExpressionWithKnownDominantBlocker('confusion', 0.95);
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });
      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('confusion');
      const coreSection = extractSection(report, 'Core Blockers');
      expect(coreSection).toContain('confusion');
    });
  });

  describe('Constructive Witness Search Integration', () => {
    it('performs witness search for zero-hit expression', async () => {
      const expression = loadTestExpression('zero-trigger-near-feasible');
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });

      expect(simResult.triggerCount).toBe(0);

      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('Constructive Witness Analysis');
      expect(report).toContain('Best Candidate State');
      expect(report).toContain('Minimal Adjustments');
    });

    it('provides actionable threshold adjustment for zero-hit expression', async () => {
      const expression = createExpressionWithNearMissThreshold('confusion', 0.62, 0.608);
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });
      const report = await reportGenerator.generate(simResult);

      expect(report).toMatch(/confusion.*0\.6[01]/); // Should suggest threshold near 0.608
      expect(report).toContain('Δ');
    });
  });

  describe('OR Block Restructure Integration', () => {
    it('identifies dead-weight OR alternative in report', async () => {
      const expression = loadTestExpression('or-heavy-with-dead-weight');
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });
      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('OR Block Restructure');
      expect(report).toContain('DEAD WEIGHT');
      expect(report).toContain('Delete');
    });

    it('suggests threshold lowering for weak OR alternative', async () => {
      const expression = loadTestExpression('or-with-weak-alternative');
      const simResult = await simulator.simulate(expression, { sampleCount: 10000 });
      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('Lower threshold');
    });
  });

  describe('Edit Set Generation Integration', () => {
    it('generates edit recommendations targeting rarity band', async () => {
      const expression = loadTestExpression('tunable-expression');
      const simResult = await simulator.simulate(expression, {
        sampleCount: 10000,
        storeSamplesForSensitivity: true
      });
      const report = await reportGenerator.generate(simResult, {
        targetRarityBand: [0.0001, 0.001]
      });

      expect(report).toContain('Recommended Edits');
      expect(report).toContain('Target Band');
      expect(report).toMatch(/Predicted.*0\.\d+%/);
    });

    it('validates predictions with stored contexts', async () => {
      const expression = loadTestExpression('tunable-expression');
      const simResult = await simulator.simulate(expression, {
        sampleCount: 10000,
        storeSamplesForSensitivity: true,
        moodRegimeSampleReservoirLimit: 5000
      });
      const report = await reportGenerator.generate(simResult);

      expect(report).toContain('Importance sampling');
      expect(report).toMatch(/95% CI/);
    });
  });

  describe('End-to-End Report Generation', () => {
    it('generates complete actionability report for complex expression', async () => {
      const expression = loadTestExpression('complex-realistic');
      const simResult = await simulator.simulate(expression, {
        sampleCount: 10000,
        storeSamplesForSensitivity: true
      });
      const report = await reportGenerator.generate(simResult);

      // Check all sections present
      expect(report).toContain('Core Blockers');
      expect(report).toContain('Threshold Suggestions');
      expect(report).toContain('Recommended Edits');

      // Check actionability
      expect(report).toContain('Tune');
      expect(report).toMatch(/[+-]\d+\.\d+/); // Delta values
    });

    it('maintains backward compatibility with existing report format', async () => {
      const expression = loadTestExpression('basic-expression');
      const simResult = await simulator.simulate(expression, { sampleCount: 1000 });
      const report = await reportGenerator.generate(simResult);

      // Existing sections should still be present
      expect(report).toContain('Population Summary');
      expect(report).toContain('Clause-by-Clause');
      expect(report).toContain('Sensitivity');
    });
  });
});
```

### Performance Test Requirements

```javascript
// tests/performance/monteCarloActionability.performance.test.js

describe('Actionability Performance', () => {
  describe('Witness Search Performance', () => {
    it('completes within timeout for typical expression', async () => {
      const expression = loadTestExpression('complex-realistic');

      const start = Date.now();
      await witnessSearcher.search(expression, moodRegimeConstraints);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(6000); // 5s timeout + 1s overhead
    });

    it('scales reasonably with expression complexity', async () => {
      const times = [];

      for (const clauseCount of [5, 10, 20, 50]) {
        const expression = createExpressionWithNClauses(clauseCount);
        const start = Date.now();
        await witnessSearcher.search(expression, moodRegimeConstraints);
        times.push({ clauseCount, elapsed: Date.now() - start });
      }

      // Should be roughly O(n) in clause count
      const ratio = times[3].elapsed / times[0].elapsed;
      expect(ratio).toBeLessThan(20); // 50/5 = 10x clauses, allow 20x time
    });
  });

  describe('Importance Sampling Performance', () => {
    it('completes validation within reasonable time', async () => {
      const contexts = generateMockContexts(5000);

      const start = Date.now();
      await validator.validate(proposal, contexts, expression);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeLessThan(10000); // 10 seconds
    });

    it('scales linearly with context count', async () => {
      const times = [];

      for (const count of [100, 500, 1000, 5000]) {
        const contexts = generateMockContexts(count);
        const start = Date.now();
        await validator.validate(proposal, contexts, expression);
        times.push({ count, elapsed: Date.now() - start });
      }

      // Should be O(n) in context count
      const ratio = times[3].elapsed / times[0].elapsed;
      expect(ratio).toBeLessThan(100); // 5000/100 = 50x contexts, allow 100x time
    });
  });

  describe('Memory Usage', () => {
    it('witness search memory stays bounded', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        await witnessSearcher.search(expression, moodRegimeConstraints);
      }

      // Force GC if available
      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const growth = finalMemory - initialMemory;

      expect(growth).toBeLessThan(50 * 1024 * 1024); // < 50MB growth
    });

    it('edit generation does not leak memory', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < 10; i++) {
        await editSetGenerator.generate(simResult, { targetBand: [0.0001, 0.001] });
      }

      if (global.gc) global.gc();

      const finalMemory = process.memoryUsage().heapUsed;
      const growth = finalMemory - initialMemory;

      expect(growth).toBeLessThan(30 * 1024 * 1024); // < 30MB growth
    });
  });
});
```

---

## File Inventory

### New Files

| File | Purpose | Est. LOC |
|------|---------|----------|
| `src/expressionDiagnostics/config/actionabilityConfig.js` | Configuration | 80 |
| `src/expressionDiagnostics/services/MinimalBlockerSetCalculator.js` | Core blocker identification | 200 |
| `src/expressionDiagnostics/services/ConstructiveWitnessSearcher.js` | Witness search algorithm | 350 |
| `src/expressionDiagnostics/services/WitnessOptimizationService.js` | Adjustment calculation | 150 |
| `src/expressionDiagnostics/services/OrBlockAnalyzer.js` | OR alternative analysis | 250 |
| `src/expressionDiagnostics/services/EditSetGenerator.js` | Edit proposal generation | 300 |
| `src/expressionDiagnostics/services/ImportanceSamplingValidator.js` | Prediction validation | 200 |
| `src/expressionDiagnostics/services/RarityBandTargeter.js` | Target band calculations | 120 |
| `src/expressionDiagnostics/services/sectionGenerators/ActionabilitySectionGenerator.js` | Report formatting | 300 |
| `tests/unit/expressionDiagnostics/services/minimalBlockerSetCalculator.test.js` | Unit tests | 300 |
| `tests/unit/expressionDiagnostics/services/constructiveWitnessSearcher.test.js` | Unit tests | 400 |
| `tests/unit/expressionDiagnostics/services/orBlockAnalyzer.test.js` | Unit tests | 250 |
| `tests/unit/expressionDiagnostics/services/editSetGenerator.test.js` | Unit tests | 300 |
| `tests/unit/expressionDiagnostics/services/importanceSamplingValidator.test.js` | Unit tests | 250 |
| `tests/integration/expressionDiagnostics/monteCarloActionability.integration.test.js` | Integration tests | 400 |
| `tests/performance/monteCarloActionability.performance.test.js` | Performance tests | 200 |

**New files total**: ~4,050 LOC

### Modified Files

| File | Changes | Est. LOC Δ |
|------|---------|------------|
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Wire new services | +80 |
| `src/expressionDiagnostics/services/RecommendationEngine.js` | Add OR restructure recommendations | +100 |
| `src/expressionDiagnostics/services/RecommendationFactsBuilder.js` | Add actionability facts | +80 |
| `src/expressionDiagnostics/services/sectionGenerators/SensitivitySectionGenerator.js` | Add threshold suggestions for non-zero | +60 |
| `src/expressionDiagnostics/services/sectionGenerators/BlockerSectionGenerator.js` | Integrate core blocker summary | +50 |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | New tokens | +15 |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Register new services | +50 |

**Modified files total**: ~435 LOC

**Grand total**: ~4,485 LOC

---

## Success Criteria

### Functional Criteria

| Feature | Criterion | Validation Method |
|---------|-----------|-------------------|
| Minimal Blocker Set | Core blockers correctly identified with >90% accuracy | Manual analysis comparison |
| Witness Search | Finds candidate with AND score ≥0.8 for 80%+ of near-feasible expressions | Automated test suite |
| Witness Search | Completes within 5s for typical expressions | Performance tests |
| OR Restructure | Dead-weight alternatives identified with 0% false negatives | Integration tests |
| Edit Set | Primary recommendation hits target band 70%+ of time | Re-simulation validation |
| Edit Set | Confidence intervals calibrated (95% CI contains true rate 90%+ of time) | Statistical validation |

### User Experience Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Time-to-tune reduction | 50%+ | User feedback survey |
| "Next Actions" usefulness | 4/5 rating | User feedback survey |
| Report comprehensibility | Non-technical users understand recommendations | User testing |

### Technical Criteria

| Criterion | Target | Measurement |
|-----------|--------|-------------|
| Test coverage | 80%+ branches, 90%+ lines | Coverage reports |
| Performance overhead | <10% increase in report generation time | Performance benchmarks |
| Memory overhead | <20% increase in peak memory | Memory profiling |
| No regressions | All existing tests pass | CI pipeline |

---

## Open Questions

1. **Search Algorithm Trade-offs**: Should we implement LP approximation for expressions with linear constraints, or is hill-climb sufficient for all practical cases?

2. **OR Replacement Suggestions**: How should we generate meaningful replacement suggestions for dead-weight OR alternatives? Options:
   - Query existing clause patterns in the codebase
   - Use AI/LLM to suggest alternatives
   - Leave as manual decision (current recommendation)

3. **Importance Sampling Efficiency**: What sample size is needed for reliable estimates at 0.01% target rates? Current estimate: 2,000-5,000 stored contexts.

4. **UI Presentation**: Should "Next Actions" be a separate collapsible section or integrated into each existing section?

5. **Caching Strategy**: Should witness search results and edit proposals be cached for iterative tuning sessions?

6. **Combinatorial Edits**: Should the edit set generator explore combinations of edits, or focus on single-edit proposals for simplicity?

---

## References

- Brainstorming source: `brainstorming/monte-carlo-improvements.md`
- Related spec (metrics): `specs/monte-carlo-advanced-metrics.md`
- Related spec (clarity): `specs/monte-carlo-report-clarity-improvements.md`
- Core implementation: `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- Report implementation: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
