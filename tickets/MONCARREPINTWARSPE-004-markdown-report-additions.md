# MONCARREPINTWARSPE-004: Markdown Report Integrity Additions

## Summary

Add integrity and gating context to the Monte Carlo Markdown report so readers understand hard-gating, scales, and invalidated metrics.

## Background

The spec calls for explicit report messaging about hard-gate behavior, signal lineage, and integrity-warning impact on downstream statistics.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or sample storage.
- Expression Diagnostics UI content and layout.
- Any normalization or gate evaluation logic.

## Implementation Details

- Add a header line near the report title: `Gating model: HARD (gate fail => final = 0)`.
- Add an integrity summary block: mismatch count, affected prototypes, example indices, and a note that gate-dependent metrics are unreliable when mismatches exist.
- Add a short signal lineage section describing raw -> gated -> final signals and numeric scales for gate inputs.
- Add a gate-aware pass-rate split for threshold clauses: P(gatePass|mood), P(thresholdPass|gatePass,mood), P(thresholdPass|mood).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="MonteCarloReportGenerator" --coverage=false`

### Invariants That Must Remain True

1. Report output remains valid Markdown.
2. Existing report sections keep their ordering unless the new blocks require localized insertions.
3. Report generation still succeeds for runs without integrity warnings.
