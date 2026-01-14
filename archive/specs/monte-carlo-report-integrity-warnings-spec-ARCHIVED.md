# Monte Carlo Report Integrity Warnings - Assessment Spec

## Scope
Assess integrity warnings in `brainstorming/monte-carlo-report-integrity-warnings.md`, validate ChatGPT claims against current code, and decide which improvements belong in UI reports and/or the non-UI Markdown report. No code changes in this spec.

## Evidence Snapshot
- Monte Carlo contexts are built in `src/expressionDiagnostics/services/MonteCarloSimulator.js` and include computed `emotions` from `EmotionCalculatorService`, which hard-clamps gate failures to 0.
- Integrity warnings are generated in `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` by recomputing gate pass from stored contexts and comparing to stored `final` values.
- Diagnostics normalization uses `src/expressionDiagnostics/utils/axisNormalizationUtils.js`, which treats values in [-1, 1] as already-normalized even when raw values are integer mood axes (e.g., -1, 0, 1).
- Runtime normalization in `src/emotions/emotionCalculatorService.js` always divides mood axes by 100 and clamps sexual axes, without the "already normalized" shortcut.

## Assessment: ChatGPT Claims

### A) Prototype evaluation pipeline is the top suspect
- Verdict: **Unconfirmed / unlikely as primary cause**.
- Rationale: `EmotionCalculatorService` hard-clamps gates to zero in `#calculatePrototypeIntensity`, so if stored contexts use this calculator, a systematic pipeline bug is not evident. No alternative pipeline is referenced in `MonteCarloSimulator`.
- References: `src/emotions/emotionCalculatorService.js`, `src/expressionDiagnostics/services/MonteCarloSimulator.js`.

### B) Stored context snapshot/export step stores pre-gate values or mutates later
- Verdict: **Unconfirmed / weak evidence**.
- Rationale: Contexts are built once per sample with gated `emotions` and pushed into `storedContexts` without later mutation in the simulator. The report does not mutate contexts. No explicit pre-gate storage exists in the Monte Carlo flow.
- References: `src/expressionDiagnostics/services/MonteCarloSimulator.js`.

