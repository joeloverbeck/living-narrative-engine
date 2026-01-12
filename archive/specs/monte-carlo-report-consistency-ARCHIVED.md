# Monte Carlo Report Consistency and Population Metadata

## Goal

Ensure Monte Carlo report sections use consistent populations and axis normalization, so gate pass rates, intensity percentiles, and clause stats cannot contradict each other. Make the population and signal definitions explicit in both report output and structured (non-report) diagnostics data.

## Claim Assessment (from brainstorming/assessment-of-current-monte-carlo-implementation.md)

- Prototype “mood regime” stats contradict clause stats (gate pass vs P90) can happen. True. Gate pass and gate failure rates in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` use raw `context.moodAxes` only and ignore normalization, sexual axes, and affect traits. Clause stats use `context.emotions` computed via `EmotionCalculatorService` (normalized + gated). This can produce mismatched gate pass rates (including 0%) alongside non-zero percentiles.
- “Achievable range” vs observed maxima mixing regimes is a labeling issue, not a computation bug. Partially true. The achievable range is derived from axis constraints (AND-only mood constraints) via `PrototypeConstraintAnalyzer`, while observed maxima in “Regime Stats” come from stored contexts (global vs in-regime). The report does not clearly label the scope, so it reads like a contradiction.
- “Core bug class: mixing populations and/or raw vs gated intensity.” Partially true. Populations are not consistently identified across sections; some sections use stored contexts while clause stats use full-sample metrics. Raw vs gated intensity is not explicitly tracked, and gate pass uses a different axis scale than the emotion calculator.
- “Make population/regime a first-class object and pass it everywhere.” Not implemented today. Reasonable and low-risk for stored-context sections; full-sample sections cannot provide sample IDs without storing all samples.
- “Define raw/gated/final intensities.” Not implemented today. Reasonable and helpful for report clarity.
- Invariants/tests and integrity warnings are not implemented. True.
- Parity between emotion prototypes and sexual state prototypes is incomplete. Partially true. Some diagnostic calculations use mood axes only and ignore sexual axes/affect traits; `PrototypeFitRankingService` normalizes axes but does not use affect traits and does not have access to raw sexual axes unless they are added to the stored context.

## Scope

1. Normalize gate pass and gate failure calculations so they match the runtime emotion calculator.
2. Make population identity explicit in report sections (for stored-context analyses).
3. Explicitly define and label intensity signals (raw, gated, final) used in report sections.
4. Add report integrity warnings (invariants).
5. Add targeted tests to prevent regressions.

## Non-goals

- Rework the Monte Carlo sampler or the expression evaluation engine.
- Store every sample context (full-sample IDs) for population hashing.
- Change expression prerequisite semantics.

## Proposed Changes

### 1) Shared Axis Normalization Utilities

Add a diagnostics helper (e.g., `src/expressionDiagnostics/utils/axisNormalizationUtils.js`) that mirrors `EmotionCalculatorService` normalization and axis resolution:

- `normalizeMoodAxes(rawMood)` => values in [-1, 1] (raw / 100).
- `normalizeSexualAxes(rawSexual)` => values in [0, 1] for `sex_excitation`, `sex_inhibition`, `sexual_inhibition`, `baseline_libido` (matching `EmotionCalculatorService`).
- `normalizeAffectTraits(rawTraits)` => values in [0, 1], defaulting missing values to 0.5.
- `resolveAxisValue(axis, normalizedMood, normalizedSexual, normalizedTraits, sexualArousal)`:
  - Trait axes first, then sexual axes (including `sexual_arousal` and `SA` alias), then mood axes.
  - This should match `EmotionCalculatorService.#resolveAxisValue`.

Use this helper in:

- `MonteCarloReportGenerator.#computeGatePassRate`
- `MonteCarloReportGenerator.#computeGateFailureRates`
- Any new raw/gated intensity calculations (below).

### 2) Store Raw Sexual Axes in Monte Carlo Contexts

`MonteCarloSimulator.#buildContext` currently stores computed `sexualStates` and `sexualArousal` but not the raw sexual axes. This blocks accurate gate checks when gates reference `sex_excitation`, `sex_inhibition`, or `baseline_libido`.

Update context to include raw sexual axes:

- Add `sexualAxes` (or `sexual`) with the raw `currentState.sexual` values.
- Add `previousSexualAxes` with `previousState.sexual` values.
- Keep existing `sexualStates` and `sexualArousal` fields intact.

This affects diagnostic-only logic; it should not change expression evaluation behavior.

### 3) Population Objects for Stored-Context Sections

