# PROREGGATALI-002: DI Registration for PrototypeGateAlignmentAnalyzer

## Status

Completed

## Summary

Register the `PrototypeGateAlignmentAnalyzer` service in the dependency injection container following established patterns.

## Background

All expression diagnostics services require DI registration before they can be injected into consuming services. This ticket adds the token definition and factory registration.

## File List (Expected to Touch)

### Existing Files
- `src/dependencyInjection/tokens/tokens-diagnostics.js` — add token
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js` — add factory

## Out of Scope (MUST NOT Change)

- The analyzer implementation (`PrototypeGateAlignmentAnalyzer.js`)
- Report generator integration (handled in PROREGGATALI-003)
- Any other token files or registration files
- New tests unless the DI change exposes a missing invariant
- Any mod data under `data/mods/`
- Any UI rendering code

## Implementation Details

### Token Definition

**File**: `src/dependencyInjection/tokens/tokens-diagnostics.js`

Add to the `diagnosticsTokens` object in the existing "Prototype Constraint Analysis" section (adjacent to `IPrototypeConstraintAnalyzer`):

```javascript
// Prototype Gate Alignment Analysis (PROREGGATALI series)
IPrototypeGateAlignmentAnalyzer: 'IPrototypeGateAlignmentAnalyzer',
```

Place after `IPrototypeConstraintAnalyzer` entry.

### Factory Registration

**File**: `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

1. Add import alongside other analyzer imports (near `PrototypeConstraintAnalyzer`):

```javascript
import PrototypeGateAlignmentAnalyzer from '../../expressionDiagnostics/services/PrototypeGateAlignmentAnalyzer.js';
```

2. Add factory registration after the `IPrototypeConstraintAnalyzer` registration (~line 227):

```javascript
// Prototype Gate Alignment Analysis (PROREGGATALI series)
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeGateAlignmentAnalyzer,
  (c) =>
    new PrototypeGateAlignmentAnalyzer({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    })
);
safeDebug(`Registered ${diagnosticsTokens.IPrototypeGateAlignmentAnalyzer}`);
```

## Acceptance Criteria

### Tests That Must Pass

1. ESLint on modified files:
   - `npx eslint src/dependencyInjection/tokens/tokens-diagnostics.js`
   - `npx eslint src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`
2. Unit tests (scoped): `npm run test:unit -- --runInBand --testPathPatterns="expressionDiagnostics" --coverage=false`

### Invariants That Must Remain True

1. Token name follows pattern: `IPrototypeGateAlignmentAnalyzer`
2. Token string matches token key: `'IPrototypeGateAlignmentAnalyzer'`
3. Factory uses `singletonFactory` (consistent with other analyzer services)
4. Factory resolves `IDataRegistry` and `ILogger` from core tokens
5. Registration order respects dependency graph (no circular dependencies)
6. Debug message logs successfully on registration
7. Existing registrations remain unaffected
8. Existing tests continue to pass: `npm run test:unit -- --runInBand --testPathPatterns="expressionDiagnostics" --coverage=false`

## Dependencies

- **Requires**: PROREGGATALI-001 (analyzer implementation must exist)

## Estimated Size

~10 lines of code total (very small, mechanical change).

## Outcome

- Added DI token + registration for `PrototypeGateAlignmentAnalyzer` and updated DI registration coverage to account for the new service.
