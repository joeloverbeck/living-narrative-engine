# HUNMETSYS-005: Operation Handler - CONSUME_ITEM

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 8 hours  
**Phase:** 1 - Foundation  
**Dependencies:** HUNMETSYS-001, HUNMETSYS-002 (component schemas)

## Objective

Implement the CONSUME_ITEM operation handler that transfers fuel source to fuel converter buffer, validating compatibility and capacity, then removing item from inventory.

## Files to Touch

### New Files (3)
- `data/schemas/operations/consumeItem.schema.json`
- `src/logic/operationHandlers/consumeItemHandler.js`
- `tests/unit/logic/operationHandlers/consumeItemHandler.test.js`

### Modified Files (4)
- `data/schemas/operation.schema.json` (add $ref to consumeItem schema)
- `src/dependencyInjection/tokens/tokens-core.js` (add ConsumeItemHandler token)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (add handler factory)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (register CONSUME_ITEM operation)
- `src/utils/preValidationUtils.js` (add to KNOWN_OPERATION_TYPES whitelist)

## Out of Scope

- ❌ Overeating mechanics and vomiting (future extension - see spec lines 1467-1507)
- ❌ Inventory system implementation (assume exists from core mod)
- ❌ Integration with eat action (covered in HUNMETSYS-009)
- ❌ Integration tests (covered in HUNMETSYS-017)
- ❌ Spoilage checking (future extension)

## Implementation Details

### Operation Schema

**File:** `data/schemas/operations/consumeItem.schema.json`

**Parameters:**
- `consumer_ref`: Entity consuming the item (required)
- `item_ref`: Item to consume (required)

### Validation Steps (Must All Pass)

1. **Consumer has fuel_converter component**
2. **Item has fuel_source component**
3. **Fuel tags match:** Item's fuel_tags must have at least one match with converter's accepted_fuel_tags
4. **Buffer has room:** `buffer_storage + item.bulk <= capacity`

### Handler Implementation

**File:** `src/logic/operationHandlers/consumeItemHandler.js`

**Class:** `ConsumeItemHandler extends BaseOperationHandler`

**Key Responsibilities:**
1. Resolve both consumer and item entity references
2. Validate both entities have required components
3. Validate fuel tag compatibility
4. Validate buffer capacity
5. Add item.bulk to fuel_converter.buffer_storage
6. Store item.energy_density for future digestion (as part of buffer)
7. Remove item entity from game
8. Dispatch `metabolism:item_consumed` event

**Dependencies (via DI):**
- `#entityManager` (IEntityManager)
- `#logger` (ILogger)
- `#safeEventDispatcher` (ISafeEventDispatcher)

**Event Dispatched:**
```json
{
  "type": "metabolism:item_consumed",
  "payload": {
    "consumerId": "string",
    "itemId": "string",
    "bulkAdded": number,
    "energyDensity": number,
    "newBufferStorage": number
  }
}
```

### Error Handling

**Must throw specific errors for:**
- Missing fuel_converter on consumer
- Missing fuel_source on item
- Incompatible fuel tags
- Insufficient buffer capacity
- Invalid entity references

**Error Messages:**
```javascript
// Incompatible fuel tags
throw new InvalidFuelTypeError(
  `Cannot consume ${itemName}: incompatible fuel type. ` +
  `Converter accepts: ${converter.accepted_fuel_tags.join(', ')}. ` +
  `Item provides: ${fuelSource.fuel_tags.join(', ')}.`
);

// Insufficient capacity
throw new InsufficientCapacityError(
  `Stomach is too full. Available space: ${availableSpace}, ` +
  `item bulk: ${fuelSource.bulk}`
);
```

### Fuel Tag Matching Logic

```javascript
const hasMatchingTag = fuelSource.fuel_tags.some(tag =>
  converter.accepted_fuel_tags.includes(tag)
);
```

**Examples:**
- ✅ Item: ["organic", "meat"], Converter: ["organic"] → Match
- ✅ Item: ["blood"], Converter: ["blood", "organic"] → Match
- ❌ Item: ["electricity"], Converter: ["organic"] → No match

## Acceptance Criteria

### Schema Validation
- [ ] Operation schema validates against base-operation.schema.json
- [ ] Schema added to operation.schema.json anyOf array
- [ ] Type constant is "CONSUME_ITEM"
- [ ] Both entity references properly typed

### Handler Implementation
- [ ] Handler extends BaseOperationHandler
- [ ] All dependencies validated via validateDependency
- [ ] Execute method is async
- [ ] All 4 validation steps implemented
- [ ] Fuel tag matching logic correct
- [ ] Buffer storage updated correctly
- [ ] Item removed from game via removeEntity
- [ ] Event dispatched with complete payload
- [ ] Clear error messages for all failure cases