Introduce a lightweight `Population` object for stored-context analyses (not full-sample):

```
type Population = {
  name: string,
  predicate: string, // human-readable predicate or "all"
  sampleIds: number[], // indexes into storedContexts
  count: number,
  hash: string, // stable hash of sampleIds + predicate
}
```

Implementation notes:

- Build populations once in `MonteCarloReportGenerator.generate`:
  - `stored-global` (all stored contexts)
  - `stored-mood-regime` (stored contexts filtered by mood constraints)
- Hash can be a short stable hash (e.g., SHA-1/CRC32 of sampleIds and predicate string).
- For sections based on stored contexts, include population header:
  - Population name
  - Predicate string (mood constraints)
  - Count
  - Hash

Add the population metadata to the simulation result payload for non-report consumers:

```
result.populationMeta = {
  storedGlobal: { name, predicate, count, hash },
  storedMoodRegime: { name, predicate, count, hash },
};
```

### 4) Define and Label Intensity Signals

Define three signal types for prototype intensity:

- `raw`: weighted sum normalized and clamped, with no gates applied.
- `gated`: `raw` when all gates pass, else `0`.
- `final`: same as `gated` today (unless future clamps are added).

Rules:

- Clause stats for `emotions.*` must use `final`.
- Prototype distribution tables should label whether they report `final` or `raw`.
- Gate pass rates are always based on gate predicates, using normalized axis values.

Update report sections:

- Prototype math `Regime Stats` table:
  - Add columns for `P90/P95/max` for `final` and `raw` (or two separate tables).
  - Label the signal used.
- Clause stats footer or header should mention `Signal: final`.

Add new utility for raw intensity computation using normalized axes and prototype weights (parallel to `PrototypeFitRankingService.#computeIntensity`, but shared via the new helper).

### 5) Achievable Range Scoping

Update the feasibility block in `MonteCarloReportGenerator`:

- Rename “Achievable range” to “Theoretical range (mood constraints, AND-only)”.
- In the “Regime Stats” block, explicitly label:
  - `Observed max (global, final)`
  - `Observed max (mood-regime, final)`

### 6) Report Integrity Warnings (Invariants)

Implement invariant checks in report generation and emit warnings if violated:

- I1: `gate_ok == false => final == 0`
- I2: `passRate(final >= t) <= gatePassRate` for `t > 0`
- I3: `gatePassRate == 0 => final P90/P95/max == 0` (within epsilon)
- I4: `observed_max_final(pop) <= theoretical_max_final(pop) + eps`
- I5: Populations labeled “mood-regime” must share the same population hash.

Add a “Report Integrity Warnings” section to the report and include a structured list in non-report output:

```
result.reportIntegrityWarnings = [
  { code, message, populationHash, signal, prototypeId, details }
];
```

### 7) Prototype Fit / Sexual Prototype Parity

Ensure normalization and axis resolution are consistent across:

- `PrototypeFitRankingService` (use shared normalization helper; include affect traits and raw sexual axes).
- `MonteCarloReportGenerator` prototype stats (gate pass, raw/gated intensities).

If sexual state prototypes are referenced in prerequisites:

- Include them in fit/implicit prototype/gap analysis (already partially supported).
- Clearly label prototype type in report tables (emotion vs sexual).

### 8) Tests

Add unit tests (targeted, deterministic):

- Gate pass normalization:
  - Build a single stored context with raw mood axes, raw sexual axes, and traits.
  - Verify gate pass matches the emotion calculator’s normalized evaluation.
- Signal consistency:
  - Synthetic context where gates fail but raw intensity > 0 => gated/final == 0.
  - Context where gates pass => gated == raw (if no extra clamps).
- Subset property:
  - For a fixed population, assert `passSet(final >= t) ⊆ gatePassSet`.
- Population hash consistency:
  - Same mood-regime population hash should appear in all sections that claim “mood-regime”.
- Report warnings:
  - Inject a mocked inconsistency and assert warnings are emitted.

Prefer tests under `tests/expressionDiagnostics/` and avoid reliance on `Math.random` by using fixed stored contexts.

## UI vs Non-report Output

- UI report changes:
  - Population headers with hash.
  - Signal labels (raw/gated/final).
  - Raw vs final stats side-by-side.
  - Report Integrity Warnings section.
  - Clear scoping labels for theoretical vs observed ranges.
- Non-report output changes:
  - `populationMeta` with hash/count.
  - `reportIntegrityWarnings` array.
  - Optional `signal` metadata for clause rows and prototype stats.

