# PROFITBLOSCODIS-013: DI Tokens and Factory Registrations

## Status: ✅ COMPLETED

## Summary

Register all new services with the dependency injection container by adding tokens and factory registrations.

## Files to Touch

### Modify
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
- `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js`

## Out of Scope

- ❌ Service implementation changes
- ❌ Changes to existing token definitions
- ❌ Changes to container configuration
- ❌ Integration tests (PROFITBLOSCODIS-014)

## Implementation Details

### Token Additions (tokens-diagnostics.js)

Add 5 new tokens to `diagnosticsTokens`:

```javascript
export const diagnosticsTokens = freeze({
  // ... existing tokens ...

  // Non-Axis Feasibility Analysis (PROFITBLOSCODIS series)
  INonAxisClauseExtractor: 'INonAxisClauseExtractor',
  INonAxisFeasibilityAnalyzer: 'INonAxisFeasibilityAnalyzer',
  IFitFeasibilityConflictDetector: 'IFitFeasibilityConflictDetector',

  // Scope Disambiguation Section Generators (PROFITBLOSCODIS series)
  INonAxisFeasibilitySectionGenerator: 'INonAxisFeasibilitySectionGenerator',
  IConflictWarningSectionGenerator: 'IConflictWarningSectionGenerator',
});
```

### Import Additions (expressionDiagnosticsRegistrations.js)

```javascript
import NonAxisClauseExtractor from '../../expressionDiagnostics/services/NonAxisClauseExtractor.js';
import NonAxisFeasibilityAnalyzer from '../../expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js';
import FitFeasibilityConflictDetector from '../../expressionDiagnostics/services/FitFeasibilityConflictDetector.js';
import NonAxisFeasibilitySectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js';
import ConflictWarningSectionGenerator from '../../expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js';
```

### Factory Registrations (expressionDiagnosticsRegistrations.js)

Add registrations using existing `Registrar.singletonFactory()` pattern:

```javascript
// Non-Axis Clause Extractor (PROFITBLOSCODIS-003)
registrar.singletonFactory(
  diagnosticsTokens.INonAxisClauseExtractor,
  (c) =>
    new NonAxisClauseExtractor({
      logger: c.resolve(tokens.ILogger),
    })
);
safeDebug(`Registered ${diagnosticsTokens.INonAxisClauseExtractor}`);

// Non-Axis Feasibility Analyzer (PROFITBLOSCODIS-004)
registrar.singletonFactory(
  diagnosticsTokens.INonAxisFeasibilityAnalyzer,
  (c) =>
    new NonAxisFeasibilityAnalyzer({
      logger: c.resolve(tokens.ILogger),
      clauseExtractor: c.resolve(diagnosticsTokens.INonAxisClauseExtractor),
    })
);
safeDebug(`Registered ${diagnosticsTokens.INonAxisFeasibilityAnalyzer}`);

// Fit Feasibility Conflict Detector (PROFITBLOSCODIS-005)
registrar.singletonFactory(
  diagnosticsTokens.IFitFeasibilityConflictDetector,
  (c) =>
    new FitFeasibilityConflictDetector({
      logger: c.resolve(tokens.ILogger),
    })
);
safeDebug(`Registered ${diagnosticsTokens.IFitFeasibilityConflictDetector}`);

// Non-Axis Feasibility Section Generator (PROFITBLOSCODIS-009)
registrar.singletonFactory(
  diagnosticsTokens.INonAxisFeasibilitySectionGenerator,
  (c) =>
    new NonAxisFeasibilitySectionGenerator({
      logger: c.resolve(tokens.ILogger),
    })
);
safeDebug(`Registered ${diagnosticsTokens.INonAxisFeasibilitySectionGenerator}`);

// Conflict Warning Section Generator (PROFITBLOSCODIS-008)
registrar.singletonFactory(
  diagnosticsTokens.IConflictWarningSectionGenerator,
  (c) =>
    new ConflictWarningSectionGenerator({
      logger: c.resolve(tokens.ILogger),
    })
);
safeDebug(`Registered ${diagnosticsTokens.IConflictWarningSectionGenerator}`);
```

### Dependency Wiring

Critical: NonAxisFeasibilityAnalyzer depends on NonAxisClauseExtractor:
- Register NonAxisClauseExtractor BEFORE NonAxisFeasibilityAnalyzer
- Use `c.resolve(diagnosticsTokens.INonAxisClauseExtractor)` in analyzer factory

## Validation Notes (Reassessed)

### Constructor Signatures Verified

Based on code inspection of actual implementations:

1. **NonAxisClauseExtractor** (src/expressionDiagnostics/services/NonAxisClauseExtractor.js:65-70)
   - Constructor: `{ logger }` - logger required ✅

2. **NonAxisFeasibilityAnalyzer** (src/expressionDiagnostics/services/NonAxisFeasibilityAnalyzer.js:75-84)
   - Constructor: `{ logger, clauseExtractor }` - both required ✅
   - Validates clauseExtractor as 'INonAxisClauseExtractor'

