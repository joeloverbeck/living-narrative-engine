# Monte Carlo Gate-Clamp Diagnostics Spec

## Goal
Assess ChatGPT's Monte Carlo diagnostics recommendations, decide what is correct/useful, and define what to add to the report vs. the non-report UI in `expression-diagnostics.html`.

## Scope
- Applies to Monte Carlo reporting and the non-report UI surfaces in `expression-diagnostics.html`.
- No code changes here; this is a spec for future implementation.

## Decisions Summary
- Add gate-clamp and conditional threshold-pass metrics for emotion-threshold clauses: yes.
- Show those metrics in the report: yes.
- Show those metrics in the non-report UI: yes, but with clear labeling and denominators.
- Add per-gate breakdown in UI: yes, but optional expand/collapse.
- Add invariants as internal checks (non-UI): yes.
- Add tests: unit and analyzer-level yes; UI tests optional, follow repo conventions.

## Claims and Recommendations Assessment

### 1) Add per-clause row: gate clamp rate in mood-regime
- Claim correctness: correct. This cleanly distinguishes gate failures from threshold failures.
- Implementation benefit: high. This is the missing diagnostic signal for emotion clauses.
- Report: include as a column for emotion-threshold clauses.
- Non-report UI: include, labeled as "Gate clamp (forced 0)" with counts.
- Notes: compute only for emotion-derived clauses; omit for mood-only constraints.

### 2) Add per-clause row: P(threshold | gates pass, mood-regime)
- Claim correctness: correct. This isolates threshold difficulty from gate mismatch.
- Implementation benefit: high.
- Report: include as a column for emotion-threshold clauses.
- Non-report UI: include with counts (x/y), avoid unlabeled conditional probability.

### 3) Instrument emotion evaluation with gatesPassed + failedGates
- Claim correctness: correct in principle; diagnostics must match runtime gate logic.
- Implementation benefit: high for diagnostics and debugging.
- Report: show aggregate gate clamp rates; optionally include failed gate list in a drill-down section.
- Non-report UI: show per-gate failure rates in an expandable panel.
- Notes: Prefer instrumentation in the Monte Carlo evaluator if it is faithful to runtime. If runtime already exposes gate outcomes, re-use them.

### 4) Use mood-regime subset as denominator for new metrics
- Claim correctness: correct. This aligns with existing "mood-pass" reporting.
- Implementation benefit: high; keeps denominators consistent.
- Report: show denominators explicitly (e.g., 127/326) to prevent misreads.
- Non-report UI: same; include tooltip text explaining the denominator.

### 5) Invariants
- Gate clamp correctness: correct (if gates fail, final intensity must be 0).
- Range invariant (0..1): likely correct, but verify if any emotion channels use different scaling.
- Determinism with seed: correct if the Monte Carlo PRNG is seeded and single-threaded.
- Gate evaluation matches runtime: correct and required.
- Probability identity invariant: correct and useful.
- Denominator invariants: correct.
- Implementation benefit: medium-high as internal checks or test assertions.
- Report/UI: no; these are validation checks, not report data.

### 6) Tests
- Unit tests for gate clamp and failed gate reasons: correct, beneficial.
- Analyzer tests for gate mismatch vs threshold-too-high scenarios: correct, beneficial.
- Regression test for gates ignored: correct, beneficial.
- UI tests for new columns/tooltips: useful but optional; follow existing UI test patterns if present.
- Report/UI: tests are not report/UI features; no.

### 7) UI funnel framing (Mood-regime N -> Gate clamp -> Pass | gate -> Effective pass)
- Claim correctness: correct, communicates causality cleanly.
- Implementation benefit: high; reduces misinterpretation.
- Report: include as columns (or a compact funnel section) for emotion-threshold clauses.
- Non-report UI: include in the clause table, with optional expansion for gates.

### 8) Expandable per-gate breakdown panel
- Claim correctness: correct; enables targeted tuning.
- Implementation benefit: medium-high.
- Report: include as a nested section when a clause is expanded, or in an appendix.
- Non-report UI: include as a toggle in the clause row.

### 9) Classification badge (gate mismatch vs threshold too high vs both)
- Claim correctness: directionally correct.
- Implementation benefit: medium; it is a heuristic but useful.
- Report: include as a short label near the clause or in a summary section.
- Non-report UI: include as a small badge with hover text that explains the heuristic.
- Notes: define thresholds explicitly (e.g., gateClampRate >= 0.5, pass|gate <= 0.2) and make them configurable to avoid hardcoded magic numbers.

### 10) UI traps and fixes
- Claim correctness: correct. Conditional probabilities are easy to misread.
- Implementation benefit: high.
- Report: always show counts + percent, and label denominators.
- Non-report UI: same; use tooltips with clear wording.

## Proposed Report Additions
- New columns for emotion-threshold clauses:
  - Gate clamp (forced 0): percent + count/denominator (mood-regime).
  - Pass | gate: percent + count/denominator (gate-pass subset).
  - Effective pass (optional): percent + count/denominator (mood-regime).
- Optional appendix section: per-gate failure rates for each emotion clause (only when user expands or in a detailed section).

## Proposed Non-Report UI Additions (`expression-diagnostics.html`)
- Clause table enhancements for emotion-threshold clauses:
  - Gate clamp (forced 0) with tooltip explaining gates.
  - Pass | gate with explicit numerator/denominator.
  - Effective pass (optional) tied back to current "Fail% | mood-pass".
- Expandable gate breakdown:
  - List each gate and its fail rate within mood-regime.
- Classification badge with tooltip:
  - "Gate mismatch", "Threshold too high", or "Both".

## Open Questions
- Does the runtime emotion evaluation already expose gate pass/fail data? If so, re-use instead of duplicating logic.
- Are there emotion channels with non-[0..1] ranges that would invalidate the range invariant?
- Where in the UI is the best place to show the funnel without overwhelming the table?
