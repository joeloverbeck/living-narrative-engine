# Monte Carlo Regime Population Consistency Spec

## Goals
- Disambiguate population counts between full Monte Carlo samples and stored contexts.
- Align the "mood regime" predicate and labeling across simulator, report, and UI.
- Make every section that uses a subset of samples declare its population and unit.

## Assessment of ChatGPT Claims (from `brainstorming/assessment-of-current-monte-carlo-implementation.md`)

### 1) "Mood-pass sample count is inconsistent (327 vs 35)"
Verdict: **Partially incorrect, but highlights a real labeling issue.**
- `MonteCarloSimulator` counts `inRegimeSampleCount` over the full `sampleCount` (e.g., 100,000).
- The report and UI conditional pass-rate sections filter **storedContexts**, which are capped by `sensitivitySampleLimit` (default 10,000).
- With ~0.327% regime rate, 100,000 samples -> ~327 in-regime, 10,000 stored contexts -> ~33 in-regime. So 327 vs 35 is expected.
- The report/UI do not disclose that these sections operate on a reduced population, so it looks inconsistent.

### 2) "Define one regime name and print its exact count once, reuse everywhere"
Verdict: **Incorrect as stated; correct directionally.**
- There are multiple populations: full samples, stored contexts (sensitivity subset), and sometimes in-regime subsets of each.
- A single count cannot be reused everywhere; instead, each section must declare its population and unit.
- The correct fix is to name each population explicitly and surface the exact counts (and limits).

### 3) "Samples vs contexts confusion"
Verdict: **Correct.**
- The report uses both sample counts and stored context counts without clarifying the unit.
- This is the root cause of the 327 vs 35 confusion.

### 4) "Same name, different predicate"
Verdict: **Partially correct.**
- `MonteCarloSimulator` and `MonteCarloReportGenerator` both extract mood constraints from AND blocks only and accept `moodAxes.*` and `mood.*`.
- The UI mood filter uses **only** `moodAxes.*` (ignores `mood.*`), so the predicate can diverge.
- `PrototypeConstraintAnalyzer` pulls **all** `moodAxes.*` constraints from AND and OR blocks (no OR warning in its extraction), which makes the "mood regime" used for prototype fit more restrictive than the simulator's regime.

### 5) "Different report sections computed off different pipelines"
Verdict: **Correct.**
- Per-clause "Fail% | mood-pass" uses full simulation stats.
- Conditional pass rates, prototype fit, implied prototype, gap detection, last-mile decomposition, and sensitivity analysis depend on stored contexts (limited subset).
- The report does not expose that population mismatch today.

### 6) "Boundary semantics / off-by-one" and other speculative claims
Verdict: **Not evidenced by current code.**
- There is no clear mismatch in inclusive/exclusive handling in the simulator vs report utilities.
- These are reasonable things to test, but not demonstrated issues in the current output.

### 7) "Gate/intensity invariants"
Verdict: **Likely already consistent.**
- The simulator uses the same emotion calculator adapter as runtime, so gating should match.
- The report/UI re-use computed context values; no evidence of gate mismatches beyond population labeling.

## Observations in Code
- `MonteCarloSimulator` stores contexts only when `storeSamplesForSensitivity` is true and caps at `sensitivitySampleLimit` (default 10,000).
- `MonteCarloReportGenerator` uses full-sample in-regime counts for clause stats, but uses stored contexts for conditional pass rates and prototype fit analysis.
- `ExpressionDiagnosticsController` performs its own mood constraint extraction/evaluation (separate logic) and uses stored contexts for multiple UI sections.
- `PrototypeConstraintAnalyzer` includes OR-based mood constraints when extracting axis constraints, which makes regime-derived prototype analysis conservative but not fully aligned with simulator logic.

## Proposed Changes

### A) Introduce a shared mood-regime utility (reduce duplicate logic)
Create a shared module (e.g., `src/expressionDiagnostics/utils/moodRegimeUtils.js`) that provides:
- `extractMoodConstraints(prerequisites, { includeMoodAlias: true, andOnly: true })`
- `hasOrMoodConstraints(prerequisites, { includeMoodAlias: true })`
- `evaluateConstraint(value, operator, threshold)`
- `filterContextsByConstraints(contexts, constraints)`
- `formatConstraints(constraints)` (for consistent display)

Use this in:
- `MonteCarloSimulator` (for in-regime checks and counts)
- `MonteCarloReportGenerator` (for conditional pass rates and any mood-regime filtering)
- `ExpressionDiagnosticsController` (UI conditional pass rates, warnings)

This removes the three separate implementations currently diverging.

### B) Add population summary metadata to simulation results
Extend `SimulationResult` to include a `populationSummary` object, for example:
- `sampleCount`
- `inRegimeSampleCount`
- `inRegimeSampleRate`
- `storedContextCount`
- `storedContextLimit`
- `storedInRegimeCount` (computed from stored contexts)
- `storedInRegimeRate`

Compute `storedInRegimeCount` once and avoid re-filtering in multiple sections.

### C) Report updates (MonteCarloReportGenerator)
Add a small "Population Summary" block near the report header, including:
- Total samples and in-regime count
- Stored contexts and in-regime count
- Explicit note if `storedContextCount < sampleCount`

For each section that relies on stored contexts (conditional pass rates, sensitivity, last-mile, prototype fit, implied prototype, gap detection, gate failure stats), add a one-line population label, such as:
"Population: stored contexts (N of total; limit M; in-regime K)."

Also standardize "mood regime" naming to reflect the actual predicate:
"Mood regime = AND-only mood constraints from prerequisites (moodAxes.* or mood.*)."

### D) UI updates (expression-diagnostics.html + controller)
Add a UI "Population Summary" card in the Monte Carlo results area showing:
- sampleCount + inRegimeSampleCount
- storedContextCount + storedInRegimeCount
- storedContextLimit (if applicable)

For sections relying on stored contexts, add a small note (reusing the same data) to make the population explicit. This should appear in:
- Conditional pass rates
- Last-mile decomposition
- Global sensitivity
- Prototype fit
- Implied prototype
- Prototype gap detection

### E) Align predicates across UI and report
- Update UI mood constraint extraction to include both `moodAxes.*` and `mood.*` to match simulator and report.
- Use the shared utility for OR detection so warning behavior is consistent.
- Consider updating `PrototypeConstraintAnalyzer` to respect `andOnly` extraction (or explicitly label its regime as "axis constraint envelope" if OR constraints are included). If OR constraints remain included, ensure the warning is explicit and consistent across report/UI.

## Refactor Opportunities (reduce divergence)
- Consolidate mood constraint extraction/evaluation into the shared utility described above.
- Reuse that utility in simulator, report generator, and UI rather than maintaining separate helpers.
- Avoid duplicate JSON-logic parsing for mood constraints when possible (reuse extracted constraints across sections).

## Tests
Add targeted tests to lock in population clarity and predicate consistency:
- Unit tests for `moodRegimeUtils` covering AND-only extraction, OR detection, and mood alias support.
- Report generator tests that assert population summary output and correct labels when `storedContextCount < sampleCount`.
- UI tests to ensure conditional pass rates and prototype fit sections show population labels and use consistent mood constraints.
- (Optional) Integration test that checks the reported in-regime count is consistent with the simulator count when stored contexts are the full population.

## Non-Goals
- Changing sampling distributions or Monte Carlo logic.
- Storing all 100,000 contexts (memory cost is too high).

