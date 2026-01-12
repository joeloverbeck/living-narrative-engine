# Expression Diagnostics Monte Carlo Refactor & Test Priorities

Date: 2025-02-14

## Scope
This review focuses on the code paths behind the **Run Simulation** and **Generate Report** buttons in `expression-diagnostics.html`.
Primary entry points:
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` (#runMonteCarloSimulation, #displayMonteCarloResults, #handleGenerateReport)
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/FailureExplainer.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/MonteCarloReportModal.js`

Note: A file named `specs/expression-diagnostics.md` is referenced in comments, but it is not present in this repo. The only similarly named file is `archive/specs/expression-diagnostics-client-server-robustness-ARCHIVED.md`.

## Priority Refactor Targets (focus: reimplemented logic)

### 1) MonteCarloSimulator reimplements core emotion/context logic (highest priority)
**Files:**
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- Duplicates with `src/emotions/emotionCalculatorService.js`
- Duplicates with `src/expressions/expressionContextBuilder.js`

**Why it matters:**
- `#parseGate`, `#checkGates`, and `#calculateEmotions` duplicate `EmotionCalculatorService` (gate parsing, gate enforcement, trait-aware weights). This is a maintenance risk; changes to emotion logic require edits in multiple places and can drift.
- `#buildContext` duplicates `ExpressionContextBuilder` (context shape, derived sexual arousal/states, previous state handling). Divergence here will silently skew Monte Carlo outputs vs runtime behavior.

**Refactor direction:**
- Extract a shared utility (or reuse existing services) for gate parsing and emotion calculation used by both runtime and diagnostics.
- Delegate context building to a shared builder (either use `ExpressionContextBuilder` directly or factor out a context factory with deterministic inputs for simulation).

**Performance angle:**
- Rebuilding derived emotions and sexual states for every sample is expensive; reuse cached prototype data and avoid repeated lookups through `dataRegistry` for each evaluation.

