# OPEHANARCANA-019: VALIDATED_ITEM_TRANSFER DI & Tests

**Status:** Ready
**Priority:** Medium (Phase 3)
**Estimated Effort:** 1 day
**Dependencies:** OPEHANARCANA-017 (schema), OPEHANARCANA-018 (handler)

---

## Objective

Register the `ValidatedItemTransferHandler` in the dependency injection system and create comprehensive unit and integration tests with 90%+ branch coverage.

---

## Files to Touch

### Modified Files (DI Registration)
- `src/dependencyInjection/tokens/tokens-core.js` - Add token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Add factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Add mapping
- `src/utils/preValidationUtils.js` - Add to KNOWN_OPERATION_TYPES

### New Files (Tests)
- `tests/unit/logic/operationHandlers/validatedItemTransferHandler.test.js`
- `tests/integration/logic/operationHandlers/validatedItemTransfer.integration.test.js`

---

## Out of Scope

**DO NOT modify:**
- The handler implementation file (done in OPEHANARCANA-018)
- Any schema files (done in OPEHANARCANA-017)
- Any rule files (migrations are separate tickets)
- Bidirectional closeness files (Phase 2)

---

## Implementation Details

### 1. Token Definition (`tokens-core.js`)

```javascript
ValidatedItemTransferHandler: 'ValidatedItemTransferHandler',
```

### 2. Handler Factory Registration (`operationHandlerRegistrations.js`)

```javascript
import ValidatedItemTransferHandler from '../../logic/operationHandlers/validatedItemTransferHandler.js';

// In handlerFactories array:
{
  token: tokens.ValidatedItemTransferHandler,
  factory: (c) => new ValidatedItemTransferHandler({
    entityManager: c.resolve(tokens.IEntityManager),
    inventoryService: c.resolve(tokens.IInventoryService),
    eventBus: c.resolve(tokens.IEventBus),
    logger: c.resolve(tokens.ILogger),
  }),
},
```

### 3. Operation Mapping (`interpreterRegistrations.js`)

```javascript
registry.register('VALIDATED_ITEM_TRANSFER', bind(tokens.ValidatedItemTransferHandler));
```

### 4. Pre-Validation Whitelist (`preValidationUtils.js`)

```javascript
'VALIDATED_ITEM_TRANSFER',
```

---

## Unit Test Structure

```javascript
describe('ValidatedItemTransferHandler', () => {
  describe('constructor validation', () => {
    it('should throw if entityManager is missing', () => { /* ... */ });
    it('should throw if inventoryService is missing', () => { /* ... */ });
    it('should throw if eventBus is missing', () => { /* ... */ });
  });

  describe('execute - entity ref resolution', () => {
    it('should resolve "actor" to event.payload.actorId', async () => { /* ... */ });
    it('should resolve "target" to event.payload.targetId', async () => { /* ... */ });
    it('should resolve "item" to event.payload.itemId', async () => { /* ... */ });
    it('should resolve "location" to actor position locationId', async () => { /* ... */ });
  });

  describe('execute - validation', () => {
    it('should validate inventory capacity when validation_type is "inventory"', async () => { /* ... */ });
    it('should validate container capacity when validation_type is "container"', async () => { /* ... */ });
    it('should skip validation when validation_type is "none"', async () => { /* ... */ });
  });

  describe('execute - failure path', () => {
    it('should dispatch failure perception event when validation fails', async () => { /* ... */ });
    it('should set context.success to false on failure', async () => { /* ... */ });
    it('should use failure_message_template', async () => { /* ... */ });
    it('should use failure_perception_type', async () => { /* ... */ });
  });

  describe('execute - success path', () => {
    it('should perform transfer after validation passes', async () => { /* ... */ });
    it('should dispatch success perception event', async () => { /* ... */ });
    it('should set context.success to true', async () => { /* ... */ });
    it('should use success_message_template', async () => { /* ... */ });
  });

  describe('execute - transfer types', () => {
    it('should call transferItem for inventory_to_inventory', async () => { /* ... */ });
    it('should call pickUpItem for location_to_inventory', async () => { /* ... */ });
    it('should call dropItem for inventory_to_location', async () => { /* ... */ });
    it('should call putInContainer for inventory_to_container', async () => { /* ... */ });
    it('should call takeFromContainer for container_to_inventory', async () => { /* ... */ });
  });

  describe('execute - message formatting', () => {
    it('should replace {actorName} in template', async () => { /* ... */ });
    it('should replace {targetName} in template', async () => { /* ... */ });
    it('should replace {itemName} in template', async () => { /* ... */ });
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
   npm run test:unit -- tests/unit/logic/operationHandlers/validatedItemTransferHandler.test.js --coverage
   ```

3. **Integration tests pass:**
   ```bash
   npm run test:integration -- tests/integration/logic/operationHandlers/validatedItemTransfer.integration.test.js
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
grep -r "ValidatedItemTransferHandler" src/dependencyInjection/

# 2. Verify operation type string matches
grep "VALIDATED_ITEM_TRANSFER" src/utils/preValidationUtils.js
grep "VALIDATED_ITEM_TRANSFER" src/dependencyInjection/registrations/interpreterRegistrations.js

# 3. Run all tests
npm run test:ci
```

---

## Reference Files

- Token pattern: `src/dependencyInjection/tokens/tokens-core.js`
- Test pattern: `tests/unit/logic/operationHandlers/transferItemHandler.test.js`
