# NONDETACTSYS-008: Register RESOLVE_OUTCOME in DI System

## Summary

Complete the DI system registration for the RESOLVE_OUTCOME operation and all combat services. This includes creating the combat registrations file, registering tokens, adding handler factory, mapping the operation type, and adding to the pre-validation whitelist.

## Files to Create

| File | Purpose |
|------|---------|
| `src/dependencyInjection/registrations/combatRegistrations.js` | Combat service DI registrations |

## Files to Modify

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-core.js` | Add `ResolveOutcomeHandler` token |
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Add handler factory |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Map RESOLVE_OUTCOME to handler |
| `src/utils/preValidationUtils.js` | Add `RESOLVE_OUTCOME` to `KNOWN_OPERATION_TYPES` |
| `src/dependencyInjection/appContainer.js` | Import and call combatRegistrations |

## Implementation Details

### combatRegistrations.js

```javascript
/**
 * @file Combat service DI registrations
 * @see specs/non-deterministic-actions-system.md
 */

import tokens from '../tokens/tokens-core.js';
import SkillResolverService from '../../combat/services/SkillResolverService.js';
import ProbabilityCalculatorService from '../../combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../combat/services/OutcomeDeterminerService.js';

/**
 * Register combat services with the DI container
 * @param {Object} container - DI container
 */
export function registerCombatServices(container) {
  const bind = container.bind.bind(container);

  // Register SkillResolverService
  bind(tokens.SkillResolverService).toFactory((c) => {
    return new SkillResolverService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Register ProbabilityCalculatorService
  bind(tokens.ProbabilityCalculatorService).toFactory((c) => {
    return new ProbabilityCalculatorService({
      logger: c.resolve(tokens.ILogger),
    });
  });

  // Register OutcomeDeterminerService
  bind(tokens.OutcomeDeterminerService).toFactory((c) => {
    return new OutcomeDeterminerService({
      logger: c.resolve(tokens.ILogger),
    });
  });
}

export default registerCombatServices;
```

### tokens-core.js Addition

```javascript
// Combat Services (add to existing tokens)
ResolveOutcomeHandler: 'ResolveOutcomeHandler',
```

Note: Other service tokens (SkillResolverService, ProbabilityCalculatorService, OutcomeDeterminerService) should already be added from tickets 003-005.

### operationHandlerRegistrations.js Addition

Add to `handlerFactories` array:

```javascript
{
  token: tokens.ResolveOutcomeHandler,
  factory: (c) => {
    const ResolveOutcomeHandler = require('../../logic/operationHandlers/resolveOutcomeHandler.js').default;
    return new ResolveOutcomeHandler({
      logger: c.resolve(tokens.ILogger),
      skillResolverService: c.resolve(tokens.SkillResolverService),
      probabilityCalculatorService: c.resolve(tokens.ProbabilityCalculatorService),
      outcomeDeterminerService: c.resolve(tokens.OutcomeDeterminerService),
    });
  },
},
```

### interpreterRegistrations.js Addition

Add to operation registry mapping:

```javascript
registry.register('RESOLVE_OUTCOME', bind(tokens.ResolveOutcomeHandler));
```

### preValidationUtils.js Addition

Add to `KNOWN_OPERATION_TYPES` array (alphabetically sorted):

```javascript
'RESOLVE_OUTCOME',
```

### appContainer.js Modification

Import and call combat registrations:

```javascript
import { registerCombatServices } from './registrations/combatRegistrations.js';

// In the setup function, add:
registerCombatServices(container);
```

## Out of Scope

- **DO NOT** modify service implementations
- **DO NOT** modify the handler implementation
- **DO NOT** create new tests (existing DI tests cover registration patterns)
- **DO NOT** modify any game data files

## Acceptance Criteria

### Tests That Must Pass

```bash
# Validate schema and mod loading
npm run validate

# Type checking
npm run typecheck

# Unit tests
npm run test:unit -- --testPathPattern="operationHandlerRegistrations|interpreterRegistrations"

# Full test suite
npm run test:ci
```

### Verification Steps

1. **Token Resolution**: Container can resolve `tokens.ResolveOutcomeHandler`
2. **Handler Creation**: Handler factory creates valid handler instance
3. **Operation Mapping**: `RESOLVE_OUTCOME` maps to correct handler
4. **Pre-validation**: `RESOLVE_OUTCOME` is in known operation types
5. **Service Resolution**: All combat services resolve correctly

### Invariants That Must Remain True

- [ ] All existing operation handlers continue to work
- [ ] All existing tests pass
- [ ] Pre-validation includes RESOLVE_OUTCOME
- [ ] Token is properly exported from tokens-core.js
- [ ] Handler factory has all required dependencies
- [ ] Operation type string matches schema exactly
- [ ] combatRegistrations.js follows existing registration patterns

## Dependencies

- **Depends on**:
  - NONDETACTSYS-003 (SkillResolverService for registration)
  - NONDETACTSYS-004 (ProbabilityCalculatorService for registration)
  - NONDETACTSYS-005 (OutcomeDeterminerService for registration)
  - NONDETACTSYS-006 (schema for type validation)
  - NONDETACTSYS-007 (handler for registration)
- **Blocked by**: All Phase 1 and Phase 2 tickets (003-007)
- **Blocks**: NONDETACTSYS-014 (rule needs operation to be registered)

## Reference Files

| File | Purpose |
|------|---------|
| `src/dependencyInjection/registrations/operationHandlerRegistrations.js` | Handler registration pattern |
| `src/dependencyInjection/registrations/interpreterRegistrations.js` | Operation mapping pattern |
| `src/utils/preValidationUtils.js` | Known operation types list |
| `src/dependencyInjection/appContainer.js` | Registration orchestration |

## Checklist for Adding Operations

Per CLAUDE.md guidelines, this ticket completes:

1. ✅ Create operation schema (NONDETACTSYS-006)
2. ✅ Add schema reference to operation.schema.json (NONDETACTSYS-006)
3. ✅ Create operation handler (NONDETACTSYS-007)
4. ✅ Define DI token (this ticket)
5. ✅ Register handler factory (this ticket)
6. ✅ Map operation to handler (this ticket)
7. ✅ Add to pre-validation whitelist (this ticket)
8. ✅ Create tests (NONDETACTSYS-007)
