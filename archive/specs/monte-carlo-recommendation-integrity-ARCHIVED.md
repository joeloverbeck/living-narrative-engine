# Monte Carlo Recommendation Integrity Updates

## Goal

Make Monte Carlo recommendations deterministic, traceable, and semantically correct by:
- Computing axis sign conflicts with explicit magnitude and sources.
- Defining and labeling Impact with a single population.
- Fixing gate incompatibility messaging for <= clauses.
- Improving sampling coverage labels when distributions are zero-inflated or clamped.
- Printing population labels for all recommendation evidence and tables.

## Non-Goals

- Reworking Monte Carlo sampling distributions or random state generators.
- Changing the ablation algorithm itself (Impact definition remains ablation-based).
- Overhauling the UI layout; only add labels/fields needed for clarity.

## Current Issues (Summary)

- Axis sign conflict messaging is non-deterministic, lacks magnitude context, and does not cite prerequisite sources.
- Impact is computed but not explicitly defined or labeled with population/units.
- Gate incompatibility is treated as blocking even for <= clauses where clamping helps satisfy the clause.
- Sampling coverage can be labeled "good" despite zero-inflation or tail starvation.
- Recommendation evidence does not declare the population used for denominators.

## Proposed Changes

### 1) Deterministic Axis Sign Conflict (Recommendation Type `axis_sign_conflict`)

#### Detection (per axis)
Use default bounds for the axis (mood: [-1, 1], sexual: [0, 1], derived axes per existing defaults).

For operator `>=` / `>` clauses only:
- `negative_weight_high_min`: `weight < 0` and `constraintMin > defaultMin`
- `positive_weight_low_max`: `weight > 0` and `constraintMax < defaultMax`

The rule must be applied using the axis’s default bounds, not hard-coded [-1, 1].

#### Magnitude
Let `sumAbsWeights` be the total absolute weights for the prototype.

If `weight < 0`:
- `lost_raw_sum = abs(weight) * (constraintMin - defaultMin)`

If `weight > 0`:
- `lost_raw_sum = abs(weight) * (defaultMax - constraintMax)`

Then:
- `lost_intensity = lost_raw_sum / sumAbsWeights`

Constraints:
- `lost_raw_sum >= 0`
- `lost_raw_sum <= abs(weight) * (defaultMax - defaultMin)`
- `lost_intensity` is only computed if `sumAbsWeights > 0`

#### Sources (Traceability)
Axis constraints must carry source clauses from prerequisites:
- Store the original mood constraint(s) that produce each axis bound.
- Include these source clauses in the recommendation actions (see below).

#### Severity for Axis Conflicts
For `axis_sign_conflict`, ignore ablation Impact and use a relative severity:
- `severity_score = lost_intensity / threshold`
- `low` if `score < 0.15`, `medium` if `0.15 <= score < 0.30`, `high` if `score >= 0.30`

If `threshold` is missing or <= 0, fall back to the existing Impact-based severity.

#### Evidence and Actions
Each axis conflict evidence item must include:
- Axis name
- Weight
- Regime bounds (min/max)
- `lost_raw_sum`
- `lost_intensity`
- Population label (mood-regime unless noted otherwise)

Actions must include explicit “fix knobs”:
- “Relax regime axis bound” with clause(s) that created the bound (use full clause text like `moodAxes.affiliation >= 20`).
- “Adjust prototype weights” with safe moves (e.g., “move weight toward 0” or “reduce magnitude”).

#### Operator Scope
Axis sign conflict recommendations should only be generated for `>=` / `>` clauses, because the current analyzer is based on maximum achievable intensity. Do not emit for `<=` / `<` unless a separate min-achievable analysis is added later.

### 2) Define Impact (Single Population, Explicit Units)

Impact is formally defined as:
```
Impact (full sample) = passWithoutRate - originalPassRate
```

Where both rates are computed over the full Monte Carlo population.

Display requirements:
- Always label as “Impact (full sample)” or “Impact (full)” in UI and report.
- Format in percentage points (pp) with a `+` sign when positive.

Impact must never mix stored-context populations or mood-regime-only samples.

### 3) Gate Incompatibility Semantics for <= Clauses

Gate incompatibility should not be treated as blocking for `<=` / `<` clauses when clamping sets the value to 0:
- For `<=` / `<`: classify as **benign** (or omit the blocking badge entirely).
- For `>=` / `>`: keep **critical/blocking** semantics.

Recommendation generation:
- Do not emit `gate_incompatibility` recommendations for `<=` / `<` clauses.
- If gate incompatibility is still surfaced in static cross-references, annotate as “benign for <= clauses”.

