# MONCARRECINT-002: Axis Sign Conflict Recommendations + Severity

## Summary

Update `RecommendationEngine` to emit `axis_sign_conflict` recommendations only for `>=`/`>` clauses, surface deterministic lost magnitude evidence, and score severity using `lostIntensity / threshold`.

## Background

Axis conflict recommendations currently lack deterministic severity and may be emitted for operators outside the supported scope. The spec requires explicit lost magnitude, severity scoring, and fix actions that cite source clauses.

## Assumptions Check (Updated)

- Axis conflict facts already include `lostRawSum`, `lostIntensity`, and `sources` via `RecommendationFactsBuilder` + `PrototypeConstraintAnalyzer`.
- No changes are needed to the analyzer or facts builder; the work is entirely in `RecommendationEngine` plus tests.
- UI/report rendering remains untouched; evidence fields can be extended without formatting changes.

## File List (Expected to Touch)

### Existing Files
- `src/expressionDiagnostics/services/RecommendationEngine.js`
- `tests/unit/expressionDiagnostics/services/recommendationEngine.test.js`

## Out of Scope (MUST NOT Change)

- Prototype constraint extraction logic (handled in MONCARRECINT-001).
- UI/report rendering for recommendations.
- Changes to Monte Carlo sampling or ablation impact calculations.

## Implementation Details

- Gate axis conflict emission behind `>=`/`>` operators only.
- Build evidence entries that include axis, weight, bounds, `lostRawSum`, `lostIntensity`, and population label (mood-regime).
- Compute severity as `lostIntensity / threshold` with low/medium/high bands; fall back to Impact-based severity when threshold is missing or <= 0.
- Add explicit fix actions:
  - “Relax regime axis bound” with the full clause text(s) that created the bound.
  - “Adjust prototype weights” guidance (move weight toward 0 / reduce magnitude).

## Acceptance Criteria

### Tests That Must Pass

1. `npm run test:unit -- --runInBand --testPathPatterns="recommendationEngine" --coverage=false`

### Invariants That Must Remain True

1. No `axis_sign_conflict` recommendations are emitted for `<=`/`<` clauses.
2. Severity scoring uses `lostIntensity / threshold` when threshold > 0.
3. Axis conflict evidence includes lost magnitude values and clause sources.

## Status

Completed.

## Outcome

- Implemented operator gating, lost-intensity severity, and action text that cites source clauses.
- Evidence now carries axis/bounds/lost magnitude fields plus a mood-regime population label (no UI changes).
- Added unit coverage for `<=` suppression and axis-conflict severity behavior.
