# EXPDIA-005: Create Expression Diagnostics DI Registration

**Status: COMPLETED**

## Summary

Define DI tokens and create registration functions for all Expression Diagnostics services. This enables the services to be resolved from the container and used by the UI controller.

## Priority: High | Effort: Small

## Rationale

Following the project's DI patterns ensures consistent service lifecycle management, testability, and integration with the CommonBootstrapper. All services should be resolvable from the container.

## Dependencies

- **EXPDIA-001** through **EXPDIA-004** must be completed (models and initial services)
- Registration of future services (EXPDIA-007, etc.) will be added to this file as they're implemented

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | **Create** |
| `src/dependencyInjection/tokens.js` | **Modify** (add diagnostics export) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | **Create** |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | **Create** |

## Out of Scope

- **DO NOT** modify service implementations
- **DO NOT** create UI components - that's EXPDIA-006
- **DO NOT** modify build configuration - that's EXPDIA-006
- **DO NOT** register services not yet implemented (MonteCarloSimulator, etc.)

## Implementation Details

### Tokens Definition

```javascript
// src/dependencyInjection/tokens/tokens-diagnostics.js

/**
 * @file DI tokens for Expression Diagnostics services
 */

import { freeze } from '../../utils/cloneUtils.js';

export const diagnosticsTokens = freeze({
  // Phase 1 - Static Analysis
  IGateConstraintAnalyzer: 'IGateConstraintAnalyzer',
  IIntensityBoundsCalculator: 'IIntensityBoundsCalculator',

  // Phase 2 - Monte Carlo (added in EXPDIA-007)
  // IMonteCarloSimulator: 'IMonteCarloSimulator',
  // IFailureExplainer: 'IFailureExplainer',

  // Phase 3 - Witness Finding (added in EXPDIA-011)
  // IWitnessStateFinder: 'IWitnessStateFinder',

  // Phase 4 - SMT Solver (added in EXPDIA-013)
  // ISmtSolver: 'ISmtSolver',

  // Phase 5 - Suggestions (added in EXPDIA-015)
  // IThresholdSuggester: 'IThresholdSuggester',
});
```

### Update Main Tokens Export

```javascript
// src/dependencyInjection/tokens.js
// Add this import and spread into tokens object:
import { diagnosticsTokens } from './tokens/tokens-diagnostics.js';
// ...
export const tokens = freeze({
  ...diagnosticsTokens,
});

// Add named export:
export { diagnosticsTokens } from './tokens/tokens-diagnostics.js';
```

### Registration Function

```javascript
// src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

/**
 * @file DI registration for Expression Diagnostics services
 */

import { diagnosticsTokens } from '../tokens/tokens-diagnostics.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';

import GateConstraintAnalyzer from '../../expressionDiagnostics/services/GateConstraintAnalyzer.js';
import IntensityBoundsCalculator from '../../expressionDiagnostics/services/IntensityBoundsCalculator.js';

/**
 * Register Expression Diagnostics services with the DI container
 * @param {object} container - AppContainer instance
 */
export function registerExpressionDiagnosticsServices(container) {
  const registrar = new Registrar(container);
  // ... registration logic using registrar.singletonFactory()
}

/**
 * Check if all required diagnostics services are available
 * @param {object} container
 * @returns {boolean}
 */
export function isDiagnosticsAvailable(container) {
  // ... implementation
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js --verbose
```

### Unit Test Coverage Requirements

- [x] Registration function registers all Phase 1 services
- [x] All services use singletonFactory lifecycle
- [x] Services can be resolved after registration
- [x] `isDiagnosticsAvailable()` returns true when registered
- [x] `isDiagnosticsAvailable()` returns false when not registered
- [x] Token object is frozen
- [x] All tokens follow naming convention

### Invariants That Must Remain True

1. **All tokens follow naming convention** - IGateConstraintAnalyzer, etc. (I prefix)
2. **Services can be resolved from container** after registration
3. **No circular dependencies** - registration order doesn't matter
4. **Tokens are frozen** - cannot be modified at runtime
5. **Main tokens.js exports diagnosticsTokens** - available project-wide

## Verification Commands

```bash
# Run unit tests
npm run test:unit -- tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js --verbose

# Type checking
npm run typecheck

# Verify tokens export
node -e "import('./src/dependencyInjection/tokens.js').then(m => console.log(m.diagnosticsTokens))"
```

## Definition of Done

- [x] `tokens-diagnostics.js` created with Phase 1 tokens
- [x] `tokens.js` updated to export diagnosticsTokens
- [x] `expressionDiagnosticsRegistrations.js` created
- [x] `isDiagnosticsAvailable()` helper function implemented
- [x] Unit tests cover registration and resolution
- [x] All tests pass
- [x] No modifications to existing registration files

---

## Outcome

### What Was Originally Planned
- Create DI tokens file at `src/dependencyInjection/tokens/tokens-diagnostics.js`
- Update `src/dependencyInjection/tokens.js` to export diagnosticsTokens
- Create registration file at `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
- Create unit tests at `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js`

### What Was Actually Changed
All planned items were implemented with the following corrections to the ticket's assumptions:

1. **Import path for `freeze`**: Ticket originally specified `'../../utils/freeze.js'` but the actual codebase uses `'../../utils/cloneUtils.js'`

2. **DataRegistry mock in tests**: Ticket specified `getLookupData` but services actually use `dataRegistry.get('lookups', lookupId)` method

3. **Registration pattern**: Used `Registrar.singletonFactory()` following existing patterns in `monitoringRegistrations.js` rather than `registerWithLog` for consistency

### Files Created/Modified
| File | Action |
|------|--------|
| `src/dependencyInjection/tokens/tokens-diagnostics.js` | Created |
| `src/dependencyInjection/tokens.js` | Modified (added import and spread) |
| `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` | Created |
| `tests/unit/dependencyInjection/expressionDiagnosticsRegistrations.test.js` | Created |

### Test Results
- 16 unit tests passing
- 100% coverage on new registration and token files
- ESLint passes with no errors
- Token export verified via node command

### New/Modified Tests
| Test | Rationale |
|------|-----------|
| `should register GateConstraintAnalyzer` | Ensures DI integration |
| `should register IntensityBoundsCalculator` | Ensures DI integration |
| `should register exactly 2 services (Phase 1)` | Verifies correct service count |
| `should use singletonFactory lifecycle` | Ensures proper caching |
| `should log registration start and completion` | Verifies logging behavior |
| `should allow resolving GateConstraintAnalyzer after registration` | Functional integration |
| `should allow resolving IntensityBoundsCalculator after registration` | Functional integration |
| `should work without logger available` | Error resilience |
| `isDiagnosticsAvailable returns true when registered` | Utility function |
| `isDiagnosticsAvailable returns false when not registered` | Edge case |
| `isDiagnosticsAvailable returns false when only one service registered` | Partial registration edge case |
| `should export IGateConstraintAnalyzer token` | Token value verification |
| `should export IIntensityBoundsCalculator token` | Token value verification |
| `should be frozen` | Immutability enforcement |
| `should not allow modification` | Freeze validation |
| `should export diagnosticsTokens from main tokens module` | Integration with main tokens |
