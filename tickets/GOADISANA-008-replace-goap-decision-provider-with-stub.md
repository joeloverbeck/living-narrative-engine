# GOADISANA-008: Replace GOAP Decision Provider with Stub

## Context

The `GoapDecisionProvider` currently depends on removed GOAP services. We must replace it with a simple stub that:
1. Maintains the provider interface (extends DelegatingDecisionProvider)
2. Works with the existing routing mechanism
3. Provides placeholder behavior (selects first action or returns null)
4. Can be replaced with task-based implementation in the future

**Fatal Flaw Context**: The provider used GOAP services to select actions based on auto-generated effects. The stub removes this flawed logic while preserving the routing architecture.

## Objective

Replace `GoapDecisionProvider` implementation with simple stub and update its DI registration.

## Files Affected

**To be MODIFIED**:
- `src/turns/providers/goapDecisionProvider.js` - Replace implementation with stub
- `src/dependencyInjection/registrations/aiRegistrations.js` - Simplify registration

## Detailed Steps

### Part 1: Replace GoapDecisionProvider Implementation

1. **Back up current implementation**:
   ```bash
   cp src/turns/providers/goapDecisionProvider.js tickets/original-goapDecisionProvider.js
   ```

2. **Replace file content** with stub implementation:
   ```javascript
   /**
    * @file GoapDecisionProvider - Stub implementation after GOAP system removal
    *
    * This stub preserves the provider interface for the core:player_type 'goap' routing,
    * allowing future task-based implementation to replace it without changing the routing mechanism.
    *
    * Current behavior: Selects first available action or returns null if no actions available.
    */

   import { DelegatingDecisionProvider } from './delegatingDecisionProvider.js';
   import { validateDependency } from '../../utils/dependencyUtils.js';

   export class GoapDecisionProvider extends DelegatingDecisionProvider {
     #logger;

     constructor({ logger, safeEventDispatcher }) {
       validateDependency(logger, 'ILogger', logger, {
         requiredMethods: ['debug', 'info', 'warn', 'error'],
       });
       validateDependency(safeEventDispatcher, 'ISafeEventDispatcher', logger, {
         requiredMethods: ['dispatch'],
       });

       // Simple placeholder: pick first action
       const delegate = async (_actor, _context, actions) => {
         if (!Array.isArray(actions) || actions.length === 0) {
           this.#logger.debug('No actions available for GOAP actor');
           return { index: null };
         }

         this.#logger.debug(
           `GOAP stub: selecting first action (${actions[0].actionName})`
         );
         return { index: actions[0].index };
       };

       super({ delegate, logger, safeEventDispatcher });
       this.#logger = logger;
     }
   }

   export default GoapDecisionProvider;
   ```

3. **Verify file syntax**:
   ```bash
   npm run typecheck 2>&1 | grep goapDecisionProvider
   ```

### Part 2: Update DI Registration

1. **Locate registration in aiRegistrations.js**:
   - Find the `IGoapDecisionProvider` registration factory

2. **Replace dynamic import with simple factory**:

   **BEFORE** (complex, imports removed GOAP services):
   ```javascript
   registrar.singletonFactory(tokens.IGoapDecisionProvider, async (c) => {
     const goapTokensModule = await import('../tokens/tokens-goap.js');
     const { goapTokens } = goapTokensModule;
     return new GoapDecisionProvider({
       goalManager: c.resolve(goapTokens.IGoalManager),
       simplePlanner: c.resolve(goapTokens.ISimplePlanner),
       planCache: c.resolve(goapTokens.IPlanCache),
       entityManager: c.resolve(tokens.IEntityManager),
       logger: c.resolve(tokens.ILogger),
       safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
     });
   });
   ```

   **AFTER** (simple, only logger and event dispatcher):
   ```javascript
   registrar.singletonFactory(tokens.IGoapDecisionProvider, (c) => {
     return new GoapDecisionProvider({
       logger: c.resolve(tokens.ILogger),
       safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
     });
   });
   ```

3. **Verify registration syntax**:
   ```bash
   npm run typecheck 2>&1 | grep aiRegistrations
   ```

## Acceptance Criteria

- [ ] `goapDecisionProvider.js` replaced with stub implementation
- [ ] Stub extends `DelegatingDecisionProvider`
- [ ] Stub selects first action or returns null if empty
- [ ] Stub logs selection decision for debugging
- [ ] No GOAP service dependencies remain in provider
- [ ] `aiRegistrations.js` registration simplified (no dynamic import)
- [ ] Registration uses only `logger` and `safeEventDispatcher` dependencies
- [ ] TypeScript compilation succeeds for both files
- [ ] Original implementation backed up to `tickets/original-goapDecisionProvider.js`

## Dependencies

**Requires**:
- GOADISANA-007 (base container config updated)

**Blocks**:
- GOADISANA-024 (player type routing verification depends on this stub working)

## Verification Commands

```bash
# Verify backup created
cat tickets/original-goapDecisionProvider.js

# Verify no GOAP imports in new provider
grep -i "goap" src/turns/providers/goapDecisionProvider.js
# Should only find class name and comments, not imports

# Verify no goapTokens in registration
grep "goapTokens" src/dependencyInjection/registrations/aiRegistrations.js
# Should return empty

# Verify registration is simple (not async)
grep -A 5 "IGoapDecisionProvider" src/dependencyInjection/registrations/aiRegistrations.js
# Should show simple factory, not async/await

# Check TypeScript compilation
npm run typecheck
```

## Alternative Implementation Options

If the "first action" approach is too simplistic, consider:

**Option B: Throw Error**
```javascript
const delegate = async () => {
  throw new Error('GOAP system removed - use LLM player type instead');
};
```
- Pros: Clear error message, prevents silent failures
- Cons: Less graceful, breaks existing GOAP actors

**Recommended**: Use "first action" approach (Option A above) for graceful degradation.

## Notes

- The stub preserves the provider interface for future task-based implementation
- Player type routing continues to work (routes 'goap' type to this provider)
- This is NOT a permanent solution, just a placeholder
- Future task-based system can replace this stub without changing routing code
- The stub should be replaced in future work, not left permanently
