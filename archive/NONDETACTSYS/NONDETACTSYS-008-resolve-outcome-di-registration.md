# NONDETACTSYS-008: Register RESOLVE_OUTCOME in DI System

**Status**: ✅ COMPLETED

## Summary

Complete the DI system registration for the RESOLVE_OUTCOME operation. This includes creating the combat registrations file, registering the handler token, adding the handler factory, and mapping the operation type.

**Note**: After codebase validation, the pre-validation whitelist was confirmed to already contain `RESOLVE_OUTCOME` (added during NONDETACTSYS-007).

## Files to Create

| File | Purpose |
|------|---------|
| `src/dependencyInjection/registrations/combatRegistrations.js` | Combat service DI registrations |

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `ResolveOutcomeHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add handler import and factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map RESOLVE_OUTCOME to handler |
| `src/dependencyInjection/baseContainerConfig.js` | Import and call combatRegistrations |

## Implementation Details

### combatRegistrations.js

```javascript
/**
 * @file Combat service DI registrations
 * @see specs/non-deterministic-actions-system.md
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import SkillResolverService from '../../combat/services/SkillResolverService.js';
import ProbabilityCalculatorService from '../../combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../combat/services/OutcomeDeterminerService.js';

/**
 * Register combat services with the DI container.
 *
 * @param {import('../appContainer.js').default} container - DI container
 */
