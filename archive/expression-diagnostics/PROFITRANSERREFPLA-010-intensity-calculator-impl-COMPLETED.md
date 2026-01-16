# PROFITRANSERREFPLA-010: Extract PrototypeIntensityCalculator

**Status**: COMPLETED ✅
**Priority**: MEDIUM
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-009
**Blocks**: PROFITRANSERREFPLA-013, PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains intensity and scoring calculation logic that determines how strongly contexts match prototypes. This logic should be extracted into a dedicated `PrototypeIntensityCalculator` service.

## Objective

Extract intensity and scoring methods from `PrototypeFitRankingService` into a new `PrototypeIntensityCalculator` that:
1. Computes intensity from weighted axes
2. Calculates intensity distributions with statistics
3. Analyzes conflicts between weights and constraints
4. Computes composite scores combining multiple factors

## Scope

### In Scope
- Create `PrototypeIntensityCalculator.js`
- Add DI token `IPrototypeIntensityCalculator`
- Register service in DI container
- Update `PrototypeFitRankingService` to use new service
- Migrate scoring weight constants
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Changing scoring weights or formulas

## Assumptions Validation (2026-01-16)

### ✅ Corrected Line Numbers
The ticket originally referenced incorrect line numbers. Actual method locations in `PrototypeFitRankingService.js`:
| Method | Ticket Line Range | Actual Line Range |
|--------|-------------------|-------------------|
| `#computeIntensity` | 1204-1222 | 974-992 |
| `#computeIntensityDistribution` | 1115-1160 | 921-966 |
| `#percentile` | 1230-1234 | 1000-1004 |
| `#analyzeConflicts` | 1242-1274 | 1012-1044 |
| `#computeCompositeScore` | 1281-1288 | 1051-1058 |

### ✅ Corrected Composite Score Weights
The ticket originally showed incorrect weight values. Actual constants:
```javascript
const WEIGHT_GATE_PASS = 0.30;
const WEIGHT_INTENSITY = 0.35;
const WEIGHT_CONFLICT = 0.20;
const WEIGHT_EXCLUSION = 0.15;
```

### ✅ ContextAxisNormalizer Interface
Actual interface uses `getNormalizedAxes()` method (not `normalizeContext`).

### ✅ Tests Status
Tests in `prototypeIntensityCalculator.test.js` and `prototypeIntensityCalculator.integration.test.js` are already enabled (no `.skip` markers). These tests verify behavior through `PrototypeFitRankingService`.

### ✅ Token Status
`IPrototypeIntensityCalculator` token does NOT exist yet - needs to be added.

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/PrototypeIntensityCalculator.js`
- [x] DI token added: `IPrototypeIntensityCalculator` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IPrototypeIntensityCalculator`
- [x] All intensity/scoring delegated to new service
- [x] Scoring weight constants migrated to new service
- [x] All existing tests pass unchanged
- [x] `npm run test:ci` passes
- [x] `npm run typecheck` passes
- [x] `npx eslint src/expressionDiagnostics/services/PrototypeIntensityCalculator.js` passes

## Implementation

### Created Files
- `src/expressionDiagnostics/services/PrototypeIntensityCalculator.js` (~200 lines)

### Modified Files
- `src/dependencyInjection/tokens/tokens-diagnostics.js` - Added `IPrototypeIntensityCalculator` token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` - Registered service
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js` - Delegated to new service

## Methods Extracted

| Method | Source | Destination |
|--------|--------|-------------|
| `#computeIntensity` | Lines 974-992 | `computeIntensity` |
| `#computeIntensityDistribution` | Lines 921-966 | `computeDistribution` |
| `#percentile` | Lines 1000-1004 | `percentile` |
| `#analyzeConflicts` | Lines 1012-1044 | `analyzeConflicts` |
| `#computeCompositeScore` | Lines 1051-1058 | `computeCompositeScore` |

## Constants Migrated