### 4) Sampling Coverage: Zero Inflation and Tail Starvation

Sampling coverage rating must not label a domain “good” if distributions are skewed or zero-inflated.

Add per-variable metrics:
- `zeroRate = count(value == 0) / sampleCount`

Add per-domain aggregates:
- `zeroRateAvg` (mean across variables in domain)

Update coverage conclusions:
- If `tailHigh < 0.1%` (0.001) or `zeroRateAvg >= 0.8`, label domain as **“skewed/zero-inflated”** and suppress the “coverage looks healthy” label.
- Apply only to domains with normalized range [0, 1] (emotions, sexual states).

If a separate “gate clamp rate” is available (from prototype evaluation summary), include it in coverage summaries as a supplemental metric, but do not substitute it for zeroRate.

### 5) Population Labels Everywhere

Every table and recommendation evidence item must explicitly declare the population used:
- Full sample (`full`)
- Mood-regime sample (`mood-regime`)
- Gate-pass within mood-regime (`gate-pass (mood-regime)`)
- Stored contexts (`stored-global`, `stored-mood-regime`)

Implementation approach:
- Add `population` metadata to evidence objects.
- Update UI/report formatters to include “Population: X (N=Y)”.
- Ensure denominators always match the labeled population.

## Data Model Changes

### Axis Constraint Sources
Extend axis constraint structures to retain the originating prerequisite clauses:
```js
{
  min: number,
  max: number,
  sources: Array<{ varPath: string, operator: string, threshold: number }>
}
```

### Axis Conflict Evidence (per conflict)
```js
{
  axis: string,
  weight: number,
  constraintMin: number,
  constraintMax: number,
  defaultMin: number,
  defaultMax: number,
  conflictType: 'negative_weight_high_min' | 'positive_weight_low_max',
  lostRawSum: number,
  lostIntensity: number,
  sources: Array<{ varPath: string, operator: string, threshold: number }>
}
```

### Evidence Items (recommendation UI/report)
```js
{
  label: string,
  numerator: number,
  denominator: number,
  value: number,
  population: { name: string, count: number }
}
```

## Implementation Notes (by Component)

### PrototypeConstraintAnalyzer
- Use axis default bounds when computing `conflictType`.
- Include `defaultMin/defaultMax`, `lostRawSum`, and `lostIntensity` in `axisAnalysis`.
- Preserve existing `sumAbsWeights` for normalization.

### RecommendationFactsBuilder
- Carry axis constraint sources forward into `axisConflicts`.
- Include `lostRawSum` and `lostIntensity` in `axisConflicts`.

### RecommendationEngine
- Emit `axis_sign_conflict` only for `>=` / `>` clauses.
- Build evidence with lost magnitude and population labels.
- Create fix actions that cite the bound-producing clauses.
- Use axis conflict severity scoring based on `lost_intensity / threshold`.
- Skip `gate_incompatibility` for `<=` / `<` clauses.

### Sampling Coverage
- Track `zeroCount` and `zeroRate` per variable.
- Add `zeroRateAvg` to domain summaries.
- Update conclusions to label zero-inflated domains as “skewed/zero-inflated”.

### UI/Report Formatting
- Add population labels to evidence and tables.
- Update Impact formatting to include population and pp units.
- Adjust gate incompatibility display for <= clauses.

## Tests

### Unit Tests (Axis Conflicts)
- Detect `negative_weight_high_min` when `weight < 0` and `constraintMin > defaultMin`.
- Detect `positive_weight_low_max` when `weight > 0` and `constraintMax < defaultMax`.
- Compute `lost_raw_sum` and `lost_intensity` exactly (epsilon 1e-9).
- No conflict when bounds equal defaults.

### Unit Tests (Gate Incompatibility Classification)
- For `<=` clauses, classification is benign/non-blocking.
- For `>=` clauses, classification is blocking/critical.

### Unit Tests (Coverage)
- Zero-inflation triggers “skewed/zero-inflated” label.
- TailHigh < 0.1% suppresses “coverage good”.

### Impact Tests
- Impact uses full sample rates only (no stored context counters).
- Impact formatting includes population label and pp units.

### Integration Tests
Avoid hard-coding counts from live data. Use deterministic fixtures or mocked clause results to validate evidence formatting and population labels.

## Open Questions

- Should axis conflict logic be extended to `<=` clauses via a min-achievable analysis?
- Do we want to show gate incompatibility as “latent risk” for <= clauses instead of hiding it?
- What is the threshold for “zero-inflated” in domains other than [0, 1]?