export function registerCombatServices(container) {
  const registrar = new Registrar(container);

  // Register SkillResolverService
  registrar.singletonFactory(tokens.SkillResolverService, (c) =>
    new SkillResolverService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register ProbabilityCalculatorService
  registrar.singletonFactory(tokens.ProbabilityCalculatorService, (c) =>
    new ProbabilityCalculatorService({
      logger: c.resolve(tokens.ILogger),
    })
  );

  // Register OutcomeDeterminerService
  registrar.singletonFactory(tokens.OutcomeDeterminerService, (c) =>
    new OutcomeDeterminerService({
      logger: c.resolve(tokens.ILogger),
    })
  );
}

export default registerCombatServices;
```

### tokens-core.js Addition

```javascript
// Combat Services (add to existing tokens, after OutcomeDeterminerService)
ResolveOutcomeHandler: 'ResolveOutcomeHandler',
```

Note: Service tokens (SkillResolverService, ProbabilityCalculatorService, OutcomeDeterminerService) already exist from tickets 003-005.

### operationHandlerRegistrations.js Addition

Add import (keep alphabetically sorted):

```javascript
import ResolveOutcomeHandler from '../../logic/operationHandlers/resolveOutcomeHandler.js';
```

Add to `handlerFactories` array (keep alphabetically sorted by token name):

```javascript
[
  tokens.ResolveOutcomeHandler,
  ResolveOutcomeHandler,
  (c, Handler) =>
    new Handler({
      logger: c.resolve(tokens.ILogger),
      skillResolverService: c.resolve(tokens.SkillResolverService),
      probabilityCalculatorService: c.resolve(tokens.ProbabilityCalculatorService),
      outcomeDeterminerService: c.resolve(tokens.OutcomeDeterminerService),
    }),
],
```

### interpreterRegistrations.js Addition

Add to operation registry mapping (keep alphabetically sorted):

```javascript
registry.register('RESOLVE_OUTCOME', bind(tokens.ResolveOutcomeHandler));
```

### preValidationUtils.js - NO CHANGE NEEDED

`RESOLVE_OUTCOME` was already added to `KNOWN_OPERATION_TYPES` during NONDETACTSYS-007 implementation.

### baseContainerConfig.js Modification

Add import (keep with other registrations imports):

```javascript
import { registerCombatServices } from './registrations/combatRegistrations.js';
```

Add call in configureBaseContainer function (after GOAP registrations):

```javascript
if (logger)
  logger.debug('[BaseContainerConfig] Registering combat services...');
try {
  registerCombatServices(container);
} catch (error) {
  const errorMessage = `Failed to register combat services: ${error.message}`;
  if (logger) logger.error(`[BaseContainerConfig] ${errorMessage}`, error);
  throw new Error(errorMessage);
}
```

## Out of Scope

- **DO NOT** modify service implementations
- **DO NOT** modify the handler implementation
- **DO NOT** create new tests (existing DI tests cover registration patterns)
- **DO NOT** modify any game data files
- **DO NOT** modify preValidationUtils.js (already done)

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate schema and mod loading
npm run validate

# Type checking
npm run typecheck

# Unit tests for DI registration patterns
npm run test:unit -- --testPathPattern="operationHandlerRegistrations|interpreterRegistrations"

# Full test suite
npm run test:ci
```

### Verification Steps

1. **Token Resolution**: Container can resolve `tokens.ResolveOutcomeHandler`
2. **Handler Creation**: Handler factory creates valid handler instance
3. **Operation Mapping**: `RESOLVE_OUTCOME` maps to correct handler
4. **Pre-validation**: `RESOLVE_OUTCOME` is in known operation types (already verified)
5. **Service Resolution**: All combat services resolve correctly

### Invariants That Must Remain True

- [x] All existing operation handlers continue to work
- [x] All existing tests pass
- [x] Pre-validation includes RESOLVE_OUTCOME (verified as already present)
- [x] Token is properly exported from tokens-core.js
- [x] Handler factory has all required dependencies
- [x] Operation type string matches schema exactly
- [x] combatRegistrations.js follows existing registration patterns

## Dependencies

- **Depends on**:
  - NONDETACTSYS-003 (SkillResolverService - tokens already added)
  - NONDETACTSYS-004 (ProbabilityCalculatorService - tokens already added)
  - NONDETACTSYS-005 (OutcomeDeterminerService - tokens already added)
  - NONDETACTSYS-006 (schema for type validation)
  - NONDETACTSYS-007 (handler for registration)
- **Blocked by**: All Phase 1 and Phase 2 tickets (003-007)
- **Blocks**: NONDETACTSYS-014 (rule needs operation to be registered)

## Reference Files

| File | Purpose |
|------|---------|
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Handler registration pattern |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Operation mapping pattern |
| `src/dependencyInjection/registrations/infrastructureRegistrations.js` | Service registration pattern |
| `src/utils/registrarHelpers.js` | Registrar API |
| `src/dependencyInjection/baseContainerConfig.js` | Registration orchestration |

## Checklist for Adding Operations

Per CLAUDE.md guidelines, this ticket completes:

1. ✅ Create operation schema (NONDETACTSYS-006)
2. ✅ Add schema reference to operation.schema.json (NONDETACTSYS-006)
3. ✅ Create operation handler (NONDETACTSYS-007)
4. ✅ Define DI token (this ticket)
5. ✅ Register handler factory (this ticket)
6. ✅ Map operation to handler (this ticket)
7. ✅ Add to pre-validation whitelist (verified already done in NONDETACTSYS-007)
8. ✅ Create tests (NONDETACTSYS-007)

## Validation Results (Post-Implementation)

Discrepancies corrected from original ticket:
1. **preValidationUtils.js**: No change needed - `RESOLVE_OUTCOME` was already present
2. **Registration API**: Corrected from `.bind().toFactory()` to `Registrar.singletonFactory()` pattern
3. **Import style**: Corrected from `require()` to ES module imports

## Outcome

### What Changed vs Planned

**Created Files:**
- `src/dependencyInjection/registrations/combatRegistrations.js` - Combat service DI registrations (as planned)

**Modified Files:**
- `src/dependencyInjection/tokens/tokens-core.js` - Added `ResolveOutcomeHandler` token (as planned)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Added handler import and factory (as planned)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Added `RESOLVE_OUTCOME` → `ResolveOutcomeHandler` mapping (as planned)
- `src/dependencyInjection/baseContainerConfig.js` - Import and call `registerCombatServices` (as planned)

**Test Updates:**
- `tests/unit/dependencyInjection/registrations/operationHandlerRegistrations.test.js` - Added `ResolveOutcomeHandler` to handler module definitions, token imports, and expectations array
- `tests/unit/dependencyInjection/baseContainerConfig.errorHandling.test.js` - Added `registerCombatServices` to registration module paths and failure scenarios

**Not Modified (contrary to original ticket):**
- `src/utils/preValidationUtils.js` - No change needed; `RESOLVE_OUTCOME` was already present from NONDETACTSYS-007

### Test Results
- All 37,334 unit tests pass
- All 462 DI-related tests pass
- Validation (`npm run validate`) passes with 0 violations across 44 mods
- Lint passes on all modified source files

### Completion Date
2025-11-26
