# Monte Carlo Simulator Improvements Review

## Scope
Reviewed `brainstorming/improvements-monte-carlo-simulator.md` against current Monte Carlo report and recommendation code to validate the stated problems and decide which changes are worth implementing. Evidence references point to the current implementation.

## Assessment of Claims

### 1.1 OR-block evaluation uses independence math
- **Claim correctness**: **Correct.** The report uses independence math in `#calculateOrPassRate` (product of child failure rates), which can diverge from actual union counts when alternatives are correlated.
- **Evidence**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (method `#calculateOrPassRate`).
- **Benefit**: **High.** Fixing this removes incorrect OR-block pass/fail reporting and aligns with the already-recorded union counts.

### 1.2 OR-block coverage must include overlap
- **Claim correctness**: **Partially correct.** The report already shows alternative pass/exclusive rates, but they are conditional on OR success (P(alt | OR pass)) and do not include global union/overlap rates or explicit intersections.
- **Evidence**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (`#generateOrContributionBreakdown` uses `orPassRate` and `orExclusivePassRate` which are conditional on OR success; no global union/overlap table).
- **Benefit**: **Medium-High.** Absolute union/exclusive/overlap rates improve interpretability and make OR block coverage non-ambiguous.

### 1.3 Recommendation impact allocation for OR alternatives
- **Claim correctness**: **Unconfirmed.** Recommendations are currently tied to a single clause ID, and impact is pulled directly from ablation impact for that clause. There is no OR-block-level impact or multi-clause impact in the current pipeline, so “duplicate impact” is not inherently a bug.
- **Evidence**: `src/expressionDiagnostics/services/RecommendationEngine.js` (recommendations use a single `relatedClauseIds` entry), `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (`#resolveRecommendationImpact` selects first matching clause ID).
- **Benefit**: **Conditional.** Useful if you plan to add OR-block recommendations or multi-alternative attribution. Not required for current behavior.

### 1.4 Gate vs threshold choke evidence and axis-sign-conflict gating
- **Claim correctness**: **Correct.** Evidence always mixes gate fail rate and pass|gate without labeling a choke type, and axis-sign-conflict is triggered purely by operator + conflicts, not by feasibility.
- **Evidence**: `src/expressionDiagnostics/services/RecommendationEngine.js` (`axisSignConflict` has no pass|gate gating; evidence always includes gate/pass|gate).
- **Benefit**: **High.** Distinguishing gate vs threshold chokes avoids misleading recommendations and reduces false positives.

### 1.5 Confidence labels must reference population
- **Claim correctness**: **Correct.** Low-confidence warning is generic and does not include population name or N/hits.
- **Evidence**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (low-confidence warning in sensitivity analysis omits population).
- **Benefit**: **Medium.** Improves interpretability and avoids contradictions with full-sample metrics.

### 1.6 Clamp-trivial caps
- **Claim correctness**: **Partially correct.** Redundancy is already detected (`redundantInRegime`), but the report does not explain when redundancy is due to gate clamp-to-zero, and such clauses still appear in rankings.
- **Evidence**: `src/expressionDiagnostics/models/HierarchicalClauseNode.js` (`redundantInRegime`), `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (worst offenders include redundant clauses).
- **Benefit**: **Medium.** Labeling and de-prioritizing clamp-trivial caps reduces noise in blocker lists.

### 4.x UI/report improvements
- **4.1 Probability funnel**: **Beneficial**. Not present today; can be computed from existing counts.
- **4.2 Raw + normalized unit display**: **Optional**. Useful for clarity; not required for correctness.
- **4.3 OR panel updates**: **Beneficial** but overlaps with 1.1/1.2.
- **4.4 Worst offenders updates**: **Partially done** (global + mood-pass already shown); excluding clamp-trivial is still beneficial.
- **4.5 Choke type on recommendation cards**: **Beneficial** as part of 1.4.

## Implementation Specifications (Beneficial Changes)

### A) OR-block union rates (replace independence approximation)
**Goal**: Use actual OR evaluation counts for combined pass/fail rates and align these with existing OR coverage.
- **Data source**: OR node `failureCount` / `evaluationCount` (already tracked during simulation).
- **Implementation**:
  - Replace `#calculateOrPassRate` in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` to use `orBlock.node` pass/fail counts.
  - Compute: `passCount = evaluationCount - failureCount`, `passRate = passCount / evaluationCount`.
  - For mood regime: use `inRegimeEvaluationCount` and `inRegimeFailureCount` for `passRateInRegime`.
  - Keep independence estimate only if labeled “diagnostic estimate”.
- **Acceptance**:
  - OR combined pass rate equals actual union rate within rounding error.