### Dependency Injection
- [ ] Token added to tokens-core.js as 'ConsumeItemHandler'
- [ ] Factory registered in operationHandlerRegistrations.js
- [ ] Operation mapped in interpreterRegistrations.js
- [ ] Type added to KNOWN_OPERATION_TYPES in preValidationUtils.js

### Unit Test Coverage (>90%)
- [ ] Test: successfully consumes compatible food
- [ ] Test: adds bulk to buffer_storage
- [ ] Test: removes item entity from game
- [ ] Test: dispatches item_consumed event
- [ ] Test: throws error for missing fuel_converter
- [ ] Test: throws error for missing fuel_source
- [ ] Test: throws error for incompatible fuel tags
- [ ] Test: throws error for insufficient buffer capacity
- [ ] Test: validates capacity boundary (exactly at limit)
- [ ] Test: handles multiple fuel tags correctly

## Test Examples

### Successful Consumption
```javascript
it('should consume food and add to buffer', async () => {
  const consumerId = 'actor_1';
  const itemId = 'bread_1';
  
  testBed.entityManager.addComponent(consumerId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 30,
    conversion_rate: 5,
    efficiency: 0.8,
    accepted_fuel_tags: ['organic'],
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(itemId, 'metabolism:fuel_source', {
    energy_density: 200,
    bulk: 30,
    fuel_tags: ['organic', 'cooked'],
    digestion_speed: 'medium',
    spoilage_rate: 0
  });

  await handler.execute({
    consumer_ref: consumerId,
    item_ref: itemId
  }, testBed.context);

  const converter = testBed.entityManager.getComponent(consumerId, 'metabolism:fuel_converter');
  expect(converter.buffer_storage).toBe(60); // 30 + 30
  expect(testBed.entityManager.hasEntity(itemId)).toBe(false); // Item removed
});
```

### Incompatible Fuel Tags
```javascript
it('should reject incompatible fuel types', async () => {
  const consumerId = 'vampire_1';
  const itemId = 'bread_1';
  
  testBed.entityManager.addComponent(consumerId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 0,
    conversion_rate: 20,
    efficiency: 0.95,
    accepted_fuel_tags: ['blood'], // Vampire only accepts blood
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(itemId, 'metabolism:fuel_source', {
    energy_density: 200,
    bulk: 30,
    fuel_tags: ['organic', 'cooked'], // Regular food
    digestion_speed: 'medium',
    spoilage_rate: 0
  });

  await expect(
    handler.execute({
      consumer_ref: consumerId,
      item_ref: itemId
    }, testBed.context)
  ).rejects.toThrow('incompatible fuel type');
});
```

### Buffer Capacity Exceeded
```javascript
it('should reject consumption when buffer is full', async () => {
  const consumerId = 'actor_1';
  const itemId = 'steak_1';
  
  testBed.entityManager.addComponent(consumerId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 90, // Almost full
    conversion_rate: 5,
    efficiency: 0.8,
    accepted_fuel_tags: ['organic'],
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(itemId, 'metabolism:fuel_source', {
    energy_density: 300,
    bulk: 50, // Too large for remaining space
    fuel_tags: ['organic', 'meat'],
    digestion_speed: 'slow',
    spoilage_rate: 0
  });

  await expect(
    handler.execute({
      consumer_ref: consumerId,
      item_ref: itemId
    }, testBed.context)
  ).rejects.toThrow(/stomach is too full|insufficient capacity/i);
});
```

## Invariants

### Must Remain True
- Buffer storage can never exceed capacity after consumption
- Item entity must be removed if consumption succeeds
- Item entity must remain if consumption fails (transaction safety)
- At least one fuel tag must match for consumption to succeed

### System Invariants
- EntityManager component modifications are atomic
- Item removal is atomic with buffer update
- Event dispatched only on successful consumption
- No other entity components are modified

## References

- Spec: Lines 546-605 (CONSUME_ITEM Operation)
- Spec: Lines 1467-1507 (Overeating Mechanics - future)
- Related: HUNMETSYS-001 (fuel_converter, fuel_source schemas)
- Related: HUNMETSYS-009 (eat action handler using this operation)
- Related: HUNMETSYS-011 (can_consume operator for GOAP)

## Definition of Done

- [ ] Operation schema created and validates
- [ ] Handler implemented following project patterns
- [ ] All 4 validation steps implemented correctly
- [ ] Clear error messages for all failure modes
- [ ] All DI registration completed
- [ ] Unit tests written with >90% coverage
- [ ] All tests pass: `npm run test:unit`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npx eslint <modified-files>`
- [ ] Committed with message: "feat(metabolism): implement CONSUME_ITEM operation handler"
