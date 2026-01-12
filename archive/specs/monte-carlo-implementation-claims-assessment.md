# Monte Carlo Implementation Claims Assessment

## Scope

Assess the claims/suggestions in `brainstorming/assessment-of-current-monte-carlo-implementation.md`
against current implementation and decide what should appear in the report UI and
the non-report UI. For this spec, "non-report UI" refers to the interactive UI
defined by `expression-diagnostics.html` + `src/expression-diagnostics.js`.

Sources reviewed:
- `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
- `src/expressionDiagnostics/workers/MonteCarloReportWorker.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/expressionDiagnostics/services/ReportOrchestrator.js`

## Claim and Suggestion Assessment

### 1) “Sensitivity Analysis tables are mislabeled; they’re marginal pass-rate sweeps.”

Assessment: **Correct.**
- `computeThresholdSensitivity` in `src/expressionDiagnostics/workers/MonteCarloReportWorker.js`
  only evaluates the clause predicate against stored contexts and returns `passRate`.
- `#generateSensitivityAnalysis` in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
  currently says “affect the trigger rate,” which is inaccurate for marginal sweeps.

Suggestion benefit: **High.** Rename/clarify to prevent misinterpretation.

UI placement:
- Report UI: **Yes.** Rename the section and add a disclaimer.
- Non-report UI: **Yes.** Use the same label/disclaimer in the interactive panel.

---

### 2) “There’s a function sweeping thresholds that never calls the full evaluator.”

Assessment: **Correct (for the marginal sweep).**
- `computeThresholdSensitivity` does not call the expression evaluator.
- There is a separate `computeExpressionSensitivity` that *does* evaluate full logic,
  but it is only used for the “Global Expression Sensitivity” section and is suppressed
  when baseline hits are < 5.

Suggestion benefit: **Moderate.** This is more of a code-locating hint than a change.
The underlying issue is labeling, not missing capability.

UI placement: **N/A.** No UI change by itself.

---

### 3) “Define two explicit analysis types so labels can’t lie.”

Assessment: **Partially correct.**
- The system already distinguishes the two computations (`computeThresholdSensitivity`
  vs `computeExpressionSensitivity`), but the results are not type-discriminated
  (no explicit `kind`) and the report label for the marginal sweep is misleading.

Suggestion benefit: **High.** Add an explicit `kind` field (or distinct result shapes)
so renderers must choose the correct label automatically.

UI placement:
- Report UI: **Yes.** Derive section headers from `result.kind`.
- Non-report UI: **Yes.** Same derivation for interactive panel labels.

---

### 4) “Invariants S1–S4 should be enforced.”

S1: Trigger rate ≤ each required clause pass rate (AND expressions).
- Assessment: **Conditionally correct.** Valid for AND-only required clauses.
  Not safe for OR-heavy or negated structures without additional logic-tree checks.
- Benefit: **Moderate.** Useful as integrity warning if gated by AND-only detection.
- UI placement: **Report UI: Yes** (integrity warning). **Non-report UI: Optional**.

S2: Baseline trigger rate in report equals baseline in sweep.
- Assessment: **Incorrect as stated.** Sweeps use `storedContexts` (max 10k) while
  the report’s trigger rate uses the full sample (`simulationResult.sampleCount`).
  These are different populations and will not match.
- Benefit: **Moderate if scoped.** Apply only when population hashes match
  (same population + evaluator).
- UI placement: **Report UI: Yes** (only when same population). **Non-report UI: Optional**.

S3: Population hash consistency across sweeps.
- Assessment: **Correct; partly implemented.**
  The report already shows population name/predicate/hash via
  `#formatStoredContextPopulationLabel`, but sweep results do not carry an explicit
  hash field for validation.
- Benefit: **Moderate.** Add hash to sweep results and validate equality.
- UI placement: **Report UI: Yes** (metadata line per sweep section). **Non-report UI: Yes**.

