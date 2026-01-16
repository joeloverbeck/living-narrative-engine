# MONCARSIMARCREF-010: Extract SensitivityAnalyzer Module

## Status: COMPLETED

**Completed**: 2026-01-16
**Outcome**: Module already existed - ticket assumptions were incorrect

---

## Summary

This ticket aimed to extract sensitivity analysis methods from `MonteCarloSimulator.js` into a consolidated `SensitivityAnalyzer` class. However, during implementation analysis, it was discovered that **the SensitivityAnalyzer already exists and is fully functional**.

## Priority: Medium | Effort: Medium (Actual: None - already done)

---

## Outcome: Module Already Existed

### Critical Finding: Ticket Assumptions Were Incorrect

The ticket contained **fundamentally flawed assumptions** about the codebase:

#### Methods That DON'T Exist (claimed in ticket)

| Claimed Method | Status |
|----------------|--------|
| `#computeThresholdSensitivityInternal()` | NOT FOUND |
| `#computeThresholdSensitivityPoint()` | NOT FOUND |
| `#buildThresholdSensitivityCurve()` | NOT FOUND |
| `#interpolateThresholdSensitivity()` | NOT FOUND |
| `#findCriticalThreshold()` | NOT FOUND |
| `#computeExpressionSensitivityInternal()` | NOT FOUND |
| `#computeExpressionSensitivityPoint()` | NOT FOUND |
| `#buildExpressionSensitivityReport()` | NOT FOUND |
| `#computePartialDerivative()` | NOT FOUND |
| `#identifySensitiveVariables()` | NOT FOUND |

#### Actual State of Codebase

| Component | Location | Status |
|-----------|----------|--------|
| SensitivityAnalyzer class | `src/expressionDiagnostics/services/SensitivityAnalyzer.js` (271 lines) | EXISTS |
| DI Token | `tokens-diagnostics.js:43` (`ISensitivityAnalyzer`) | EXISTS |
| DI Registration | `expressionDiagnosticsRegistrations.js:227-234` | EXISTS |
| Unit Tests | `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` (679 lines) | EXISTS |

### Architecture Discovery

The existing `SensitivityAnalyzer` class:
- **Location**: `src/expressionDiagnostics/services/SensitivityAnalyzer.js` (NOT in `simulatorCore/`)
- **Purpose**: Orchestrates sensitivity analysis by calling MonteCarloSimulator methods
- **Dependencies**: `logger`, `monteCarloSimulator`
- **Public Methods**: `computeSensitivityData()`, `computeGlobalSensitivityData()`
- **Design Pattern**: Facade pattern - delegates to MonteCarloSimulator for actual computation

The architecture is the **inverse** of what the ticket proposed:
- **Actual**: `SensitivityAnalyzer` → calls → `MonteCarloSimulator.computeThresholdSensitivity()`
- **Ticket assumed**: `MonteCarloSimulator` → delegates to → `SensitivityAnalyzer`

### Methods That DO Exist in MonteCarloSimulator

| Method | Lines | Type |
|--------|-------|------|
| `computeThresholdSensitivity()` | 1706-1765 | PUBLIC |
| `computeExpressionSensitivity()` | 1783-1862 | PUBLIC |
| `#replaceThresholdInLogic()` | 1876-1884 | Private helper |
| `#replaceThresholdRecursive()` | 1895-1929 | Private helper |
| `#evaluateThresholdCondition()` | 1940-1946 | Private helper |
| `#getNestedValue()` | 951+ | Private helper (shared) |

---

## Verification Results

### Test Results

```
PASS tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js
Test Suites: 1 passed, 1 total
Tests:       15 passed, 15 total

Coverage:
SensitivityAnalyzer.js | 93.54% Stmts | 75.58% Branch | 100% Funcs | 93.4% Lines
```

### Files Verified

| File | Purpose | Status |
|------|---------|--------|
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | Main class | EXISTS (271 lines) |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Token definition | EXISTS (`ISensitivityAnalyzer` at line 43) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | DI registration | EXISTS (lines 226-234) |
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Unit tests | EXISTS (679 lines, 15 tests) |

---

## Definition of Done

- [x] `SensitivityAnalyzer.js` created - **ALREADY EXISTED**
- [x] DI token added to `tokens-diagnostics.js` - **ALREADY EXISTED** (`ISensitivityAnalyzer`)
- [x] DI registration added - **ALREADY EXISTED** (lines 226-234)
- [x] MonteCarloSimulator integration - **ALREADY WORKS** (SensitivityAnalyzer delegates to MonteCarloSimulator)
- [x] Unit tests created with >90% coverage - **ALREADY EXISTED** (93.4% coverage, 15 tests)
- [x] All tests pass - **CONFIRMED** (15/15 passing)
- [x] Type check passes - **CONFIRMED**

---

## Why No Code Changes Were Required

The existing architecture is correct and complete:

1. **SensitivityAnalyzer** (the facade class) exists at `src/expressionDiagnostics/services/SensitivityAnalyzer.js`
2. It delegates to **MonteCarloSimulator.computeThresholdSensitivity()** and **MonteCarloSimulator.computeExpressionSensitivity()**
3. The DI system properly wires them together
4. Comprehensive tests exist with 93.4% coverage

The ticket proposed moving methods from MonteCarloSimulator INTO a new SensitivityAnalyzer, but:
- Those specific methods (10 claimed) don't exist
- A SensitivityAnalyzer already exists with proper delegation
- The current architecture is cleaner (facade pattern)

---

## Lessons Learned

1. **Always verify codebase state** before creating extraction tickets
2. **Search for existing implementations** before assuming they don't exist
3. **The facade pattern was already applied** - SensitivityAnalyzer orchestrates, MonteCarloSimulator computes
4. **Ticket generation tooling** may have assumed method names that don't exist

---

## Original Ticket Content (For Reference)

The original ticket assumed 10 private methods needed extraction. These methods were hypothetical and never existed in the codebase. The actual architecture uses:
- `SensitivityAnalyzer` as a facade/orchestrator
- `MonteCarloSimulator` containing the core computation methods
- Clean separation of concerns already in place

---

## Files NOT Modified (No Changes Needed)

| File | Reason |
|------|--------|
| `src/expressionDiagnostics/services/SensitivityAnalyzer.js` | Already complete |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Architecture correct as-is |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Token already exists |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Registration already exists |
| `tests/unit/expressionDiagnostics/services/sensitivityAnalyzer.test.js` | Tests already comprehensive |
