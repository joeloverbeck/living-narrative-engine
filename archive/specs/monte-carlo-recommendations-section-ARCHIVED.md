# Monte Carlo Recommendations Section

## Goal

Add a deterministic recommendations section to the Monte Carlo diagnostics UI and report output. The section should surface actionable, data-backed changes that improve trigger rates, and only emit when metrics clear explicit thresholds. The initial implementation targets a single recommendation type: prototype structural mismatch.

## Motivation

Monte Carlo diagnostics already provide pass/fail rates and blockers, but they do not translate those metrics into concrete changes. Content authors need authoritative guidance that is tied to hard evidence and defined invariants, not heuristics. This feature adds a rule-based recommendations layer that is stable, testable, and explainable.

## Scope

- Build a diagnostics facts layer that normalizes per-sample evaluation output into a deterministic facts object.
- Add a recommendation engine that transforms facts into recommendations with confidence, evidence, and actions.
- Render recommendations in both the live UI and the report modal.
- Introduce invariant checks that gate recommendation output.
- Implement only the "prototype structurally mismatched" recommendation for now.

## Non-goals

- No additional recommendation types beyond prototype mismatch in this iteration.
- No changes to the underlying Monte Carlo sampling strategy.
- No UI redesign beyond adding the recommendations section and minimal supporting affordances.

## Related Work

- `specs/monte-carlo-advanced-metrics.md`
- `specs/expression-simulator-evaluation-diagnostics.md`

## Data Model

### DiagnosticFacts

A normalized, computed facts object used to drive deterministic recommendations.

```js
{
  expressionId: string,
  sampleCount: number,
  moodRegime: {
    definition: object,
    sampleCount: number,
  },
  overallPassRate: number,
  clauses: ClauseFacts[],
  prototypes: PrototypeFacts[],
  invariants: InvariantStatus[],
}
```

### ClauseFacts

```js
{
  clauseId: string,
  clauseLabel: string,
  clauseType: 'threshold' | 'delta' | 'compound' | 'other',
  prototypeId: string | null,
  impact: number,
  failRateInMood: number,
  avgViolationInMood: number,
  conditionalFailRate: number | null,
  nearMissRate: number | null,
}
```

### PrototypeFacts

```js
{
  prototypeId: string,
  prototypeLabel: string,
  moodSampleCount: number,
  gateFailCount: number,
  gatePassCount: number,
  thresholdPassGivenGateCount: number,
  thresholdPassCount: number,
  gateFailRate: number,
  pThreshGivenGate: number,
  pThreshEffective: number,
  meanValueGivenGate: number,
  failedGateCounts: Array<{ gateId: string, count: number }>,
  compatibilityScore: number,
}
```

### RecommendationItem

```js
{
  id: string,
  type: 'prototype_mismatch',
  severity: 'high' | 'medium' | 'low',
  confidence: 'high' | 'medium' | 'low',
  title: string,
  why: string,
  evidence: Array<{ label: string, numerator: number, denominator: number, value: number }>,
  actions: string[],
  predictedEffect: string,
  relatedClauseIds: string[],
}
```

## Implementation Plan

### 1) Extend prototype evaluation output

Expose per-sample prototype evaluation details needed for gate statistics.

Required output per prototype per sample:
- `gatesPassed` (boolean)
- `failedGates` (array of stable gate ids)
- `rawScore` (pre-clamp)
- `value` (final 0..1 or domain-appropriate scale)

Implementation notes:
- Ensure the Monte Carlo simulator and any shadow evaluator use identical gate logic.
- Aggregate counts on the fly to avoid retaining full per-sample state.

### 2) Normalize atomic clauses

Create stable, deterministic atomic clause IDs that allow consistent tracking across samples.

Required clause types:
- `var >= c`, `var <= c`
- delta clauses `(var - prevVar) >= d`
- axis direction constraints derived from mood-regime

Compound clauses:
- Rewrite `max([...]) < c` into individual atom children when possible.
- If a compound cannot be decomposed, mark it `clauseType: 'compound'` and assign a stable id derived from its JSON-Logic path.

### 3) Capture logic tree evaluation per sample

Maintain the original AND/OR tree, but track per-sample truth values for each atom to enable ablation without re-running expensive logic.

Algorithm:
- For each sample, evaluate all atoms once and store their booleans in an array keyed by clauseId.
- Evaluate the logic tree using those booleans to determine pass/fail.

### 4) Compute ablation impact (choke order)

Compute `impact(c) = passWithoutC - passOriginal` for each atomic clause and for each top-level subtree.

