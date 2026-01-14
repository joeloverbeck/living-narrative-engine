# Improvements for the Monte Carlo simulator

## Goals

Correctness: OR-block pass/fail rates must reflect actual evaluation over samples, not independence math.

Explainability: Report metrics must be unambiguous about population (full sample vs stored vs mood-regime).

Actionability: Recommendations must cite the true choke (gate vs threshold vs regime) and avoid misleading evidence.

Regression Safety: Add invariants + tests covering OR unions, recommendation impact attribution, and confidence labeling.

## Non-goals

Do not change sampling strategy, Monte Carlo generation, or the prototype math itself.

Do not redesign the full report layout—only add small sections and adjust labels/fields.

## Implementation Changes
1.1 OR-block evaluation must use true union (no independence approximation)
### Problem

You currently compute OR-block fail% like ∏ fail_i, which assumes independence and contradicts the union counts you already compute.

### Required Change

For every OR block encountered in a prerequisite tree:

Compute:

passCount = count(samples where OR expr == true)

failCount = N - passCount

passRate = passCount / N

failRate = failCount / N

Use this value everywhere:

“Combined OR Block pass rate”

“Fail% global”

“Fail% | mood-pass”

Any “worst offender” ranking that references the OR block

### Optional (but recommended)

If you still want the independence product, compute it as:

independenceFailEstimate = ∏ leafFailRates
but display it only as an explicitly labeled estimate:

“Independence estimate (diagnostic only)”

Acceptance Criteria

Reported OR-block fail% equals 1 - (unionPassCount / N) within floating rounding error.

OR block coverage tables and combined pass rate match exactly.

## 1.2 OR-block coverage must include overlap (union/intersection breakdown)
### Required additions (computed per population)

For OR block with alternatives A, B, C…:

P(A), P(B), …

P(union) = P(A ∪ B ∪ …)

For pairs (at minimum top 2 alts by pass):

P(A ∩ B)

P(A only) (exclusive)

P(B only) (exclusive)

### Output fields

Add a small “OR overlap” table:

Alt | P(pass) | P(exclusive) | P(overlap with top alt)

### Acceptance Criteria

sum(exclusive_i) <= union

union == sum(exclusive_i) + overlapMass (overlapMass computed)

## 1.3 Recommendation “Impact” must be defined and consistent (especially for OR alternatives)
### Problem

You’re assigning the same impact to multiple OR alternatives, which reads like a bug.

Definitions (choose one; this spec makes it deterministic)
Impact definition

Impact (full sample) = percentage-point increase in expression trigger rate if this clause (or block) were forcibly satisfied, holding all else constant in stored sample (ablation style).

### Required rules

If recommendation targets an OR block, impact is computed for the block.

If recommendation targets an OR alternative, you must compute alt-attributed impact:

impactAlt = impactBlock * P(alt exclusively passes | OR passes)
using the exclusive coverage computed in 1.2.

### Output

For OR alternative recommendations, print:

Impact (allocated from OR block): X pp

Allocation basis: exclusive share = Y%

### Acceptance Criteria

Sum of impacts across OR alternatives ≤ OR block impact (+ tiny rounding).
No two OR alternatives show identical impact unless their exclusive shares are identical.

## 1.4 Recommendation evidence must separate “Gate choke” vs “Threshold choke”
### Problem

Axis-sign-conflict recommendations currently cite gate fail rates even when the threshold passes easily given gate pass (or vice versa), which is causally misleading.

### Required change

When generating evidence for any thresholded emotion clause:

Compute:

gateFailRate (within population)

passGivenGate = P(threshold passes | gate passes)

passInPopulation = P(threshold passes | population)

Classify choke type:

If gateFailRate is high and passGivenGate is high → Gate choke

If gateFailRate is low and passGivenGate is low → Threshold choke

If both bad → Mixed choke

### Evidence output template

Choke type: gate / threshold / mixed

Gate: gateFailRate + which gate(s) fail most

Threshold: passGivenGate + typical shortfall (median gap) when failing

### Axis-sign-conflict gating

Only emit axis_sign_conflict when:

clause operator is >= or > (as you already planned)

AND the clause is a threshold choke or mixed choke

AND passGivenGate is not already “basically always” (e.g. ≥ 95%)

### Acceptance Criteria

A clause with passGivenGate >= 0.95 does not get an axis-sign-conflict recommendation.

Evidence never includes gate stats as primary evidence for a pure threshold choke (and vice versa).

## 1.5 Add “confidence” labels that reference the correct population
### Problem

“Low confidence (<5 hits)” is correct for stored contexts but looks contradictory to full-sample hits.

### Required change

Whenever you show warnings about hit-count confidence, include:

population name + N + hits in that population
Example:

“Low confidence: stored-global (N=10,000) baseline hits=1 (<5).”

### Acceptance Criteria

Confidence badges/warnings always include the population they refer to.

