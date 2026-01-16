# MONCARSIMARCREF-011: Extract ViolationEstimator Module

## Status: COMPLETED ✅

## Summary

Extract violation analysis methods from `MonteCarloSimulator.js` into a new `ViolationEstimator` class. This is Priority 6 for extraction as "isolated analysis." The violation analysis subsystem handles failure estimation, failed leaf collection, ceiling data extraction, and violation summary generation.

## Priority: Medium | Effort: Medium

## Rationale

The ViolationEstimator handles failure diagnosis:
- Estimating how far values are from passing thresholds
- Collecting all failed leaf nodes in expression trees
- Generating human-readable failure summaries
- Extracting ceiling (maximum achievable) values
- Safe operand evaluation for error resilience

This information is critical for the diagnostics UI to show users why expressions fail and how far off they are from success.

## Dependencies

- **MONCARSIMARCREF-001** through **MONCARSIMARCREF-005** (All Phase 1 integration tests must pass first)
- **MONCARSIMARCREF-006** (ContextBuilder must be extracted first)
- **MONCARSIMARCREF-007** (ExpressionEvaluator must be extracted first - violation analysis uses evaluation results)
- **MONCARSIMARCREF-008** (GateEvaluator must be extracted first)
- **MONCARSIMARCREF-009** (PrototypeEvaluator must be extracted first)
- **MONCARSIMARCREF-010** (SensitivityAnalyzer must be extracted first)

## Files Touched

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/simulatorCore/ViolationEstimator.js` | **Created** (253 lines) |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | **Modified** - Delegates to ViolationEstimator |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Modified** - Added `IMonteCarloViolationEstimator` token |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Modified** - Registered ViolationEstimator |
| `tests/unit/expressionDiagnostics/services/simulatorCore/violationEstimator.test.js` | **Created** (34 tests) |
| `tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js` | **Created** (9 tests) |

## Definition of Done

- [x] `ViolationEstimator.js` created in `src/expressionDiagnostics/services/simulatorCore/`
- [x] Core violation analysis methods extracted from MonteCarloSimulator
- [x] DI token added to `tokens-diagnostics.js`
- [x] DI registration added to `expressionDiagnosticsRegistrations.js`
- [x] MonteCarloSimulator updated to inject and delegate to ViolationEstimator
- [x] Unit tests created with >90% coverage (91.89% achieved)
- [x] Integration tests created and passing (9 tests)
- [x] All existing tests pass
- [x] Type check passes
- [x] Lint passes on modified files

## Outcome

### Implementation Summary

The ViolationEstimator was implemented with a **leaner and more focused design** than originally specified in the ticket.

### Actual vs Planned Implementation

| Aspect | Ticket Plan | Actual Implementation |
|--------|-------------|----------------------|
| Methods extracted | 9 methods | 6 methods |
| Dependencies | `{ logger, contextBuilder }` | **None** (stateless design) |
| Public API | All 9 methods public | 2 public, 4 private |
| DI Token | `ViolationEstimator` | `IMonteCarloViolationEstimator` |
| Coverage | >90% | 91.89% |

### Method Mapping

| Ticket Expected | Actual Implementation | Notes |
|-----------------|----------------------|-------|
| `#estimateViolation()` | Not needed | Logic integrated differently |
| `#estimateLeafViolation()` | Built into `#extractViolationInfo()` | Combined functionality |
| `#collectFailedLeaves()` | ✅ `#collectFailedLeaves()` (private) | Exact match |
| `#getFailedLeavesSummary()` | ✅ `getFailedLeavesSummary()` (public) | Made public for direct use |
| `#extractViolationInfo()` | ✅ `#extractViolationInfo()` (private) | Exact match |
| `#countFailedClauses()` | ✅ `countFailedClauses()` (public) | Made public for direct use |
| `#countFailedLeavesInTree()` | ✅ `#countFailedLeavesInTree()` (private) | Exact match |
| `#extractCeilingData()` | Remained in MonteCarloSimulator | Ceiling extraction closely tied to clause failure tracking |
| `#safeEvalOperand()` | ✅ `#safeEvalOperand()` (private) | Exact match |

### Design Decisions

1. **Stateless Design**: The ViolationEstimator has no constructor dependencies, making it simpler and easier to test. It uses `jsonLogic` directly for evaluation.

2. **Better Encapsulation**: Only 2 public methods (`countFailedClauses`, `getFailedLeavesSummary`) with 4 private helper methods. This provides a cleaner API than exposing all 9 methods.

3. **Ceiling Data Remains with Simulator**: The `#extractCeilingData()` method stayed in MonteCarloSimulator because ceiling data extraction is closely tied to the clause failure tracking loop that already exists there.

4. **Combined Functionality**: Some planned methods were combined (e.g., `estimateLeafViolation` into `extractViolationInfo`) for a more cohesive implementation.

### Test Results

```
Unit Tests:        34 passed, 91.89% coverage
Integration Tests:  9 passed
```

### Key Files

- **Implementation**: `src/expressionDiagnostics/services/simulatorCore/ViolationEstimator.js`
- **DI Token**: `src/dependencyInjection/tokens/tokens-diagnostics.js:26` (`IMonteCarloViolationEstimator`)
- **DI Registration**: `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js:122-124`
- **Unit Tests**: `tests/unit/expressionDiagnostics/services/simulatorCore/violationEstimator.test.js`
- **Integration Tests**: `tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js`

### Verification Commands Used

```bash
# Unit tests pass
npm run test:unit -- tests/unit/expressionDiagnostics/services/simulatorCore/violationEstimator.test.js --verbose

# Integration tests pass
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloViolationAnalysis.integration.test.js --verbose

# All Monte Carlo integration tests pass
npm run test:integration -- tests/integration/expression-diagnostics/monteCarlo*.integration.test.js
```

### Completion Date

Archived: 2026-01-16
