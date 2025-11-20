# HUNMETSYS-004: Operation Handler - DIGEST_FOOD

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 6 hours  
**Phase:** 1 - Foundation  
**Dependencies:** HUNMETSYS-001, HUNMETSYS-002 (component schemas)

## Objective

Implement the DIGEST_FOOD operation handler that converts stomach buffer content to energy reserve based on conversion rate and efficiency.

## Files to Touch

### New Files (3)
- `data/schemas/operations/digestFood.schema.json`
- `src/logic/operationHandlers/digestFoodHandler.js`
- `tests/unit/logic/operationHandlers/digestFoodHandler.test.js`

### Modified Files (4)
- `data/schemas/operation.schema.json` (add $ref to digestFood schema)
- `src/dependencyInjection/tokens/tokens-core.js` (add DigestFoodHandler token)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (add handler factory)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (register DIGEST_FOOD operation)
- `src/utils/preValidationUtils.js` (add to KNOWN_OPERATION_TYPES whitelist)

## Out of Scope

- ❌ Digestion speed modifiers based on food type (handled at action level)
- ❌ Integration with turn system (covered in HUNMETSYS-007)
- ❌ Rest action increasing digestion speed (covered in HUNMETSYS-009)
- ❌ Integration tests (covered in HUNMETSYS-017)

## Implementation Details

### Operation Schema

**File:** `data/schemas/operations/digestFood.schema.json`

**Parameters:**
- `entity_ref`: Entity with fuel_converter and metabolic_store (required)
- `turns`: Number of turns to process digestion (default 1, minimum 1)

**Calculation Formula:**
```
digestion_amount = min(buffer_storage, conversion_rate × activity_multiplier × turns)
energy_gained = digestion_amount × efficiency
new_buffer = buffer_storage - digestion_amount
new_energy = min(max_energy, current_energy + energy_gained)
```

### Handler Implementation

**File:** `src/logic/operationHandlers/digestFoodHandler.js`

**Class:** `DigestFoodHandler extends BaseOperationHandler`

**Key Responsibilities:**
1. Resolve entity reference
2. Retrieve both fuel_converter and metabolic_store components
3. Calculate digestion amount (cannot exceed buffer contents)
4. Calculate energy gained with efficiency loss
5. Update buffer_storage (reduce by digestion amount)
6. Update current_energy (cap at max_energy)
7. Dispatch `metabolism:food_digested` event

**Dependencies (via DI):**
- `#entityManager` (IEntityManager)
- `#logger` (ILogger)
- `#safeEventDispatcher` (ISafeEventDispatcher)

**Event Dispatched:**
```json
{
  "type": "metabolism:food_digested",
  "payload": {
    "entityId": "string",
    "bufferReduced": number,
    "energyGained": number,
    "newBuffer": number,
    "newEnergy": number,
    "efficiency": number
  }
}
```

### Key Logic Details

**Cannot Digest More Than Buffer:**
```javascript
const maxDigestion = converter.conversion_rate * converter.activity_multiplier * turns;
const actualDigestion = Math.min(converter.buffer_storage, maxDigestion);
```

**Efficiency Loss:**
```javascript
const energyGained = actualDigestion * converter.efficiency;
// If efficiency is 0.8, then 20% of buffer content is "wasted" metabolically
```

**Energy Cap:**
```javascript
const newEnergy = Math.min(store.max_energy, store.current_energy + energyGained);
// Excess energy beyond max is lost (can't overeat beyond capacity)
```

## Acceptance Criteria

### Schema Validation
- [ ] Operation schema validates against base-operation.schema.json
- [ ] Schema added to operation.schema.json anyOf array
- [ ] Type constant is "DIGEST_FOOD"
- [ ] All parameters properly typed with defaults

### Handler Implementation
- [ ] Handler extends BaseOperationHandler
- [ ] All dependencies validated via validateDependency
- [ ] Execute method is async
- [ ] Digestion calculation matches spec formula
- [ ] Cannot digest more than buffer_storage
- [ ] Energy gain includes efficiency calculation
- [ ] Energy capped at max_energy
- [ ] Both components updated atomically
- [ ] Event dispatched with complete payload