## 1.6 Detect and label “trivially true due to clamp-to-zero” caps
### Problem

Many <= caps pass because the underlying emotion is structurally clamped to 0 in the regime (gate pass = 0%).

### Required classification

For any <= or < clause on an emotion intensity:

If in mood-regime gatePassRate == 0% and max(finalIntensity) == 0:

label clause as Trivially satisfied (clamped).

mark as Redundant in regime = yes (clamp)

### Optional recommendation type

redundant_cap_due_to_gate_incompatibility:

emitted when a cap is “clamped-trivial” in the mood regime.

### Acceptance Criteria

Such clauses are no longer reported as meaningful blockers.

They do not appear in “Worst offender” rankings.

## 2) Invariants (must hold)
2.1 OR correctness

OR.passCount == count(samples where ORExpr evaluates true)

OR.failCount == N - OR.passCount

OR.passRate + OR.failRate == 1 (±1e-12)

2.2 OR decomposition

unionPass >= max(altPass)

sum(exclusivePassCounts) <= unionPass

unionPass == sum(exclusivePassCounts) + overlapPassCount

2.3 Recommendation attribution

If alternative impacts are shown:

sum(impactAlt) <= impactBlock + ε

2.4 Gate/threshold evidence consistency

For every threshold clause:

passInPopulation == gatePassRate * passGivenGate (within rounding)

2.5 Population labeling

Every metric/warning must specify:

which population it was computed on (full / mood-regime / stored-global / stored-mood-regime)

## 3) Tests (must pass)

Assuming Jest/unit tests in your repo.

3.1 OR union correctness tests
Test: orBlockUsesUnionNotIndependence

Construct synthetic sample set where two alts are highly correlated.

Ensure:

computed OR fail rate equals actual union

independence estimate (if present) differs

Example scenario:

100 samples

A true in 20, B true in same 20 (perfect overlap)

union pass = 20, not 36

independence predicts 1 - (0.8*0.8)=36% pass → wrong

3.2 OR overlap breakdown tests
Test: orBlockExclusiveAndOverlapSumToUnion

Using known synthetic evaluation results, assert:

union = exclusiveA + exclusiveB + overlap

3.3 Recommendation impact allocation tests
Test: orAlternativeImpactAllocatedByExclusiveShare

Provide:

blockImpact = 10pp

exclusive shares: A=0.7, B=0.3

Assert alt impacts are 7pp and 3pp.

3.4 Gate vs threshold choke classification tests
Test: axisSignConflictSuppressedWhenPassGivenGateHigh

clause: sadness >= 0.5

gatePass=0.2, passGivenGate=0.98 → gate choke

Assert no axis_sign_conflict recommendation.

Test: axisSignConflictEmittedForThresholdChoke

gatePass=0.9, passGivenGate=0.2

Assert axis_sign_conflict emitted if conflict present.

3.5 Clamp-trivial caps tests
Test: capMarkedTrivialWhenGatePassZeroAndMaxZero

mood-regime: gatePassRate = 0, max(final)=0

cap: panic <= 0.25

Assert:

redundant flag is set

clause excluded from “worst offender”

3.6 Population-specific confidence message tests
Test: confidenceWarningIncludesPopulationAndHitCount

Trigger global hits >= 5 but stored hits < 5

Assert warning text includes “stored-global” and correct stored hits.

## 4) UI / Report Improvements (minimal, high leverage)
4.1 Add a “Probability Funnel” section (top of blocker analysis)

Show counts at each stage:

Full samples

Mood-regime pass

Gate pass for key threshold clauses (optional)

OR#1 union pass

OR#2 union pass

Final triggers

Acceptance:

All counts are computable from already-evaluated booleans; no resampling.

4.2 Standardize unit display (raw + normalized)

Wherever you show a mood constraint:

display: rawRange → normalizedRange
Example:

arousal ∈ [-35, 20] → [-0.35, 0.20]

4.3 OR block panel changes

For each OR block:

Replace “Combined OR Block: 17.33% pass rate” with union-based rate.

Add overlap table (1.2).

If independence estimate shown, label as “diagnostic estimate”.

4.4 Improve “Worst offenders”

Always show both global and mood-regime fail% if applicable.

Exclude clamp-trivial caps and regime-redundant conditions from ranking by default (toggle to include).

4.5 Recommendation cards: explicit “choke type”

Add one line:

Choke type: gate / threshold / mixed / trivial(clamped)
and show the 2–3 most relevant metrics for that type.

## 6) Definition of Done

OR block combined rates match union evaluation and do not contradict coverage counts.

Recommendation impacts are consistent and OR alternatives aren’t double-counting block impact.

Axis-sign-conflict recommendations only fire when they’re actually relevant to threshold feasibility.

Clamp-trivial caps are clearly labeled, de-emphasized, and optionally recommended for pruning.

New tests cover all above and pass.