# MONCARREPGENREFANA-003: Extract StatisticalComputationService

## Summary

Extract 7 statistical/computation methods from MonteCarloReportGenerator into a dedicated StatisticalComputationService. These methods perform mathematical calculations and gate/axis normalization operations.

## Priority: High | Effort: Medium | Risk: LOW

## Rationale

These methods share common responsibilities:
- Statistical distribution calculations
- Gate pass rate computations
- Context normalization and axis contribution analysis
- Confidence interval calculations

## CORRECTED Assumptions (Updated from original analysis)

**Original ticket incorrectly stated:**
- "Pure mathematical functions with no side effects" → PARTIALLY TRUE
- "No dependencies on other services" → FALSE
- "Worker file needs modification" → FALSE

**Actual dependencies found:**
- `GateConstraint` model (for gate parsing)
- `axisNormalizationUtils.js` functions (`resolveAxisValue`, `normalizeMoodAxes`, `normalizeSexualAxes`, `normalizeAffectTraits`)
- `intensitySignalUtils.js` functions (`computeIntensitySignals`)
- `moodRegimeUtils.js` functions (`evaluateConstraint`)

**Scope adjustment:**
- `#aggregateLeafViolationStats` REMOVED from scope - depends on `#flattenLeaves` which belongs in MONCARREPGENREFANA-005 (BlockerTreeTraversal)
- Worker file does NOT need changes - `MonteCarloReportGenerator` creates services internally

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/StatisticalComputationService.js` | **Create** - New service (~300 lines) |
| `tests/unit/expressionDiagnostics/services/statisticalComputationService.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export new service |

**NOT modifying:**
- `MonteCarloReportWorker.js` - Not needed (services created internally by generator)

## Out of Scope

