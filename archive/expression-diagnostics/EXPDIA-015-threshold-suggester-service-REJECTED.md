# EXPDIA-015: Create ThresholdSuggester Service - REJECTED

## Status: REJECTED

**Rejection Date:** 2025-01-09

**Reason for Rejection:**

This ticket was rejected during architectural review. The proposed ThresholdSuggester service adds marginal value for significant implementation complexity. The existing expression diagnostics system already provides adequate functionality:

1. **FailureExplainer already provides basic threshold suggestions** via `#generateThresholdSuggestions()` method, which gives actionable guidance based on average violations

2. **Average violation metric is sufficient** - When Monte Carlo shows "anger >= 0.7 fails 80% with avg violation 0.25", content authors already know to lower threshold by approximately 0.25

3. **Manual iteration is natural** - Authors will experiment and re-run Monte Carlo simulations anyway as part of the creative workflow

4. **Performance cost is significant** - Each suggestion would require Monte Carlo simulation (1000+ samples), multiplied by number of blockers

5. **Marginal UX improvement** - The difference between "try ~0.45" (existing) and "0.45 would improve rate by 12.3%" (proposed) is nice-to-have but not essential

---

## Original Ticket Content (Preserved for Reference)

### Summary

Implement counterfactual analysis to suggest threshold adjustments that would improve trigger rates. For each top blocker, calculate what threshold change would eliminate it and estimate the resulting new trigger probability.

### Priority: Medium | Effort: Medium

### Rationale

When content authors discover their expression has a low trigger rate, they need actionable guidance. The ThresholdSuggester analyzes which threshold adjustments would have the largest impact, giving authors concrete values to change rather than requiring manual trial-and-error.

### Dependencies

- **EXPDIA-007** (MonteCarloSimulator for rate estimation)
- **EXPDIA-008** (FailureExplainer for blocker identification)
- **EXPDIA-005** (DI registration pattern)

### Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/ThresholdSuggester.js` | **Create** |
| `src/expressionDiagnostics/services/index.js` | **Modify** (add export) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modify** (add token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modify** (add registration) |
| `tests/unit/expressionDiagnostics/services/thresholdSuggester.test.js` | **Create** |

### Out of Scope

- **DO NOT** modify MonteCarloSimulator or FailureExplainer
- **DO NOT** implement UI components - that's EXPDIA-016
- **DO NOT** auto-apply suggestions to expression files
- **DO NOT** modify existing expression services
- **DO NOT** implement dynamics mode constraints

### Proposed Implementation

The proposed implementation included a ThresholdSuggester class that would:
- Extract constraint info from JSON Logic
- Calculate suggested thresholds based on violations
- Re-run Monte Carlo with modified expressions to verify improvements
- Generate human-readable rationales
- Sort suggestions by impact

*(Full implementation details omitted for brevity - see original ticket in git history if needed)*