### 2) Gate parsing is duplicated across multiple services
**Files:**
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` (#parseGate)
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js` (#parseGate)
- `src/expressionDiagnostics/services/PrototypeConstraintAnalyzer.js` (#parseGate)
- `src/expressionDiagnostics/models/GateConstraint.js` (regex defined)

**Why it matters:**
- At least four separate implementations for identical parsing behavior. If gate syntax changes, these will drift.

**Refactor direction:**
- Centralize parsing in a shared utility or reuse `GateConstraint` parsing so services share one source of truth.

### 3) Sensitivity analysis logic split and partially duplicated
**Files:**
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` (#computeSensitivityData, #computeGlobalSensitivityData)
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` (extract conditions, flatten leaves, conditional pass rates)

**Why it matters:**
- Both controller and report generator extract leaf conditions / prerequisites with their own tree traversal logic. This duplicates traversal complexity and risks inconsistencies in reported sensitivity vs UI.

**Refactor direction:**
- Consolidate sensitivity/condition extraction into a service (e.g., move traversal logic into `FailureExplainer` or a dedicated `MonteCarloAnalysisService`). UI should only invoke services and render results.

### 4) MonteCarloSimulator random-state generation overlaps with WitnessState
**Files:**
- `src/expressionDiagnostics/services/MonteCarloSimulator.js` (#sampleGaussianDelta, #generateRandomState)
- `src/expressionDiagnostics/models/WitnessState.js` (sampling deltas)

**Why it matters:**
- Sampling behavior (sigmas, clamping, axes) is duplicated. If one changes, witness capture and simulation may diverge.

**Refactor direction:**
- Extract shared sampling utilities or reuse a single sampling module for both.

### 5) Controller is monolithic; UI and analysis are tangled
**File:** `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`

**Why it matters:**
- Monte Carlo flow includes data transformation, sensitivity computation, cross-reference analysis, and multiple UI renderers in a single class. This makes refactoring risky and complicates testing.

**Refactor direction:**
- Split into smaller components: simulation orchestration, sensitivity calculation, report assembly, UI renderers.
- This will also isolate test surfaces and allow coverage increases without massive DOM setup.

## Current Tests Covering These Paths

### Unit tests
- `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js`
  - Exercises the UI flow and mocks `MonteCarloSimulator` for Run Simulation and Generate Report paths.
- `tests/unit/domUI/expression-diagnostics/createStateSection.test.js`
  - Covers sections that appear after MC simulation (UI structure/behavior).
- `tests/unit/domUI/expression-diagnostics/MonteCarloReportModal.test.js`
  - Unit coverage for modal rendering and show/close behavior.
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.gateEnforcement.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloSimulator.temporalState.test.js`
  - Cover simulator core behavior (gates, temporal states).
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js`
- `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.prototypeFit.test.js`

### Integration tests
- `tests/integration/expression-diagnostics/advancedMetrics.integration.test.js`
- `tests/integration/expression-diagnostics/hierarchicalBlockers.integration.test.js`
- `tests/integration/expression-diagnostics/monteCarloReport.integration.test.js`
- `tests/integration/expression-diagnostics/expressionDiagnosticsBootstrap.integration.test.js`

## Coverage Snapshot (coverage/coverage-final.json)
This appears to be from a previous run and may not include recent suites. Line coverage is not populated for the files below (line map missing in coverage JSON), so line metrics are not available here.

- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
  - statements: 0.0% (0/1633)
  - branches: 0.0% (0/1106)
  - functions: 0.0% (0/58)
  - lines: unavailable (no line map in coverage file)
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
  - statements: 0.0% (0/680)
  - branches: 0.0% (0/502)
  - functions: 0.0% (0/16)
  - lines: unavailable
- `src/expressionDiagnostics/services/FailureExplainer.js`
  - statements: 0.0% (0/202)
  - branches: 0.0% (0/185)
  - functions: 0.0% (0/20)
  - lines: unavailable
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
  - statements: 46.3% (551/1189)
  - branches: 48.1% (546/1134)
  - functions: 19.0% (11/58)
  - lines: unavailable
- `src/domUI/expression-diagnostics/MonteCarloReportModal.js`
  - statements: 0.0% (0/28)
  - branches: 0.0% (0/13)
  - functions: 0.0% (0/7)
  - lines: unavailable
- `src/expressionDiagnostics/models/DiagnosticResult.js`
  - statements: 0.0% (0/108)
  - branches: 0.0% (0/64)
  - functions: 0.0% (0/28)
  - lines: unavailable

## Gaps & Prioritized Test Additions (toward ~100% coverage)

### A) MonteCarloSimulator (critical logic + heavy duplication)
Missing or weak areas:
- `computeThresholdSensitivity` and `computeExpressionSensitivity` are not referenced in tests.
- Dynamic sampling mode (`samplingMode: 'dynamic'`) is not explicitly tested (deltas, clamping, sigma values).
- Witness capture and nearest-miss logic are not explicitly asserted (maxWitnesses, nearestMiss, failed leaf counts).
- Variable-path validation and unseeded var warnings (`validateVarPaths`, `failOnUnseededVars`) are not covered end-to-end.
- Clause tracking for compound AND/OR trees should be validated for last-mile counts and leaf stats.

Recommended unit tests:
- Target `computeThresholdSensitivity` with synthetic stored contexts (verify grid monotonicity, epsilon handling).
- Target `computeExpressionSensitivity` with a simple expression logic; verify it respects operator and threshold steps.
- Explicit tests for `samplingMode: 'dynamic'` (delta distribution, clamping) and the default `static` mode.
- Witness capture tests (max witness count, referenced emotions filter, nearestMiss structure).
- Validation: unseeded var warnings with both `failOnUnseededVars=true|false`.

### B) ExpressionDiagnosticsController (UI-driven orchestration)
Missing or weak areas:
- `#handleGenerateReport` success path vs guard paths (missing simulation result, missing dependencies).
- Sensitivity data computation (`#computeSensitivityData`, `#computeGlobalSensitivityData`) is not directly unit tested; only indirectly via mocks.
- `#displayMonteCarloResults` is a high-value integration surface but mostly covered via controller tests that rely on mocked simulator output.

Recommended unit tests:
- Simulate click on `#generate-report-btn` with real `MonteCarloReportGenerator` and confirm modal content is shown.
- Add tests for `#computeSensitivityData` and `#computeGlobalSensitivityData` with controlled blockers and storedContexts.

### C) MonteCarloReportGenerator (data transformation)
Missing or weak areas:
- Large sections are not covered (see 46% statement / 19% function coverage).
- Many conditional sections (conditional pass rates, last-mile decomposition, sensitivity, gap detection) do not have targeted tests.

Recommended unit tests:
- Use small, deterministic simulationResult + blockers to validate each report section independently.
- Add coverage for mood-regime filtering and OR-block handling in `#extractMoodConstraintsFromLogic`.
- Verify leaf-flattening behavior for nested AND/OR structures.

### D) FailureExplainer (core blocker logic)
Missing or weak areas:
- No coverage in this snapshot for blocker aggregation and summary rules.

Recommended unit tests:
- Provide controlled clause failure inputs and assert ranking, severity, and summary outputs.
- Add integration tests pairing MonteCarloSimulator outputs with FailureExplainer results.

## Suggested Refactor/Test Sequencing
1) Lock in MonteCarloSimulator behavior with direct unit tests for sensitivity + dynamic sampling + witnesses.
2) Extract shared emotion/context logic from MonteCarloSimulator to avoid divergence.
3) Consolidate gate parsing into shared utility used by all expression-diagnostics services.
4) Move sensitivity data extraction out of the controller; test it in isolation.
5) Increase MonteCarloReportGenerator coverage to near-100% with section-focused unit tests.