- **DO NOT** change ReportFormattingService
- **DO NOT** change WitnessFormatter
- **DO NOT** change data extraction methods (that's MONCARREPGENREFANA-004)
- **DO NOT** change blocker tree traversal (that's MONCARREPGENREFANA-005)
- **DO NOT** change any section generators
- **DO NOT** modify DI registrations
- **DO NOT** extract `#aggregateLeafViolationStats` (deferred to MONCARREPGENREFANA-005)

## Methods to Extract (7 Primary + 4 Helpers)

### Primary Methods:
```javascript
computeDistributionStats(values)           // PURE statistical
calculateWilsonInterval(successes, total, z) // PURE statistical
computeAxisContributions(contexts, weights) // Needs helpers
computeGateFailureRates(gates, storedContexts) // Needs helpers + GateConstraint
computeGatePassRate(gates, storedContexts)     // Needs helpers + GateConstraint
computePrototypeRegimeStats(contexts, varPath, gates, weights) // Most complex
computeConditionalPassRates(filteredContexts, emotionConditions) // Needs helpers
```

### Required Helpers (also extracted):
```javascript
getNestedValue(obj, path)           // Public - needed by other future services
#normalizeAxisValue(axis, value)    // Private helper
#normalizeContextAxes(context)      // Private helper - delegates to external utils
#evaluateComparison(value, op, threshold) // Private helper - delegates to external utils
```

### External Dependencies (imports needed):
```javascript
import GateConstraint from '../models/GateConstraint.js';
import { resolveAxisValue, normalizeMoodAxes, normalizeSexualAxes, normalizeAffectTraits } from '../utils/axisNormalizationUtils.js';
import { computeIntensitySignals } from '../utils/intensitySignalUtils.js';
import { evaluateConstraint } from '../utils/moodRegimeUtils.js';
```

## Implementation Details

### Service Structure

```javascript
/**
 * @file StatisticalComputationService - Statistical calculations and gate analysis for reports
 */
import GateConstraint from '../models/GateConstraint.js';
import { resolveAxisValue, normalizeMoodAxes, normalizeSexualAxes, normalizeAffectTraits } from '../utils/axisNormalizationUtils.js';
import { computeIntensitySignals } from '../utils/intensitySignalUtils.js';
import { evaluateConstraint } from '../utils/moodRegimeUtils.js';

class StatisticalComputationService {
  // Pure statistical methods
  computeDistributionStats(values) { /* ... */ }
  calculateWilsonInterval(successes, total, z = 1.96) { /* ... */ }

  // Gate/context computation methods
  computeAxisContributions(contexts, weights) { /* ... */ }
  computeGateFailureRates(gates, storedContexts) { /* ... */ }
  computeGatePassRate(gates, storedContexts) { /* ... */ }
  computePrototypeRegimeStats(contexts, varPath, gates, weights, gateTraceResolver) { /* ... */ }
  computeConditionalPassRates(filteredContexts, emotionConditions) { /* ... */ }

  // Public helper (reusable)
  getNestedValue(obj, path) { /* ... */ }

  // Private helpers
  #normalizeAxisValue(axis, value) { /* ... */ }
  #normalizeContextAxes(context) { /* ... */ }
  #evaluateComparison(value, operator, threshold) { /* ... */ }
}

export default StatisticalComputationService;
```

### Mathematical Edge Cases to Test

- Division by zero handling
- Empty arrays
- Single-element arrays
- Negative values where applicable
- Very large values (overflow)
- NaN/Infinity handling
- Gate parsing failures (graceful handling)

## Acceptance Criteria

### Tests That Must Pass

1. **New StatisticalComputationService unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/statisticalComputationService.test.js --verbose
   ```

2. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

3. **All related unit tests pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Mathematical accuracy**: Results identical to original implementation
3. **Edge case handling**: Same behavior for edge cases (division by zero, empty arrays)
4. **Backwards compatible**: Public API of MonteCarloReportGenerator unchanged

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/statisticalComputationService.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Run all related tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/StatisticalComputationService.js
```

## Definition of Done

- [x] StatisticalComputationService.js created with 7 methods + helpers
- [x] Unit tests cover all methods with mathematical edge cases (53 tests)
- [x] MonteCarloReportGenerator.js updated to use service
- [x] index.js exports new service
- [x] Snapshot test passes unchanged
- [x] All existing tests pass (218 MonteCarloReportGenerator tests + 8 snapshot tests)
- [x] ~200 lines removed from MonteCarloReportGenerator.js

## Outcome

**COMPLETED** - 2026-01-15

### Files Changed

| File | Action | Lines |
|------|--------|-------|
| `src/expressionDiagnostics/services/StatisticalComputationService.js` | Created | ~500 lines |
| `tests/unit/expressionDiagnostics/services/statisticalComputationService.test.js` | Created | ~400 lines |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Modified | ~-200 lines |
| `src/expressionDiagnostics/services/index.js` | Modified | +1 line |

### Implementation Notes

1. **`normalizeContextAxes` made public** - Originally planned as private but needed externally from MonteCarloReportGenerator for context normalization before service calls
2. **Callback pattern for `computePrototypeRegimeStats`** - Used dependency inversion via callbacks for `resolveGateTraceTarget` and `getGateTraceSignals` to avoid circular dependencies
3. **Removed unused imports from MonteCarloReportGenerator** - `normalizeAffectTraits`, `normalizeMoodAxes`, `normalizeSexualAxes`, `computeIntensitySignals` no longer needed directly

### Test Results

- StatisticalComputationService unit tests: 53 passed
- MonteCarloReportGenerator unit tests: 218 passed
- Snapshot integration tests: 8 passed (report output unchanged)

## Dependencies

- **Requires**: MONCARREPGENREFANA-000 (baseline tests must exist) ✅ COMPLETED
- **Blocks**: MONCARREPGENREFANA-005 (BlockerTreeTraversal will use this)

## Notes

- This ticket can run in parallel with MONCARREPGENREFANA-001 and MONCARREPGENREFANA-002
- No dependencies on formatting or witness services
- `#aggregateLeafViolationStats` deferred to MONCARREPGENREFANA-005 due to `#flattenLeaves` dependency
- Worker file does not need modification (services created internally)
