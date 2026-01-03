# APPDAMCASDES-002: DI Registration for CascadeDestructionService

**Title:** Register CascadeDestructionService in Dependency Injection Container

**Summary:** Add DI token and factory registration for the new CascadeDestructionService.

## Files to Modify

- `src/dependencyInjection/tokens/tokens-core.js` (add token)
- `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` (add factory + import)

## Files to Create

- None

## Out of Scope

- CascadeDestructionService implementation (ticket APPDAMCASDES-001)
- Updating DamageResolutionService registration (ticket APPDAMCASDES-005)
- Any other service registrations
- Test files
- Any changes to existing service implementations

## Implementation Details

### Token Addition in `tokens-core.js`

Add alphabetically in the appropriate section:

```javascript
CascadeDestructionService: 'CascadeDestructionService',
```

### Factory Registration in `worldAndEntityRegistrations.js`

Add import at top of file:

```javascript
import CascadeDestructionService from '../../anatomy/services/cascadeDestructionService.js';
```

Add factory registration after DeathCheckService (~line 1156):

```javascript
registrar.singletonFactory(tokens.CascadeDestructionService, (c) => {
  return new CascadeDestructionService({
    logger: c.resolve(tokens.ILogger),
    entityManager: c.resolve(tokens.IEntityManager),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
  });
});
```

## Acceptance Criteria

### Tests That Must Pass

1. All existing DI container tests must continue to pass
2. `npm run typecheck` passes
3. Container can resolve `CascadeDestructionService` token successfully

### Invariants

- Token naming follows existing pattern (PascalCase, no "I" prefix for concrete services)
- Factory registration follows singletonFactory pattern (service is stateless)
- Import path is correct relative to registrations file
- All dependencies are resolvable tokens that already exist
- Registration order follows convention (after related anatomy services)

## Dependencies

- Depends on: APPDAMCASDES-001 (service must exist to import)
- Blocks: APPDAMCASDES-005 (integration needs token to exist)

## Verification Commands

```bash
# Run DI-related tests
npm run test:unit -- --testPathPattern="dependencyInjection"

# Lint modified files
npx eslint src/dependencyInjection/tokens/tokens-core.js src/dependencyInjection/registrations/worldAndEntityRegistrations.js

# Type check
npm run typecheck
```

## Notes

- This ticket is intentionally small to keep the diff reviewable
- Can be implemented in parallel with APPDAMCASDES-003 (DamageAccumulator)