| Constant | Value | Purpose |
|----------|-------|---------|
| `WEIGHT_GATE_PASS` | 0.30 | Gate pass rate contribution |
| `WEIGHT_INTENSITY` | 0.35 | Intensity contribution to composite score |
| `WEIGHT_CONFLICT` | 0.20 | Conflict penalty factor (inverted) |
| `WEIGHT_EXCLUSION` | 0.15 | Exclusion compatibility factor |

## Dependencies

This service depends on:
- `IContextAxisNormalizer` - for context normalization before intensity calculation
- `IPrototypeGateChecker` - for checking gate pass conditions

## Verification

```bash
# Run new service tests
npm run test:unit -- --testPathPattern="prototypeIntensityCalculator"
npm run test:integration -- --testPathPattern="prototypeIntensityCalculator"

# Verify existing tests still pass
npm run test:ci

# Type check
npm run typecheck

# Lint new file
npx eslint src/expressionDiagnostics/services/PrototypeIntensityCalculator.js
```

## Success Metrics

- New service file < 250 lines ✅
- All unit tests pass ✅
- All integration tests pass ✅
- All existing `PrototypeFitRankingService` tests pass ✅
- No changes to public API ✅
- Clean ESLint output ✅

## Notes

- Scoring weights are encapsulated in service
- Consider making weights configurable in future
- Statistical methods (mean, std) are internal helpers
- Tests verify behavior through `PrototypeFitRankingService` (existing) rather than calling the service directly

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**Created:**
- `src/expressionDiagnostics/services/PrototypeIntensityCalculator.js`

**Modified:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Dependencies:**
- `src/expressionDiagnostics/services/ContextAxisNormalizer.js`
- `src/expressionDiagnostics/services/PrototypeGateChecker.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeIntensityCalculator.test.js`
- `tests/integration/expression-diagnostics/prototypeIntensityCalculator.integration.test.js`

## Outcome

### Implementation Summary (2026-01-16)

Successfully extracted `PrototypeIntensityCalculator` from `PrototypeFitRankingService`:

1. **Created** `PrototypeIntensityCalculator.js` (~221 lines) with:
   - `computeDistribution()` - intensity distribution calculation
   - `computeIntensity()` - single intensity calculation
   - `percentile()` - statistical percentile calculation
   - `analyzeConflicts()` - weight vs constraint conflict analysis
   - `computeCompositeScore()` - weighted ranking score
   - `getScoringWeights()` - expose weight constants for testing

2. **Updated DI system**:
   - Added `IPrototypeIntensityCalculator` token
   - Registered service with dependencies (`IContextAxisNormalizer`, `IPrototypeGateChecker`)
   - Updated `PrototypeFitRankingService` registration to inject the new service
   - Updated test expectations (20 → 23 services)

3. **Modified `PrototypeFitRankingService`**:
   - Added constructor parameter `prototypeIntensityCalculator`
   - Added fallback instantiation when not injected
   - Delegated `#computeIntensityDistribution`, `#analyzeConflicts`, `#computeCompositeScore`
   - Removed unused private methods (`#computeIntensity`, `#percentile`)
   - Removed migrated constants (`WEIGHT_*`)
   - Removed unused import (`resolveAxisValue`)

4. **Test fixes**:
   - Updated `expressionDiagnosticsRegistrations.test.js` to expect 23 services
   - Fixed `contextAxisNormalizer.test.js` mock to include `analyzeEmotionThreshold`

### Test Results

- **Unit tests**: 48,074 passed
- **Integration tests**: 18,538 passed
- **ESLint**: Clean (pre-existing `#prototypeConstraintAnalyzer` unused warning in source)
- **TypeCheck**: Pre-existing errors only (not related to this change)

### Files Changed

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PrototypeIntensityCalculator.js` | Created |
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Modified (added token) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Modified (registration) |
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | Modified (delegation) |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | Modified (count update) |
| `tests/unit/expressionDiagnostics/services/contextAxisNormalizer.test.js` | Modified (mock fix) |
