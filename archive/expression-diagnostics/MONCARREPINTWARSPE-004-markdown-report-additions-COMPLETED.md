# MONCARREPINTWARSPE-004: Markdown Report Integrity Additions

**Status:** Completed

## Summary

Add integrity and gating context to the Monte Carlo Markdown report so readers understand hard-gating, signal lineage/scales, and how integrity warnings impact downstream metrics.

## Background

The spec calls for explicit report messaging about hard-gate behavior, signal lineage, and integrity-warning impact on downstream statistics.

## Assumptions Check (Updated)

- The report already renders a **Report Integrity Warnings** section that lists warning codes and sample indices, plus an impact note when I* warnings exist.
- Condition Breakdown tables already show **Gate clamp (mood)** and **Pass | gate (mood)** for emotion-threshold leaves, but do **not** yet show P(gatePass | mood) or P(thresholdPass | mood).
- No existing header line calls out the hard-gate model, and there is no concise, dedicated signal lineage section near the top of the report.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js`

## Out of Scope (MUST NOT Change)

- Monte Carlo simulation logic or sample storage.
- Expression Diagnostics UI content and layout.
- Any normalization or gate evaluation logic.

## Implementation Details

- Add a header line near the report title: `Gating model: HARD (gate fail => final = 0)`.
- Add an integrity summary block near the top of the report: warning count, affected prototypes, example indices, and a note that gate-dependent metrics are unreliable when mismatches exist.
- Add a short signal lineage section describing raw -> gated -> final signals and numeric scales for gate inputs.
- Extend condition breakdown tables for emotion-threshold clauses to show a gate-aware pass-rate split: P(gatePass|mood), P(thresholdPass|gatePass,mood), P(thresholdPass|mood). Keep existing gate clamp/pass|gate columns if they remain useful, but avoid removing current data.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="MonteCarloReportGenerator" --coverage=false`

### Invariants That Must Remain True

1. Report output remains valid Markdown.
2. Existing report sections keep their ordering unless the new blocks require localized insertions.
3. Report generation still succeeds for runs without integrity warnings.

## Outcome

- Added a gating-model line, integrity summary block, and signal lineage section near the top of the Markdown report.
- Extended condition breakdown tables to expose gate-pass and pass|mood rates alongside the existing gate clamp/pass|gate split.
- Updated report legend and tests to reflect the new report content and gate-aware columns.
- Scope corrected to reflect that Report Integrity Warnings already existed; the ticket focused on concise summary/context additions.
