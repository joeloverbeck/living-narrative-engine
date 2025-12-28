# OXYBARPHYCONPAN-002: Register OxygenAggregationService in DI Container

## Status: COMPLETED

---

## Summary

Register the new `OxygenAggregationService` in the dependency injection container so it can be injected into `InjuryStatusPanel`.

## Prerequisites

- **OXYBARPHYCONPAN-001** must be completed first (service must exist before registration)

## File List

### Files to Modify

- `src/dependencyInjection/tokens/tokens-core.js` - Add token for the new service
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` - Register the service factory

### Files to Read (Reference Only - DO NOT MODIFY)

- `src/anatomy/services/oxygenAggregationService.js` - Created in OXYBARPHYCONPAN-001
- `src/anatomy/services/injuryAggregationService.js` - Pattern reference

## Out of Scope

- **DO NOT** modify `injuryStatusPanel.js` - that's a separate ticket
- **DO NOT** modify CSS files
- **DO NOT** modify UI registration files
- Tests are only required if DI registration coverage is missing for the new service
- **DO NOT** modify any other services or handlers

## Implementation Details

### Step 1: Add Token (tokens-core.js)

Add the following token adjacent to other anatomy service tokens (near InjuryAggregationService):

```javascript
OxygenAggregationService: 'OxygenAggregationService',
```

### Step 2: Register Service Factory (worldAndEntityRegistrations.js)

#### Import Statement

Add import near other anatomy service imports (around line 92):

```javascript
import OxygenAggregationService from '../../anatomy/services/oxygenAggregationService.js';
```

#### Registration

Add registration following the `InjuryAggregationService` pattern (around line 985), but with the constructor dependencies expected by `OxygenAggregationService` (logger + entityManager only):

```javascript
// Register OxygenAggregationService
registrar.singletonFactory(tokens.OxygenAggregationService, (c) => {
  return new OxygenAggregationService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
  });
});
logger.debug(
  `World and Entity Registration: Registered ${String(
    tokens.OxygenAggregationService
  )}.`
);
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` passes with no errors
2. `npm run build` completes successfully
3. Existing unit tests continue to pass: `npm run test:unit`
4. Manual verification: The app starts without DI resolution errors

### Invariants That Must Remain True

1. Token follows naming convention: `OxygenAggregationService` (no `I` prefix, consistent with `InjuryAggregationService`)
2. Token is placed adjacent to other anatomy service tokens in the core tokens list
3. Registration uses `singletonFactory` lifecycle (same as `InjuryAggregationService`)
4. Registration has proper debug logging following existing pattern
5. Import statement is in the correct import group
6. No changes to exports or other registrations

## Estimated Diff Size

- tokens-core.js: +1 line
- worldAndEntityRegistrations.js: +12 lines (import + registration)
- Total: ~13 lines

## Outcome

- Added DI token and registration for `OxygenAggregationService` with logger + entity manager dependencies.
- Adjusted ticket assumptions to reflect token placement and constructor dependencies.
- Tests run per acceptance criteria; noted existing failures outside this change.
