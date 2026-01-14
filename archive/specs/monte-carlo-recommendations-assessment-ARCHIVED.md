# Monte Carlo recommendations - ChatGPT assessment review

## Scope

Review of claims in `brainstorming/assessment-of-our-monte-carlo-recommendations.md` against the current recommendations implementation.

Primary implementation points:
- `src/expressionDiagnostics/services/RecommendationEngine.js`
- `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js`

## Current implementation (summary)

- Recommendations are generated only for the top 3 impact clauses with prototype references.
- Recommendation type is always `prototype_mismatch`.
- Signals:
  - `gateMismatch`: `gateFailRate >= 0.25` (no clause direction check).
  - `thresholdMismatch`: `pThreshGivenGate <= 0.1` and `meanValueGivenGate <= threshold - 0.15`.
  - `axisConflict`: `compatibilityScore <= -0.25` (gate compatibility only).
- Confidence is based only on `moodSampleCount` thresholds.
- Recommendation actions are generic and driven by which flags were triggered.
- Prototype evaluation uses HARD gating (gate fail => value = 0).

## Claim-by-claim assessment

Each item includes:
- Correctness: whether the claim about current behavior or logic is accurate.
- Desirability: whether the suggested change should be pursued.

### 1) "Reasoning is skewed toward gate mismatch and misses the strongest structural signal (axis sign conflict)"
- Correctness: **Mostly correct**. The recommendation engine does not consider prototype weights vs regime constraints. It only uses gate failure rate and gate compatibility. Any "axis sign conflict" in the report is not used in recommendations.
- Desirability: **Yes**, if we want explanations to align with the Prototype Math section. This requires either exposing the PrototypeConstraintAnalyzer output (weights/conflict types) to the recommendation facts or recomputing similar signals inside the engine.

### 2) "Rec 1: strongest mismatch is affiliation weight negative vs regime requires affiliation >= min"
- Correctness: **Not verifiable in code alone**. PrototypeConstraintAnalyzer can detect `negative_weight_high_min` conflicts and compute contribution deltas, but this specific mismatch depends on runtime data.
- Desirability: **Conditional**. If the report shows this conflict, surfacing it in recommendations would be desirable; otherwise it risks being misleading. This needs explicit evidence wiring.

### 3) "Rec 2: gate mismatch framing is wrong for <= clauses under HARD gating"
- Correctness: **Correct**. HARD gating sets value to 0 on gate failure (`MonteCarloSimulator`), which makes `<=` clauses easier to satisfy. RecommendationEngine does not check clause operator, so it can incorrectly flag gate mismatch for `<=` clauses.
- Desirability: **Yes**. Clause direction awareness should prevent gate-related mismatch recommendations for `<=` unless the gating model changes.

### 4) "Split prototype_mismatch into axis_sign_conflict and gate/regime incompatibility"
- Correctness: **Correct about current blending**. The current type is a single `prototype_mismatch` with mixed triggers.
- Desirability: **Yes**, if we want clearer actions. Would require adding signals for weight/regime conflicts and separating them from gate compatibility and gate failure.

### 5) "Add axis_sign_conflict detection using weight sign vs regime direction"
- Correctness: **Conceptually correct**. PrototypeConstraintAnalyzer already computes binding axes and conflict types (`positive_weight_low_max`, `negative_weight_high_min`). However, this is not used in recommendations.
- Desirability: **Yes**, with caveats. This is a strong explanatory signal. Implementation requires passing axis constraints and prototype weights into RecommendationFactsBuilder or reusing the analyzer output.

### 6) "Gate mismatch for >= should be based on lost passes (raw >= t but final < t)"
- Correctness: **Correct**. Current logic uses only `gateFailRate >= 0.25`, which is not directly tied to threshold loss. Prototype evaluation already computes `rawScore` and `value` but we do not track threshold-specific lost-pass counts.
- Desirability: **Yes**, more precise. Requires storing per-prototype raw scores or counters keyed by clause threshold and operator.

### 7) "Gate incompatible (regime makes gate impossible) deserves its own recommendation"
- Correctness: **Correct**. Gate incompatibility is computed in `gateCompatibility`, but only used as a weak `axisConflict` indicator in `RecommendationEngine`.
- Desirability: **Yes**, if we want to explicitly call out "always clamped to 0" cases, which is actionable and avoids overloading `prototype_mismatch`.

### 8) "Make actions more specific (swap prototype, change regime, create subtype, lower threshold from sensitivity)"
- Correctness: **Correct about current vagueness**. Current actions are generic and do not use prototype fit or sensitivity tables.
- Desirability: **Partial**. More specific actions would be useful, but require additional data (prototype fit rankings, sensitivity sweep summaries). Should be added only when those inputs are already available in the diagnostic facts.

### 9) "Add clause direction awareness so <= doesn’t get gate mismatch guidance"
- Correctness: **Correct**. Clause operator is not passed into recommendations, so direction-aware logic is currently impossible.
- Desirability: **Yes**, and should be a prerequisite for any gate-related signals.

### 10) "Add primary decisive leaf blocker summary (sole-blocker)"
- Correctness: **Correct**. Current recommendations do not surface sole-blocker stats; those are part of other analysis paths and are not in the recommendation facts.
- Desirability: **Optional**. It could be useful for prioritization, but it is orthogonal to prototype mismatch logic. Would require plumbing last-mile/sole-blocker data into the recommendations section.

### 11) "Confidence should penalize stored-context sensitivity / coverage gaps"
- Correctness: **Correct**. Recommendation confidence is currently based only on mood sample count; no sensitivity or coverage signals are used.
- Desirability: **Optional**. Helpful if recommendations start relying on sensitivity sweeps or stored-context-only evidence; not critical for the current gate/threshold mismatches.

### 12) "Hatred clause should be treated as a design choice; recommend softer caps or sibling emotion caps"
- Correctness: **Design judgment**. The current system has no semantic intent model. This is not a correctness issue in code.
- Desirability: **Conditional**. Could be a nice UX enhancement, but it requires domain heuristics to avoid prescriptive changes in cases where hard caps are intentional.

## Suggested specification (if we proceed)

- Add clause operator and threshold info into diagnostic facts so recommendations can be direction-aware.
- Add a new recommendation type for gate incompatibility with explicit "always clamped" messaging.
- Add a new recommendation type for axis sign conflicts using PrototypeConstraintAnalyzer output, including conflict type and contribution deltas.
- Replace gate mismatch trigger with a lost-pass metric for `>=` clauses only.
- Keep the existing `prototype_mismatch` type for pure threshold mismatch cases, or rename it to `threshold_underflow` for clarity.

## Open questions

- Should recommendations ever reference Prototype Fit rankings, or is that too prescriptive for automated output?
- Should we treat "<=" clauses as semantically intentional by default to avoid overfitting to Monte Carlo stats?
- Are we willing to recompute PrototypeConstraintAnalyzer output inside RecommendationFactsBuilder (data registry dependency), or should it be passed in from the simulator/report pipeline?