S4: Monotonicity for threshold sweeps.
- Assessment: **Mostly correct.** For single-threshold clauses, marginal pass-rate
  should be monotonic. Expression-level monotonicity holds for AND-only paths;
  OR/NOT structures can flatten but should not invert direction for a single
  tightened clause unless the rewrite logic is wrong.
- Benefit: **High.** Good integrity signal for clause rewrite/threshold swap errors.
- UI placement: **Report UI: Yes** (warning badge). **Non-report UI: Yes**.

---

### 5) “Add tests T1–T5.”

Assessment: **Correct and beneficial.**
- These tests directly protect against mislabeled or mismatched sweep calculations.
- They are a good fit for the diagnostics toolchain.

Suggestion benefit: **High.**

UI placement: **N/A.** (Tests only.)

---

### 6) “Add expression-level diagnostics (A/B/C).”

A) Bottleneck attribution: Pr[clause fails | expression fails]
- Assessment: **Partially redundant.**
  The report already includes “Blocker Analysis,” “Worst Offender,” and
  “Last-Mile Decomposition” for decisive blockers, but does not explicitly show
  P(fail | expression fails).
- Benefit: **Low–Moderate.** Could add clarity but overlaps with existing sections.
- UI placement: **Report UI: Optional** (if added, place near Blocker Analysis).
  **Non-report UI: Optional.**

B) Trigger rate vs threshold (expression-level sweep)
- Assessment: **Already implemented**, but suppressed when baseline hits < 5 and
  limited to top 3 candidates. It also uses stored contexts only.
- Benefit: **Moderate.** Consider showing a low-confidence version (with warning)
  rather than suppressing entirely for rare expressions.
- UI placement: **Report UI: Yes**, but keep the low-confidence warning.
  **Non-report UI: Yes** (interactive plot/table).

C) Expected trigger-rate upper bound = min(pass_rate(clause_i)) for AND.
- Assessment: **Conditionally correct.** Useful for AND-only required clauses.
- Benefit: **Moderate.** Good quick sanity check when the trigger rate is far below
  the bound, indicating strong correlation or unmodeled blockers.
- UI placement: **Report UI: Yes** (Executive Summary for AND-only).
  **Non-report UI: Optional**.

---

### 7) “UI/report improvements (rename/split, baselines, warnings, population hash, monotonicity).”

Rename and split sections:
- Assessment: **Needed.** The report already has a “Global Expression Sensitivity”
  section, but the marginal sweep section is mislabeled.
- Benefit: **High.**
- UI placement: **Report UI: Yes.** **Non-report UI: Yes.**

Show both baselines side-by-side:
- Assessment: **Partially correct.** Must distinguish “stored-context baseline”
  vs “full-sample baseline.” They are not the same population.
- Benefit: **Moderate.** Helps avoid misinterpretation when both are shown clearly.
- UI placement: **Report UI: Yes** (label both baselines). **Non-report UI: Optional**.

Inline integrity warnings:
- Assessment: **Good.** The report already has integrity warnings, but not
  specifically for sweep inconsistencies.
- Benefit: **High.**
- UI placement: **Report UI: Yes.** **Non-report UI: Yes** (warning badges).

Include population definition + hash:
- Assessment: **Already done in report** via `#formatStoredContextPopulationLabel`,
  but sweep results should carry explicit hash for validation.
- Benefit: **Moderate.**
- UI placement: **Report UI: Yes** (keep). **Non-report UI: Yes**.

Monotonicity indicator:
- Assessment: **Good** (see S4).
- Benefit: **High.**
- UI placement: **Report UI: Yes.** **Non-report UI: Yes**.

## Implementation Notes (No Code Changes Yet)

- The “Sensitivity Analysis” section should be renamed to reflect **marginal clause
  pass rate** and explicitly state it does **not** estimate trigger rate.
- The “Global Expression Sensitivity Analysis” section already performs expression-level
  sweeps. It should be surfaced with a low-confidence warning instead of suppression
  when baseline hits are rare, or explicitly labeled as “low confidence.”
- Baseline comparisons must only be enforced or shown when comparing the same population
  (e.g., stored contexts vs full sample).

## Open Questions

- None.