### Dependency Injection
- [ ] Token added to tokens-core.js as 'DigestFoodHandler'
- [ ] Factory registered in operationHandlerRegistrations.js
- [ ] Operation mapped in interpreterRegistrations.js
- [ ] Type added to KNOWN_OPERATION_TYPES in preValidationUtils.js

### Unit Test Coverage (>90%)
- [ ] Test: converts buffer to energy with efficiency
- [ ] Test: handles multiple turns correctly
- [ ] Test: cannot digest more than buffer_storage
- [ ] Test: caps energy at max_energy (waste excess)
- [ ] Test: handles empty buffer (no-op)
- [ ] Test: uses activity_multiplier correctly
- [ ] Test: dispatches food_digested event
- [ ] Test: throws error when fuel_converter missing
- [ ] Test: throws error when metabolic_store missing
- [ ] Test: updates both components atomically

## Test Examples

### Basic Digestion
```javascript
it('should convert buffer to energy with efficiency', async () => {
  const entityId = 'actor_1';
  
  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 40,
    conversion_rate: 5,
    efficiency: 0.8,
    accepted_fuel_tags: ['organic'],
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    current_energy: 600,
    max_energy: 1000,
    base_burn_rate: 1.0
  });

  await handler.execute({
    entity_ref: entityId,
    turns: 1
  }, testBed.context);

  const converter = testBed.entityManager.getComponent(entityId, 'metabolism:fuel_converter');
  const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  
  // Digested: min(40, 5 * 1.0 * 1) = 5
  // Energy gained: 5 * 0.8 = 4
  expect(converter.buffer_storage).toBe(35); // 40 - 5
  expect(store.current_energy).toBe(604); // 600 + 4
});
```

### Buffer Limit
```javascript
it('cannot digest more than buffer_storage', async () => {
  const entityId = 'actor_1';
  
  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 3, // Very little in buffer
    conversion_rate: 10, // High conversion rate
    efficiency: 0.8,
    accepted_fuel_tags: ['organic'],
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    current_energy: 500,
    max_energy: 1000,
    base_burn_rate: 1.0
  });

  await handler.execute({
    entity_ref: entityId,
    turns: 1
  }, testBed.context);

  const converter = testBed.entityManager.getComponent(entityId, 'metabolism:fuel_converter');
  const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  
  // Should only digest 3 (all that's available), not 10
  expect(converter.buffer_storage).toBe(0);
  expect(store.current_energy).toBe(502.4); // 500 + (3 * 0.8)
});
```

### Energy Cap
```javascript
it('should cap energy at max_energy', async () => {
  const entityId = 'actor_1';
  
  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    buffer_storage: 50,
    conversion_rate: 10,
    efficiency: 1.0, // Perfect efficiency
    accepted_fuel_tags: ['organic'],
    activity_multiplier: 1.0
  });
  
  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    current_energy: 995,
    max_energy: 1000,
    base_burn_rate: 1.0
  });

  await handler.execute({
    entity_ref: entityId,
    turns: 1
  }, testBed.context);

  const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  
  // Would gain 10 energy, but capped at 1000
  expect(store.current_energy).toBe(1000);
});
```

## Invariants

### Must Remain True
- Buffer storage can never be negative
- Energy can never exceed max_energy
- Digestion amount always ≤ buffer_storage
- Efficiency loss must be applied (0 < efficiency ≤ 1.0)

### System Invariants
- Both components must be updated or neither (atomic operation)
- Event dispatched only on successful digestion
- Buffer reduction exactly matches energy gain calculation
- No other entity components are modified

## References

- Spec: Lines 487-545 (DIGEST_FOOD Operation)
- Spec: Lines 1400-1512 (Digestion Buffer Mechanics)
- Related: HUNMETSYS-001 (fuel_converter schema)
- Related: HUNMETSYS-002 (metabolic_store schema)
- Related: HUNMETSYS-007 (turn-based digestion rule)

## Definition of Done

- [ ] Operation schema created and validates
- [ ] Handler implemented following project patterns
- [ ] All DI registration completed
- [ ] Unit tests written with >90% coverage
- [ ] All tests pass: `npm run test:unit`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npx eslint <modified-files>`
- [ ] Committed with message: "feat(metabolism): implement DIGEST_FOOD operation handler"
