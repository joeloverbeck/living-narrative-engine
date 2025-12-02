# OPEHANARCANA-014: BREAK_BIDIRECTIONAL_CLOSENESS DI & Tests

**Status:** Completed
**Priority:** High (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-012 (schema), OPEHANARCANA-013 (handler)

---

## Outcome

-   Registered `BreakBidirectionalClosenessHandler` in `tokens-core.js`, `operationHandlerRegistrations.js`, and `interpreterRegistrations.js`.
-   Added to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`.
-   Created unit tests in `tests/unit/logic/operationHandlers/breakBidirectionalClosenessHandler.test.js` covering validation, execution, edge cases, and error handling (100% coverage).
-   Created integration tests in `tests/integration/logic/operationHandlers/breakBidirectionalCloseness.integration.test.js` verifying full lifecycle.
-   Updated `tests/common/mods/ModTestHandlerFactory.js` to support the new handler in integration tests.

---

## Objective

Register the `BreakBidirectionalClosenessHandler` in the dependency injection system and create comprehensive unit and integration tests with 90%+ branch coverage.

---

## Files to Touch

### Modified Files (DI Registration)
- `src/dependencyInjection/tokens/tokens-core.js` - Add token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Add factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Add mapping
- `src/utils/preValidationUtils.js` - Add to KNOWN_OPERATION_TYPES

### New Files (Tests)
- `tests/unit/logic/operationHandlers/breakBidirectionalClosenessHandler.test.js`
- `tests/integration/logic/operationHandlers/breakBidirectionalCloseness.integration.test.js`

---

## Out of Scope

**DO NOT modify:**
- The handler implementation file (done in OPEHANARCANA-013)
- Any schema files (done in OPEHANARCANA-012)
- Any rule files (migrations are separate tickets)
- ESTABLISH_BIDIRECTIONAL_CLOSENESS files

---

## Implementation Details

### 1. Token Definition (`tokens-core.js`)

```javascript
BreakBidirectionalClosenessHandler: 'BreakBidirectionalClosenessHandler',
```

### 2. Handler Factory Registration (`operationHandlerRegistrations.js`)

```javascript
import BreakBidirectionalClosenessHandler from '../../logic/operationHandlers/breakBidirectionalClosenessHandler.js';

// In handlerFactories array:
{
  token: tokens.BreakBidirectionalClosenessHandler,
  factory: (c) => new BreakBidirectionalClosenessHandler({
    entityManager: c.resolve(tokens.IEntityManager),
    regenerateDescriptionHandler: c.resolve(tokens.RegenerateDescriptionHandler),
    safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    logger: c.resolve(tokens.ILogger),
  }),
},
```

### 3. Operation Mapping (`interpreterRegistrations.js`)

```javascript
registry.register('BREAK_BIDIRECTIONAL_CLOSENESS', bind(tokens.BreakBidirectionalClosenessHandler));
```

### 4. Pre-Validation Whitelist (`preValidationUtils.js`)

```javascript
'BREAK_BIDIRECTIONAL_CLOSENESS',
```

---

## Unit Test Structure

```javascript
describe('BreakBidirectionalClosenessHandler', () => {
  describe('constructor validation', () => { /* ... */ });

  describe('execute - component removal', () => {
    it('should remove actor_component_type from both entities', async () => { /* ... */ });
    it('should remove target_component_type from both entities', async () => { /* ... */ });
    it('should remove additional_component_types_to_remove', async () => { /* ... */ });
    it('should gracefully handle missing components', async () => { /* ... */ });
  });

  describe('execute - description regeneration', () => {
    it('should regenerate descriptions when enabled', async () => { /* ... */ });
    it('should skip regeneration when disabled', async () => { /* ... */ });
  });

  describe('execute - edge cases', () => {
    it('should handle already-broken relationship', async () => { /* ... */ });
    it('should handle partial relationship (one side missing)', async () => { /* ... */ });
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **DI Registration:**
   ```bash
   npm run typecheck
   npm run validate
   ```

2. **Unit tests pass with 90%+ coverage:**
   ```bash
   npm run test:unit -- tests/unit/logic/operationHandlers/breakBidirectionalClosenessHandler.test.js --coverage
   ```

3. **Integration tests pass:**
   ```bash
   npm run test:integration -- tests/integration/logic/operationHandlers/breakBidirectionalCloseness.integration.test.js
   ```

4. **Full CI suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing tokens remain unchanged
2. All existing handler registrations remain unchanged
3. `KNOWN_OPERATION_TYPES` array remains alphabetically sorted
4. No regressions in existing tests

---

## Verification Steps

```bash
# 1. Verify token uniqueness
grep -r "BreakBidirectionalClosenessHandler" src/dependencyInjection/

# 2. Verify operation type string matches
grep "BREAK_BIDIRECTIONAL_CLOSENESS" src/utils/preValidationUtils.js
grep "BREAK_BIDIRECTIONAL_CLOSENESS" src/dependencyInjection/registrations/interpreterRegistrations.js

# 3. Run all tests
npm run test:ci
```

---

## Reference Files

- Token pattern: `src/dependencyInjection/tokens/tokens-core.js`
- Test pattern: `tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js`
