# Monte Carlo Regime-Aware Reporting and Feasibility Clarity

## Goal

Make Monte Carlo diagnostics in `expression-diagnostics.html` unambiguous about feasibility, tuning direction, and regime-specific relevance. The report should clearly distinguish global sampling from the expression's mood regime, and the on-page (non-report) output should surface the most actionable summaries without overwhelming the table layout.

## Background

The current Monte Carlo report includes a "Prototype Math Analysis" section with fields like "Max Achievable / Required / Gap". For <= clauses this is inherently ambiguous and can imply the wrong tuning direction. The report also mixes global sampling data with mood-regime constraints, which can make a clause appear to fail when it is guaranteed true in-regime. This spec assesses and applies the useful parts of the ChatGPT feedback captured in `brainstorming/assessment-of-current-monte-carlo-implementation.md`.

## Assessment of ChatGPT Claims

### 1) Inequality direction / labeling issues in Prototype Math Analysis
- Assessment: Likely valid. A single "Max Achievable" field cannot support both >= and <= clauses without confusion. For <=, feasibility depends on the minimum achievable value (for "can ever pass") and the maximum achievable value (for "always pass"). The current wording can lead to the wrong tuning direction.
- Decision: Adopt. Replace the block with a symmetric min/max feasibility block and an explicit tuning direction derived from the operator.

### 2) Regime confusion (global sampling vs mood regime)
- Assessment: Valid. The report currently blends global observations with in-regime logic. This is particularly confusing when gates are incompatible with the mood regime and the emotion is effectively hard-zeroed in-regime.
- Decision: Adopt. Make all gate and feasibility reporting regime-aware and explicitly label the regime used for each statistic.

### 3) Gate compatibility check in the mood regime
- Assessment: Useful and low risk. This is a deterministic check that clarifies why an emotion is guaranteed to be 0 within the expression's mood regime.
- Decision: Adopt. Provide a per-prototype gate compatibility check against the implied mood bounds.

### 4) Split prototype math into Global / In-Regime / Near-Hit regimes
- Assessment: Valuable for the report, but potentially too verbose for the primary UI. "Near-hit" is helpful but not required for the first iteration.
- Decision: Adopt for the report. For non-report output, summarize as global vs in-regime only. Near-hit can be added later if needed.

### 5) Mark clauses redundant in regime
- Assessment: Strongly beneficial. Prevents wasting time on globally failing clauses that are guaranteed true once the mood regime is satisfied.
- Decision: Adopt. Surface this both in the report and in the UI (expanded clause details / badges).

### 6) Print global vs in-regime fail rates consistently
- Assessment: Useful and consistent with existing conditional pass rate tables. Enhances clarity without heavy computation.
- Decision: Adopt for report and for key UI surfaces (Top Blockers and expanded details).

## Proposed Reporting Changes (Monte Carlo Report)

### A) Standardized Feasibility Block per Clause
Replace the existing "Max Achievable / Required / Gap" block with a symmetric structure:

- Achievable range (gated): [min_possible, max_possible]
- Threshold: t
- Status: impossible / always / sometimes
- Slack:
  - For >=: feasibility slack = max_possible - t; always slack = min_possible - t
  - For <=: feasibility slack = t - min_possible; always slack = t - max_possible
- Tuning direction:
  - >= loosen: t down; tighten: t up
  - <= loosen: t up; tighten: t down

This fixes operator ambiguity and removes the need for interpretive prose.

### B) Regime-Aware Prototype Math
For each emotion referenced in prerequisites, report three labeled regimes:

1) Global (unconditional)
2) In mood regime (all mood constraints pass)
3) Near-hit regime (optional; suggested later): all non-emotion clauses pass

For each regime, report:
- gate pass rate
- achievable range (min/max)
- distribution (P50/P90/P95) of intensity

Note: In the first iteration, the report should include (1) and (2). (3) can be deferred.

### C) Gate Compatibility Check
Add a per-prototype gate compatibility block that compares gate constraints to the expression's mood regime bounds:

- gate_possible_in_regime: true/false
- reason when false (e.g., engagement_min 0.15 > gate_max -0.20)
- implied in-regime intensity behavior (e.g., "hard-zeroed by gate")

### D) Regime Redundancy Flag
For each clause, add:
- Redundant in regime: YES/NO

Definition:
- For x <= t: redundant in regime if max_possible <= t
- For x >= t: redundant in regime if min_possible >= t

### E) Regime-Qualified Fail Rates
Wherever a fail rate is printed (blockers, worst offenders, prototype math), include:
- Fail% global
- Fail% | mood-pass (in-regime)

## Proposed Non-Report UI Placement (Expression Diagnostics Page)

### 1) Top Blockers Table
- Keep the existing columns, but add an expand-row detail panel for each clause with:
  - Fail% global and Fail% | mood-pass
  - Regime redundancy flag
  - Feasibility summary: achievable range + status
  - Tuning direction (simple label like "loosen: threshold up" for <=)

Rationale: avoids widening the table while making the new data discoverable.

### 2) Conditional Pass Rates Section
- Add a short "Regime context" blurb under the intro, noting that in-regime rates are used for the clause detail expansions above.
- If gate incompatibility exists, show a summary warning here (e.g., "X prototypes are gate-incompatible with the mood regime; see report").

### 3) Prototype Fit Analysis (Optional Enhancement)
- In the detailed prototype info (not the main table), add:
  - gate compatibility status
  - in-regime achievable range

Rationale: keeps primary table readable while providing targeted detail for tuning.

### 4) Report Modal Launch Context
- Add a note near "Generate Report" or in the report header indicating that the report includes global vs in-regime statistics and feasibility summaries.

## Data Requirements (Model-Level)

The Monte Carlo result payload should include, per clause and per emotion prototype:
- min_possible / max_possible (global and in-regime)
- pass rate in-regime (already partly available)
- gate compatibility verdict and reason
- redundancy flag in-regime
- tuning direction label based on operator

Note: This can reuse and extend the existing Monte Carlo simulator outputs and gate/constraint analyzer inputs.

## Non-Goals

- No UI redesign or layout overhaul.
- No changes to sampling distributions or sample sizes.
- No implementation of near-hit regime in the initial non-report UI.

## Open Questions

- The repo references `specs/expression-diagnostics.md` in code comments, but the file is missing. Should this spec be cross-linked from a new or restored base spec?
- Should the near-hit regime be computed in the first iteration, or deferred until after the in-regime/global split ships?
