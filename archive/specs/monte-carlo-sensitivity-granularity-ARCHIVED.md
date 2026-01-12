# Monte Carlo Sensitivity Granularity and Display

## Goal
Make sensitivity analysis for mood axes (and other integer-valued inputs) reflect actual data granularity, and present the resulting meaning clearly in both report output and the expression diagnostics UI.

## Assessment of ChatGPT Feedback
- **Claim: mood axes are integers, so 0.05 step tables are mostly noise.**
  - **True.** Mood axes are generated as integers in `src/expressionDiagnostics/services/RandomStateGenerator.js` via `Math.round(...)`, and the authoring prompts and docs describe mood axes as integer ranges `[-100..100]`. With integer-valued samples, thresholds stepped by 0.05 collapse to the same effective integer boundary for most rows.
- **Claim: the sensitivity tables hide the effective integer boundary changes.**
  - **True.** Current sensitivity grids are rendered with decimal thresholds (e.g., 19.95 vs 20.05) even though the effective comparisons are equivalent to integer boundaries. This makes the tables look more precise than they are.
- **Proposed fixes (integer steps, coarse steps, quantile-based thresholds, “effective threshold” labeling):**
  - **Logical.** These approaches align the sensitivity tables with actual sampling granularity and avoid misleading precision. The “effective threshold” label is a clear, low-risk improvement for both report and UI.

## Scope
- Monte Carlo sensitivity grid generation for variable thresholds (per-clause and global).
- Sensitivity display in:
  - Markdown report output (`MonteCarloReportGenerator`).
  - Expression diagnostics UI tables (`ExpressionDiagnosticsController`).

## Out of Scope
- Changing Monte Carlo sampling behavior (this is about reporting/analysis only).
- Altering expression evaluation logic or thresholds.

## Requirements

### 1) Use Domain-Appropriate Threshold Grids
- **Mood axes (`moodAxes.*`, `mood.*`)**
  - Use **integer step size** for sensitivity grids.
  - Default grid: `originalThreshold ± N` in **integer** steps (N based on current step count, e.g., 4 for 9 steps).
- **Other integer-valued domains (if used by tunable variables)**
  - Traits and any additional integer domains should also use integer steps.
- **Floating-point domains (emotions, sexual states, arousal scalars)**
  - Keep the existing 0.05 step size (or current stepSize config).

### 2) Expose “Effective Threshold” for Integer Domains
For integer-valued domains, surface the effective threshold so decimals do not appear falsely precise.
- **For `>=` or `>` comparisons:** effective threshold is `ceil(threshold)`
- **For `<=` or `<` comparisons:** effective threshold is `floor(threshold)`

### 3) Display Rules
- **Report output (Markdown):**
  - Add an **Effective Threshold** column for integer domains.
  - Display integer thresholds without trailing decimals for integer-domain rows.
  - Add a short note under the table for integer domains: “Thresholds are integer-effective; decimals collapse to integer boundaries.”
- **UI output (Expression Diagnostics):**
  - Mirror report changes in the table by adding an **Effective** column or inline label per row.
  - For integer-domain results, format thresholds as integers (or show both raw and effective values).

### 4) Non-Report Output
The expression diagnostics UI (non-report output) must include the same “effective threshold” clarity as the report. This ensures designers see the same information without downloading the report.

## Suggested Implementation Plan (No Code Yet)
1. **Determine domain granularity**
   - Add a helper (likely in `advancedMetricsConfig.js`) to detect whether a variable path is integer-valued.
   - Map domains to `granularity` (e.g., `moodAxes: 1`, `traits: 1`, `emotions: 0.05`).
2. **Generate threshold grids using granularity**
   - Update `SensitivityAnalyzer` to pass `stepSize` based on variable domain, or add a new `thresholds` list to `MonteCarloSimulator`.
   - Ensure both `computeThresholdSensitivity` and `computeExpressionSensitivity` use the domain-aware step size.
3. **Add effective-threshold metadata**
   - Extend `SensitivityResult.grid` entries with `effectiveThreshold` when domain is integer.
4. **Render in report and UI**
   - `MonteCarloReportGenerator`: add column and note for integer domains.
   - `ExpressionDiagnosticsController`: add effective column and integer formatting.

## Acceptance Criteria
- Mood-axis sensitivity tables use integer thresholds and show effective thresholds.
- Report output and UI output both communicate integer effectiveness clearly.
- Floating-point domains continue to use 0.05 steps and do not show effective-threshold columns.
- No change to Monte Carlo sampling or expression evaluation behavior.