3. **FitFeasibilityConflictDetector** (src/expressionDiagnostics/services/FitFeasibilityConflictDetector.js:73-78)
   - Constructor: `{ logger }` - logger required ✅

4. **NonAxisFeasibilitySectionGenerator** (src/expressionDiagnostics/services/sectionGenerators/NonAxisFeasibilitySectionGenerator.js:25-27)
   - Constructor: `{ logger = null } = {}` - logger optional with default ✅

5. **ConflictWarningSectionGenerator** (src/expressionDiagnostics/services/sectionGenerators/ConflictWarningSectionGenerator.js:23-25)
   - Constructor: `{ logger = null } = {}` - logger optional with default ✅

### Test Count Update Required

Current test expects 26 registered services. After adding 5 new tokens, tests must expect 31 services.

## Acceptance Criteria

### Tests That Must Pass

1. **Token definition tests**:
   - All 5 new tokens exist in `diagnosticsTokens`
   - Token names follow `I[ServiceName]` convention
   - Tokens are strings (not symbols)

2. **Resolution tests**:
   - `container.resolve(diagnosticsTokens.INonAxisClauseExtractor)` succeeds
   - `container.resolve(diagnosticsTokens.INonAxisFeasibilityAnalyzer)` succeeds
   - `container.resolve(diagnosticsTokens.IFitFeasibilityConflictDetector)` succeeds
   - `container.resolve(diagnosticsTokens.INonAxisFeasibilitySectionGenerator)` succeeds
   - `container.resolve(diagnosticsTokens.IConflictWarningSectionGenerator)` succeeds

3. **Dependency injection tests**:
   - Resolved NonAxisFeasibilityAnalyzer has working clauseExtractor
   - All services have working logger

4. **Singleton behavior tests**:
   - Same instance returned on multiple resolve calls
   - Services properly cached

5. **Debug logging tests**:
   - Registration debug messages logged for each new service

### Commands That Must Succeed

```bash
npm run typecheck
npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js
npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js
npm run test:unit -- --testPathPattern="expressionDiagnosticsRegistrations"
```

## Invariants That Must Remain True

1. Token names follow existing `I[ServiceName]` naming convention
2. Factory registration follows existing `Registrar.singletonFactory()` pattern exactly
3. NonAxisFeasibilityAnalyzer registered AFTER NonAxisClauseExtractor (dependency order)
4. All existing service registrations unchanged
5. All existing token definitions unchanged

## Dependencies

- PROFITBLOSCODIS-003 (NonAxisClauseExtractor implementation)
- PROFITBLOSCODIS-004 (NonAxisFeasibilityAnalyzer implementation)
- PROFITBLOSCODIS-005 (FitFeasibilityConflictDetector implementation)
- PROFITBLOSCODIS-008 (ConflictWarningSectionGenerator implementation)
- PROFITBLOSCODIS-009 (NonAxisFeasibilitySectionGenerator implementation)
- PROFITBLOSCODIS-012 (MonteCarloReportGenerator integration)

## Blocked By

- PROFITBLOSCODIS-003, 004, 005, 008, 009, 012

## Blocks

- PROFITBLOSCODIS-014 (Integration tests)

---

## Outcome

### What Was Actually Changed

1. **tokens-diagnostics.js**: Added 5 new tokens as specified:
   - `INonAxisClauseExtractor`
   - `INonAxisFeasibilityAnalyzer`
   - `IFitFeasibilityConflictDetector`
   - `INonAxisFeasibilitySectionGenerator`
   - `IConflictWarningSectionGenerator`

2. **expressionDiagnosticsRegistrations.js**: Added 5 imports and 5 factory registrations with correct dependency wiring:
   - NonAxisClauseExtractor registered with logger dependency
   - NonAxisFeasibilityAnalyzer registered with logger and clauseExtractor (correctly ordered after NonAxisClauseExtractor)
   - FitFeasibilityConflictDetector registered with logger
   - NonAxisFeasibilitySectionGenerator registered with logger
   - ConflictWarningSectionGenerator registered with logger

3. **expressionDiagnosticsRegistrations.test.js**: Updated tests:
   - Changed expected service count from 26 to 31
   - Added 5 registration tests for the new services
   - Added 5 token definition tests

### Deviations from Original Plan

**Minor correction made to ticket assumptions:**
- Section generators (`NonAxisFeasibilitySectionGenerator`, `ConflictWarningSectionGenerator`) have optional logger dependencies with defaults (`{ logger = null } = {}`), but passing logger explicitly still works. Factory registrations pass logger explicitly for consistency.

### Test Results

- All 34 unit tests pass for `expressionDiagnosticsRegistrations`
- All 188 unit tests pass for the service implementations
- ESLint: No errors in modified files
- Typecheck: Pre-existing type errors in file unrelated to this ticket's changes
