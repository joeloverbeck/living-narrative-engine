# PROREGGATALI-000: Prototype-Regime Gate Alignment Diagnostic (Overview)

## Summary

Add a diagnostic to the Monte Carlo simulator report (`expression-diagnostics.html`) that detects structurally unreachable emotions caused by conflicts between an expression's AND-only mood regime and emotion prototype gates.

## Problem Statement

When an expression prerequisite references an emotion threshold (e.g., `emotions.quiet_absorption >= 0.55`), the emotion's intensity depends on its prototype passing all gates. If the expression also constrains mood axes (AND-only regime), those constraints may make certain prototype gates impossible to satisfy.

**Example Contradiction**:
- Expression regime: `mood.agency_control >= 0.15` → interval `[0.15, 1]`
- Emotion `quiet_absorption` prerequisite: `emotions.quiet_absorption >= 0.55`
- Prototype gate for `quiet_absorption`: `agency_control <= 0.10` → interval `[-1, 0.10]`
- **Result**: Gate requires `agency_control <= 0.10` but regime requires `>= 0.15`. Intersection is empty → emotion intensity is always 0.

This is a **hard impossibility** where the emotion is clamped to 0.

## Ticket Dependency Graph

```
PROREGGATALI-001 (Core Service)
        │
        ▼
PROREGGATALI-002 (DI Registration)
        │
        ▼
PROREGGATALI-003 (Report Integration)
        │
        ├──────────────┐
        ▼              ▼
PROREGGATALI-004   PROREGGATALI-005
(Unit Tests)       (Integration Tests)
```

## Ticket Summary

| Ticket | Title | Size | Files Changed |
|--------|-------|------|---------------|
| PROREGGATALI-001 | Core PrototypeGateAlignmentAnalyzer Service | ~150-200 LOC | 1 new file |
| PROREGGATALI-002 | DI Registration | ~10 LOC | 2 files |
| PROREGGATALI-003 | Report Generator Integration | ~50-80 LOC | 1 file |
| PROREGGATALI-004 | Unit Tests | ~200-300 LOC | 1 new file |
| PROREGGATALI-005 | Integration Tests | ~100-150 LOC | 1 new file |

## Execution Order

1. **PROREGGATALI-001** — Create the analyzer service
2. **PROREGGATALI-002** — Register in DI container
3. **PROREGGATALI-003** — Wire into report generator
4. **PROREGGATALI-004** — Add unit tests (can start after 001)
5. **PROREGGATALI-005** — Add integration tests (requires 001-003)

## Success Criteria (Project-Wide)

1. **Functional**: Correctly detects gate/regime contradictions for all axis types
2. **Accurate**: Uses same normalization as emotion derivation (no false positives)
3. **Minimal footprint**: Single new service, reuses existing utilities
4. **Clear diagnostics**: Distance value and fix suggestions are actionable
5. **Test coverage**: 80%+ branch coverage on new analyzer

## Key Files Reference

### Existing Utilities (Reuse)
- `src/expressionDiagnostics/utils/moodRegimeUtils.js` — `extractMoodConstraints()`
- `src/expressionDiagnostics/models/AxisInterval.js` — Interval arithmetic
- `src/expressionDiagnostics/models/GateConstraint.js` — Gate parsing

### New Files (Created by this work)
- `src/expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js`
- `tests/unit/expressionDiagnostics/services/prototypeGateAlignmentAnalyzer.test.js`
- `tests/integration/expressionDiagnostics/prototypeGateAlignmentReport.integration.test.js`

### Modified Files
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
- `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

## Report Output Example

```markdown
## Prototype Gate Alignment

| Emotion | Prototype Gate | Regime (axis) | Status | Distance |
|---------|----------------|---------------|--------|----------|
| quiet_absorption | `agency_control <= 0.10` | agency_control ∈ [0.15, 1.00] | **CONTRADICTION** | 0.050 |
| quiet_absorption | `threat <= 0.35` | threat ∈ [-1.00, 0.20] | OK | — |

> **Unreachable emotion under regime**: `emotions.quiet_absorption` is always 0 in-regime because prototype gate `agency_control <= 0.10` contradicts regime `agency_control >= 0.15`.
> **Fix**: Relax regime on `agency_control`, loosen the prototype gate, or replace/create a prototype (e.g., focused_absorption).
```

## Deferred Features

- **Tight passage detection**: `warn` severity for near-contradictions (razor-thin intersection)
- **Auto-fix suggestions**: Generate prototype variant with relaxed gate
- **UI highlighting**: Color-code contradictions in expression list panel

## Source Specification

`specs/prototype-regime-gate-alignment.md`
