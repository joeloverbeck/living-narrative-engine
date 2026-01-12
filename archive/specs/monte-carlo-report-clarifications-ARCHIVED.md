# Monte Carlo Report Clarifications and OR-Safe Metrics

## Summary

Refine Monte Carlo diagnostics so report assertions align with simulator semantics, especially for OR blocks and <= thresholds. Add order-independent OR alternative metrics and operator-aware prototype math messaging. Surface a warning when analyses assume AND-only mood constraints in the presence of OR logic.

## Goals

- Eliminate misleading assertions (e.g., <= thresholds marked as "narrow margin" reachability).
- Replace order-dependent OR breakdown with order-independent rates, while retaining the existing contribution signal (clearly labeled).
- Warn when axis-constraint-driven analyses are computed from AND-only extraction but the expression includes OR mood constraints.
- Keep report output stable in structure, updating wording and tables where accuracy improves.

## Non-Goals

- Rebuild full path-sensitive constraint analysis.
- Change Monte Carlo sampling or evaluation logic.
- Add new simulation modes or distributions.

## Observed Issues in the Brainstorming Report

1) **OR Block Success Breakdown is order-dependent**
   - Current OR contribution uses the *first* passing alternative. The breakdown can shift if condition order changes, but the report implies it is an intrinsic contribution share.

2) **Prototype Math Analysis for <= / < uses >= semantics**
   - The report prints "reachable" and "narrow margin" notes for <= thresholds. This is incorrect because <= conditions are satisfied by *lower* values, and gate failures lower intensity to 0 (making <= easier to satisfy).

3) **Constraint-derived analyses assume AND-only mood constraints**
   - Conditional pass rates, prototype fit, implied prototype, and prototype math assume all mood constraints are simultaneously required. If an expression has OR mood constraints, these analyses become overly strict. This assumption is not currently surfaced.

## Requirements

### 1) OR Breakdown: Add Order-Independent Metrics

**Data model changes (HierarchicalClauseNode):**
- Add counters:
  - `#orPassCount` (child passed and parent OR succeeded)
  - `#orExclusivePassCount` (child passed and *all other siblings failed* during an OR success)
- Add getters and `toJSON()` fields:
  - `orPassCount`, `orExclusivePassCount`
  - `orPassRate` = `orPassCount / orSuccessCount` (null if `orSuccessCount` is 0)
  - `orExclusivePassRate` = `orExclusivePassCount / orSuccessCount` (null if `orSuccessCount` is 0)

**Simulator changes (MonteCarloSimulator):**
- In the OR evaluation branch:
  - When OR succeeds, for each child:
    - `recordOrSuccess()` (existing)
    - If child passed: `recordOrPass()`
    - If child passed **and** all siblings failed: `recordOrExclusivePass()`
- Keep `recordOrContribution()` for the first passing alternative, but treat it as an order-dependent signal.

**Report changes (MonteCarloReportGenerator):**
- Update OR breakdown table to include:
  - `P(alt passes | OR pass)` (order-independent)
  - `P(alt exclusively passes | OR pass)` (order-independent)
  - `First-pass share` (existing contribution; label as order-dependent)
- Replace summary text "Success Breakdown" with "OR Alternative Coverage" and add a one-line note:
  - "First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution."

**UI changes (ExpressionDiagnosticsController):**
- Update OR breakdown display in the hierarchical tree:
  - Show `pass` and `exclusive` rates per alternative (order-independent).
  - Show first-pass share as a secondary metric and label it "first-pass (order-dependent)."
- Keep existing combined OR pass rate line.

### 2) Operator-Aware Prototype Math Analysis

**Report changes (MonteCarloReportGenerator):**
- Adjust the prototype math header and body based on operator:
  - For `>=` or `>`: keep "Max Achievable" and reachability framing.
  - For `<=` or `<`:
    - Replace "reachable" with "upper-bound safety."
    - Show `Max Achievable` vs `Threshold` as the core comparison.
    - Replace gap calculation in the narrative with `maxAchievable - threshold` and label as "overage" when positive.
- Update recommendations:
  - Only show "narrow margin" for `>=`/`>` when `gap >= 0 && gap < 0.05`.
  - For `<=`/`<`, provide:
    - If `maxAchievable <= threshold`: "Always satisfies threshold within constraints."
    - If `maxAchievable > threshold`: "Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks."
- Gate messaging for `<=`/`<`:
  - Add a note when gates are unsatisfiable: "Gate failure clamps intensity to 0, which *helps* <= conditions; gate conflicts do not block satisfaction." (do not mark as blocking for <=).

### 3) OR-Constraint Warning for Constraint-Derived Analyses

**Detection:**
- Add a JSON-logic traversal to detect `moodAxes.*` comparisons inside any `or` block.

**Where to show warnings:**
- **Report:** add a short warning paragraph at the top of these sections when OR mood constraints are present:
  - "Conditional Pass Rates"
  - "Prototype Fit Analysis"
  - "Implied Prototype"
  - "Prototype Math Analysis"
- **Main UI:** show a small inline warning banner inside the corresponding section containers when OR mood constraints are detected (re-use existing alert styles).

**Copy suggestion:**
- "This analysis treats mood-axis constraints as AND-only. OR-based mood constraints are present, so results are conservative (may be overly strict)."

## Acceptance Criteria

- OR breakdowns show order-independent pass and exclusive rates in both report and UI.
- First-pass contribution remains visible but is explicitly labeled order-dependent.
- Prototype math analysis never shows "narrow margin" for <= or < conditions.
- Prototype math analysis for <= or < uses max-achievable vs threshold framing and includes corrected recommendations.
- Sections that rely on axis constraint extraction show warnings when OR mood constraints exist.

## Files to Update

- `src/expressionDiagnostics/models/HierarchicalClauseNode.js`
- `src/expressionDiagnostics/services/MonteCarloSimulator.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`
- `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js`
- `expression-diagnostics.html` (if new warning placeholders are required)
- `css/expression-diagnostics.css` (if warning styling needs additions)

## Implementation Notes

- Keep new counters optional and default to 0 so existing output remains valid when historical data is loaded.
- Maintain existing output shape where possible to avoid breaking integrations; add new fields rather than renaming current ones.
- If warnings are visible in the main UI, ensure they auto-hide when no OR mood constraints are detected.

