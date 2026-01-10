# EXPDIA-016: Add Dynamics Mode and Suggestions to UI - REJECTED

## Status: REJECTED

**Rejection Date:** 2025-01-09

**Reason for Rejection:**

This ticket was rejected during architectural review for the following reasons:

### 1. Suggestions UI Dependency on Rejected EXPDIA-015

The Suggestions UI portion of this ticket depends on the ThresholdSuggester service from EXPDIA-015, which was rejected. Without the underlying service, the UI component has no functionality to display.

### 2. Dynamics Mode Introduces Unwarranted Complexity

The Dynamics Mode feature (constraining analysis to states reachable within N turns with per-turn deltas) was evaluated and found to add significant complexity for marginal benefit:

- **Game-specific assumptions**: Per-turn deltas (mood delta, sexual delta) are arbitrary values that would need calibration per game/mod
- **UI complexity**: Adds multiple configuration inputs (max turns, mood delta, sexual delta) that increase cognitive load
- **Already covered by static analysis**: The PathSensitiveAnalyzer already detects the real problems:
  - Unreachable thresholds → impossible to trigger
  - Gate conflicts → structural impossibility
  - Knife-edge constraints → fragile conditions
- **"Reachable but slow" is rarely a concern**: If an expression CAN trigger, content authors typically don't care whether it takes 5 turns or 50 - that's emergent gameplay, not a design flaw
- **Prototype-aware analysis already exists**: PathSensitiveAnalyzer handles prototype-gated branches, which is the more meaningful gameplay constraint

---

## Original Ticket Content (Preserved for Reference)

### Summary

Add dynamics mode toggle that constrains analysis to realistic per-turn deltas, and a suggestions panel showing threshold adjustments that would improve trigger rates. Each suggestion displays original value, suggested value, and estimated improvement.

### Priority: Medium | Effort: Medium

### Rationale

Pure mathematical analysis may find states that are reachable in theory but impossible to reach through normal gameplay. Dynamics mode constrains analysis to states reachable within N turns. The suggestions panel turns diagnostic data into actionable guidance for content authors.

### Dependencies

- **EXPDIA-006** (Basic Diagnostics UI structure)
- **EXPDIA-009** (Monte Carlo UI for integration)
- **EXPDIA-012** (Witness State UI for integration)
- **EXPDIA-015** (ThresholdSuggester service) - **REJECTED**

### Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `css/expression-diagnostics.css` | **Modify** |
| `expression-diagnostics.html` | **Modify** |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** |

### Out of Scope

- **DO NOT** modify ThresholdSuggester service - that's EXPDIA-015
- **DO NOT** modify MonteCarloSimulator or WitnessStateFinder services
- **DO NOT** auto-apply suggestions to expression files
- **DO NOT** implement expression export/import functionality
- **DO NOT** add character-specific starting state configuration

### Proposed Features

1. **Dynamics Mode Toggle**: Checkbox to enable/disable dynamics constraints
2. **Dynamics Configuration**: Inputs for max turns, mood delta per turn, sexual delta per turn
3. **Dynamics Indicators**: Visual indicators on section headers when mode is enabled
4. **Suggestions Panel**: Display ThresholdSuggester results with:
   - Current vs potential trigger rate comparison
   - Individual suggestion cards with field, values, improvement percentage
   - Copy-to-clipboard functionality
   - Rationale text for each suggestion

*(Full implementation details including HTML, CSS, and JavaScript omitted for brevity - see original ticket in git history if needed)*