### C) Report-side gate evaluation differs from runtime evaluation
- Verdict: **True** (duplicate logic exists, drift risk is real).
- Rationale: Report generator re-evaluates gates using `GateConstraint` and diagnostics normalization rather than the runtime calculator. This is a direct duplication of logic that can diverge.
- References: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`, `src/expressionDiagnostics/utils/axisNormalizationUtils.js`.

### D) Normalization / resolver mismatch is a likely cause
- Verdict: **True and likely contributor**.
- Rationale: Diagnostics normalization treats raw axis values in [-1, 1] as already normalized. Runtime always divides raw mood axes by 100. Because Monte Carlo uses integer mood axes in [-100, 100], the values -1, 0, 1 are plausible and will be normalized differently between runtime (e.g., 1 -> 0.01) and diagnostics (1 -> 1.0). This can flip gate pass/fail and yield I1 warnings.
- References: `src/expressionDiagnostics/utils/axisNormalizationUtils.js`, `src/emotions/emotionCalculatorService.js`, `src/expressionDiagnostics/services/RandomStateGenerator.js`.

### E) Caching / memoization reuse across samples is a suspect
- Verdict: **Not supported**.
- Rationale: There is per-sample cache for normalized gate context, but it is scoped per sample and not reused across samples. No global cache or memoization for gate results is present in the Monte Carlo flow.
- References: `src/expressionDiagnostics/services/MonteCarloSimulator.js`.

### “Most likely a bug” (overall claim)
- Verdict: **Likely true**.
- Rationale: The integrity warning compares gate pass (recomputed) with stored final, and the current normalization mismatch can produce false failures. This makes I1 warnings likely due to implementation mismatch, not data.

## Assessment: ChatGPT Proposed Implementations

### Invariants
- Hard gate clamp (gatePass false => final 0): **True** for runtime and diagnostics assumptions; should remain a hard invariant.
- Non-zero implies gate pass: **True** under the hard-gate model.
- Gate pass preserves raw (final == clamp01(raw)): **True** in diagnostics utility; runtime uses a similar clamp on weighted sum.
- Gate evaluation consistency: **True / required**. Drift exists today due to duplicate logic.
- Stored context immutability: **Beneficial**; reduces subtle bugs when stored contexts are reused.
- Stored final must be post-gate: **True** for Monte Carlo and report correctness.

### Tests T1-T7
- T1/T2 (gate clamping & pass): **Beneficial** unit tests.
- T3 (report evaluator matches runtime): **Beneficial** and high-value.
- T4 (dissociation regression): **Potentially beneficial**, but must be tied to a real gate in data; should be generalized if prototype gates change.
- T5 (no I1 warnings on deterministic run): **Beneficial** integration test with a fixed seed (if deterministic sampling is available).
- T6 (stored contexts are post-gate): **Beneficial** integration test.
- T7 (property-based invariant): **Beneficial** if scoped to a small random sample and stable normalization.

### UI/report improvements A-F
- A) Explicit gating model (hard/soft): **Beneficial**; clarifies interpretation and sets expectation.
- B) Show raw/gate/final signals: **Beneficial** for diagnostics clarity.
- C) Integrity panel per population with invalidation of gate-dependent metrics: **Beneficial**; prevents misuse of invalid stats.
- D) Drill-down for flagged sample index: **Beneficial** in UI; not applicable to plain Markdown.
- E) Show numeric scale everywhere (raw + normalized): **Beneficial**; directly addresses normalization confusion.
- F) Gate-aware blocker attribution split: **Beneficial**; clearer reasoning about gates vs thresholds.

### Other recommendations
- 1) Kill duplicated logic (reuse runtime evaluator): **Beneficial** and likely required to eliminate mismatches.
- 2) Store evaluation traces in samples: **Beneficial**; reduces recomputation and mismatch risk.
- 3) Add version hashes to report: **Beneficial** for reproducibility and trust.

## Recommended Modifications and Placement

### Core correctness fixes (not UI/report content)
1) **Unify gate evaluation/normalization**
   - Replace diagnostics normalization with runtime-consistent normalization, or share a single canonical implementation.
   - Rationale: fixes mismatch for raw axis values in [-1, 1].
   - Placement: **Code** (shared utilities). Not report-specific.

2) **Remove duplicate gate evaluation in report**
   - Prefer importing runtime evaluation or store gate results in sample traces.
   - Placement: **Code**. Not report-specific.

3) **Store raw/gate/final traces per sample** (optional but high value)
   - Enables reporting without re-evaluating gates and supports integrity checks.
   - Placement: **Code** + report consumption.

### Report (Markdown / non-UI) changes
1) **Gating model line** (A)
   - Add "Gating model: HARD (gate fail => final = 0)" near the report header.
   - Placement: **Non-UI report**.

2) **Integrity summary block** (C)
   - Include mismatch count, affected prototypes, example indices, and a note about invalidating gate-dependent metrics.
   - Placement: **Non-UI report**.

3) **Signal lineage summary** (B + E)
   - Add a short table or note describing that signals are raw/gated/final and show units/scales for axes used in gate evaluation.
   - Placement: **Non-UI report**.

4) **Gate-aware pass-rate split** (F)
   - For threshold clauses, add: P(gatePass|mood), P(thresholdPass|gatePass, mood), P(thresholdPass|mood).
   - Placement: **Non-UI report**.

### UI report changes (Expression Diagnostics UI)
1) **Integrity panel** with invalidation indicator (C)
   - Surface mismatches and mark gate-dependent metrics as unreliable.
   - Placement: **UI report**.

2) **Signal lineage display** (B)
   - Show raw/gate/final intensities where relevant.
   - Placement: **UI report**.

3) **Drill-down view** for sample indices (D)
   - Clickable example index reveals gate evaluation details.
   - Placement: **UI report only**.

4) **Show numeric scale** (E)
   - Display raw and normalized values in gate sections.
   - Placement: **UI report** (optional to mirror in Markdown if concise).

### Testing (non-report)
- Add T1-T3 and T6 as baseline tests.
- Add T4 if the gate in question is stable and meaningful.
- Add T5/T7 if deterministic sampling or a small seeded harness exists.

## Open Questions
- Are there existing normalization helpers meant to be canonical for runtime and diagnostics? If so, prefer them.
- Is deterministic RNG available or acceptable for Monte Carlo tests? If not, prefer smaller invariant checks on sampled contexts.

## Acceptance Criteria
- I1 warnings do not appear for Monte Carlo runs when gates are hard-clamped and normalization is consistent.
- Gate pass rates and threshold pass rates are mutually consistent.
- Reports clearly indicate gating model and invalidate gate-dependent metrics when integrity warnings exist.