Implementation options:
- For each sample, re-evaluate the logic tree with a clause forced true. Use a cached tree evaluation path to avoid recomputing atom values.
- Ensure monotonicity: forcing TRUE for an AND subtree must not reduce pass rate.

### 5) Build DiagnosticFacts

Add a new service (recommended: `src/expressionDiagnostics/services/RecommendationFactsBuilder.js`) that accepts Monte Carlo results and returns a `DiagnosticFacts` object.

This builder is responsible for:
- Computing gate rates, threshold pass given gate, and effective pass.
- Summarizing failed gate counts.
- Computing compatibility scores between mood constraints and prototype value.
- Calculating clause impact, conditional failure, and near-miss rate.
- Validating invariants; return violations as `InvariantStatus` entries.

### 6) Recommendation engine

Add a deterministic engine (recommended: `src/expressionDiagnostics/services/RecommendationEngine.js`) that accepts `DiagnosticFacts` and returns a sorted list of recommendations.

#### Rule: Prototype structurally mismatched

Emit a recommendation when all are true:
- The prototype-linked clause is a top-3 choke by impact.
- One of the following holds:
  - Gate mismatch: `gateFailRate >= 0.25`.
  - Weight/threshold mismatch: `pThreshGivenGate <= 0.10` and `meanValueGivenGate <= threshold - 0.15`.
  - Axis conflict: `compatibilityScore <= -0.25`.

Evidence requirements:
- At least two evidence lines with denominators (e.g., gate clamp and pass|gate).
- Include the most frequent failed gate (id and count) when gate mismatch triggers.

Actions (examples, produced as strings):
- Tighten mood-regime axis constraints that allow gate-clamped states.
- Loosen prototype gate threshold or replace the prototype.
- Rebalance prototype weights to align with constrained axes.

Confidence:
- Base on `moodSampleCount` with cutoffs, for example:
  - High: N >= 500
  - Medium: 200 <= N < 500
  - Low: N < 200
- If confidence is low, still include the recommendation but tag it as low and add an explicit uncertainty line.

### 7) UI updates

Add a final section titled "Recommendations" to both live UI and report output.

Requirements:
- Each recommendation renders as a card with title, confidence, impact, evidence, and actions.
- Provide "jump to clause" links for related clause ids.
- Add a "Choke rank" column in the clause table based on impact ranking.
- Add a funnel row for prototype threshold clauses: mood sample count, gate clamp rate, pass|gate, effective pass, impact.
- Do not rely on color alone; use icons or labels to distinguish recommendation types.
- If `moodSampleCount` is below the low-confidence threshold, display a warning banner and mark all recommendations as low confidence.

### 8) Report generator updates

Update `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` to include a markdown section mirroring the UI cards. The section should include evidence with denominators, explicit confidence, and links/anchors that map to clause table entries.

## Invariants

### Probability invariants

- `0 <= rate <= 1` for all rates.
- `gatePassCount <= moodSampleCount`.
- `thresholdPassCount <= gatePassCount`.
- `pThreshEffective == gatePassRate * pThreshGivenGate` within epsilon.

### Logic invariants

- `passWithoutC >= passOriginal` for all clauses.
- Forcing an AND subtree TRUE must not reduce pass rate.

### Recommendation invariants

- Each emitted recommendation includes `id`, `confidence`, and at least two evidence entries with denominators.
- If invariants fail, recommendations are suppressed and a warning is displayed.

## Testing

### Unit tests

- Prototype gating aggregation: verify gate fail count, pass count, failed gate frequency.
- Conditional probability identity for threshold pass rates.
- Ablation monotonicity on a synthetic logic tree.
- Recommendation rule logic for each trigger condition.

### Integration tests

- Gate mismatch scenario emits prototype mismatch with gate evidence.
- Threshold-too-high scenario emits prototype mismatch driven by `pThreshGivenGate` path.
- Noisy cap scenario does not emit prototype mismatch when impact is low.
- Low-sample scenario marks confidence low and includes uncertainty messaging.

### UI tests

- Recommendation cards render required fields.
- Evidence lines include numerator/denominator.
- Choke rank badges appear in clause table.

## Open Questions

- Should compatibilityScore use Pearson correlation or a simpler directional consistency test?
- Should recommendations be suppressed entirely when `moodSampleCount` is below a hard minimum, rather than emitting low confidence?
- Do we need to persist recommendation data in the Monte Carlo result model, or compute it only for report/UI rendering?
