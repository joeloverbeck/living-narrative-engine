# Monte Carlo Report Integrity Warnings - Claim Assessment and Spec

## Scope
Assess ChatGPT claims in `brainstorming/monte-carlo-report-integrity-warnings.md` and decide whether to add changes to the Monte Carlo report and/or the non-report UI (the on-page results in `expression-diagnostics.html`, driven by `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`).

## Current Behavior (from code)
- Integrity warnings are generated in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` and shown only inside the report modal.
- Warning `I1_GATE_FAILED_NONZERO_FINAL` is emitted when report-side gate evaluation fails but stored `final` intensity is non-zero (`#collectReportIntegrityWarnings`).
- Gate evaluation in diagnostics uses `GateConstraint.parse` + `resolveAxisValue` on normalized axes (`src/expressionDiagnostics/utils/axisNormalizationUtils.js`).
- Final emotion intensities in the Monte Carlo contexts are produced via `EmotionCalculatorService` (gate-fail clamps to 0) through the adapter in `src/expressionDiagnostics/services/MonteCarloSimulator.js`.
- Report integrity checks already use an epsilon (`REPORT_INTEGRITY_EPSILON = 1e-6`) in `src/expressionDiagnostics/utils/reportIntegrityUtils.js`.

## Claim Assessment (ChatGPT response)

### 1) "Warnings are real red flags; not necessarily a sampling issue"
- Status: true.
- Rationale: `I1_GATE_FAILED_NONZERO_FINAL` is triggered by an invariant breach in report logic, not by distribution or sampling mechanics. See `#collectReportIntegrityWarnings` in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`.

### 2) "Contract: gate fail => final intensity == 0"
- Status: true.
- Rationale: `EmotionCalculatorService.#calculatePrototypeIntensity` returns 0 on gate failure. `computeIntensitySignals` in `src/expressionDiagnostics/utils/intensitySignalUtils.js` also clamps `final` to 0 when gates fail.

### 3) "Warning literally means gatePass false but final > 0"
- Status: true.
- Rationale: Warning increments `gateFailNonZeroCount` when `gatePass` is false and `isNonZero(finalValue)` is true in `#collectReportIntegrityWarnings`.

### 4) "Root causes include: stored final is actually raw, gate mismatch, clamp bug, float dust"
- Status: partially true.
- Rationale:
  - Stored final being raw is possible if any pipeline bypasses `EmotionCalculatorService` or stores a pre-gate signal; current Monte Carlo path uses the emotion calculator and should clamp, so this is not the most likely in the diagnostics pipeline.
  - Gate mismatch is plausible because diagnostics re-evaluates gates independently (normalization + parser). Divergence is most likely when input axes are already normalized or otherwise non-standard.
  - Clamp bug is unlikely in `EmotionCalculatorService` but possible elsewhere if any alternate derivation exists.
  - Float dust is already mitigated with epsilon 1e-6; values larger than that are not explained by dust.

### 5) "Likely cause is duplicated logic drift (#1 or #2)"
- Status: plausible but unproven.
- Rationale: gate parsing + normalization are duplicated across runtime (`EmotionCalculatorService`) and diagnostics utilities. Drift is possible if inputs differ or normalization rules differ.

### 6) "Coordinate-system mismatch (normalized vs raw) can cause it"
- Status: plausible but context-dependent.
- Rationale: diagnostics normalization in `axisNormalizationUtils` treats values with abs <= 1 as already normalized. Runtime normalizes by dividing by 100 unconditionally. If any stored context values are pre-normalized, report gates can disagree with runtime gates.

### 7) "Non-zero finals distort >= / <= clause analysis"
- Status: true.
- Rationale: for >= thresholds, non-zero finals with gate failure can inflate pass rates and OR coverage; for <= thresholds, clamp-to-zero would pass anyway, but gate clamp accounting becomes unreliable. This matches how pass rates are computed in report generation.

### 8) "Add epsilon to integrity checks (1e-9)"
- Status: already implemented (with 1e-6).
- Rationale: `REPORT_INTEGRITY_EPSILON` already guards non-zero checks; lowering to 1e-9 is not clearly beneficial.

### 9) "Expose violating context identifiers"
- Status: beneficial.
- Rationale: current warnings only include population hash and prototype. Debugging requires locating specific contexts, which are not surfaced in the report or UI.

### 10) "Dump per-violation trace (axes, gates, raw, final)"
- Status: beneficial but too verbose for default report.
- Rationale: This is ideal for debugging, but should be an opt-in detail or developer-only path rather than default report output.

### 11) "Unify signal computation via a single helper"
- Status: partially true / already partially available.
- Rationale: diagnostics already has `computeIntensitySignals`. Runtime uses its own implementation. Full unification would be a larger refactor and is not required for the immediate integrity warning visibility improvements.

### 12) "Stop trusting final signal until fixed"
- Status: directionally true.
- Rationale: If I1/I2/I3 warnings appear, report-derived stats that assume gate-clamped finals should be marked unreliable. This is a communication/UI change rather than a data change.

## Decisions and Proposed Changes

### A) Add integrity warning visibility to the non-report UI
- Decision: adopt.
- Rationale: warnings currently live only in the report modal. Authors running "Run Simulation" should see integrity issues without generating the report.
- Non-report UI placement: Monte Carlo Simulation results area in `expression-diagnostics.html` (new container below population summary and above Top Blockers), wired by `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`.
- Display content:
  - A short summary (count of integrity warnings).
  - A list of warnings with code + message + prototype and population hash.
  - If none, keep container hidden.

### B) Add context index samples to report integrity warnings (report only)
- Decision: adopt (report-only by default).
- Rationale: aids debugging while keeping report compact.
- Report change: extend warning `details` with a small list of indices (first N, e.g., 3-5) from stored contexts where violations were detected.
- Report text: append "examples: index 12, 89, 104" to the warning line or add to details block.

### C) Add an "impact note" when integrity warnings are present
- Decision: adopt.
- Rationale: aligns with the recommendation to distrust final-signal-based metrics when integrity warnings exist.
- Report change: add a short paragraph under the warnings section, e.g., "Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved."
- Non-report UI change: show the same note when warnings exist.

### D) Optional debug trace export (deferred)
- Decision: defer.
- Rationale: useful but too verbose for default report; not required to resolve the immediate visibility gap.

### E) Epsilon adjustment
- Decision: no change.
- Rationale: already present with 1e-6; no evidence that smaller tolerance reduces false positives.

## Implementation Notes (for later coding)
- Report generator warning payloads live on `simulationResult.reportIntegrityWarnings` and are rendered via `#generateReportIntegrityWarningsSection` in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`.
- Non-report UI rendering is handled by `ExpressionDiagnosticsController` (Monte Carlo results section). Add a new container in `expression-diagnostics.html` and an update method to show/hide warnings.
- Update unit/integration tests if warning formatting or DOM structure changes:
  - `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.warnings.test.js`
  - Any relevant DOM tests under `tests/unit/domUI/expression-diagnostics/`

## Open Questions
- Should integrity warning sample indices map to a stable context id (if one exists in stored contexts), or is index within stored contexts sufficient?
- Is there any pipeline besides Monte Carlo simulator that populates stored contexts for report generation (if yes, validate normalization expectations there)?