### B) OR overlap breakdown with absolute rates
**Goal**: Provide P(A), P(B), P(union), P(A only), and a top-pair overlap using population-level counts.
- **Data additions**:
  - Add per-OR-block counters for **in-regime** success and per-child pass/exclusive counts in regime.
  - Add per-OR-block pairwise pass counts (at least for top two by pass rate); store for global + in-regime.
- **Simulation changes**:
  - In `src/expressionDiagnostics/services/MonteCarloSimulator.js` within OR evaluation, track:
    - `orSuccessCount` at the OR node (global + in-regime).
    - `orPassCount`/`orExclusivePassCount` in-regime for each child.
    - Pairwise pass counts for children that pass in a sample (increment all pass pairs).
- **Report changes**:
  - In `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`, add an “OR overlap” table per OR block:
    - `P(alt passes)` = `altPassCount / sampleCount`.
    - `P(alt exclusive)` = `altExclusivePassCount / sampleCount`.
    - `P(overlap with top alt)` = `pairPassCount / sampleCount`.
    - `P(union)` = `orPassCount / sampleCount`.
  - Include both global and mood-regime populations when available.
- **Acceptance**:
  - `sum(exclusive) <= union` and `union == sum(exclusive) + overlapMass` (within epsilon).

### C) Gate vs threshold choke classification + axis-sign-conflict gating
**Goal**: Label and rank recommendations based on whether failures are caused by gates, thresholds, or both.
- **Data usage**:
  - Use prototype stats already available: `gateFailRate`, `pThreshGivenGate`, `gatePassRate`, `meanValueGivenGate`.
- **Implementation**:
  - Add a `chokeType` classifier in `src/expressionDiagnostics/services/RecommendationEngine.js`.
  - Emit evidence based on choke type:
    - **Gate choke**: emphasize gate fail rate + failed gate IDs.
    - **Threshold choke**: emphasize pass|gate + median shortfall (gap).
    - **Mixed**: include both.
  - Gate `axis_sign_conflict` recommendations:
    - Only emit for `>=`/`>` clauses when `passGivenGate < 0.95` **and** choke type is threshold or mixed.
- **Acceptance**:
  - Axis-sign-conflict does not trigger for high `passGivenGate` gate-chokes.
  - Evidence aligns with choke type.

### D) Population-specific confidence labels
**Goal**: Low-confidence warnings explicitly show population, N, and hits.
- **Implementation**:
  - Update low-confidence warning in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` to include:
    - population label (e.g., `stored-global`, `full sample`).
    - `N` and estimated hits.
- **Acceptance**:
  - Every confidence warning names its population and counts.

### E) Clamp-trivial caps labeling + de-prioritization
**Goal**: Detect when `<=`/`<` clauses are trivially satisfied because the gate clamps intensity to zero.
- **Data usage**:
  - `gatePassRateInRegime` and `inRegimeMaxObservedValue` from `HierarchicalClauseNode`.
- **Implementation**:
  - Add a derived flag on clause/leaf: `clampTrivialInRegime` when:
    - operator is `<=` or `<` **and** `gatePassRateInRegime === 0` **and** `inRegimeMaxObservedValue === 0`.
  - Update report rendering to:
    - label these clauses as “Trivially satisfied (clamped)”.
    - exclude them from worst offender ranking by default.
- **Acceptance**:
  - Clamp-trivial clauses do not appear in worst offender lists unless explicitly included.

### F) Probability funnel section
**Goal**: Add a simple, computed funnel to show where probability mass drops off.
- **Implementation**:
  - In `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`, add a “Probability Funnel” section in the blocker analysis:
    - Full samples.
    - Mood-regime pass count.
    - Gate pass count for key threshold clauses (top 1-2 by impact).
    - OR block union pass count (per OR block).
    - Final trigger count.
- **Acceptance**:
  - All counts are computed from existing sample stats; no resampling.

### G) Optional: raw + normalized unit display for constraints
**Goal**: Reduce ambiguity when displaying mood constraints.
- **Implementation**:
  - When printing constraint ranges, include both raw and normalized values (e.g., `[-35, 20] -> [-0.35, 0.20]`).
  - Use existing normalization helpers in `MonteCarloReportGenerator`.
- **Benefit**: Low risk, helps interpretation.

## Test Specifications (aligns with requested tests)
- Add unit tests under `tests/unit/expressionDiagnostics/services/` for:
  - OR union correctness (correlated alternatives) using `MonteCarloReportGenerator` or simulator stats.
  - OR overlap decomposition (exclusive + overlap sums to union).
  - Axis-sign-conflict suppression when `passGivenGate` is high.
  - Clamp-trivial detection and exclusion from worst offenders.
  - Confidence warning includes population + counts.

## Notes / Deferrals
- OR alternative impact allocation is not currently required because recommendations are clause-level; add this only if OR-block recommendations or multi-clause impacts are introduced later.
