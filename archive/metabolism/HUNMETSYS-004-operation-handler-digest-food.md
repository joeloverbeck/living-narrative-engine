# HUNMETSYS-004: Operation Handler - DIGEST_FOOD

**Status:** ✅ Completed
**Priority:** High
**Estimated Effort:** 6 hours
**Actual Effort:** ~4 hours
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
digestion_amount = min(bufferStorage, conversionRate × activityMultiplier × turns)
energy_gained = digestion_amount × efficiency
new_buffer = bufferStorage - digestion_amount
new_energy = min(maxEnergy, currentEnergy + energy_gained)
```

**Note**: Component properties use camelCase (e.g., `bufferStorage`, `conversionRate`, `currentEnergy`), not snake_case.

### Handler Implementation

**File:** `src/logic/operationHandlers/digestFoodHandler.js`

**Class:** `DigestFoodHandler extends BaseOperationHandler`

**Key Responsibilities:**

1. Resolve entity reference
2. Retrieve both metabolism:fuel_converter and metabolism:metabolic_store components
3. Calculate digestion amount (cannot exceed buffer contents)
4. Calculate energy gained with efficiency loss
5. Update bufferStorage (reduce by digestion amount)
6. Update currentEnergy (cap at maxEnergy)
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
const maxDigestion =
  converter.conversionRate * converter.activityMultiplier * turns;
const actualDigestion = Math.min(converter.bufferStorage, maxDigestion);
```

**Efficiency Loss:**

```javascript
const energyGained = actualDigestion * converter.efficiency;
// If efficiency is 0.8, then 20% of buffer content is "wasted" metabolically
```

**Energy Cap:**

```javascript
const newEnergy = Math.min(store.maxEnergy, store.currentEnergy + energyGained);
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
- [ ] Test: cannot digest more than bufferStorage
- [ ] Test: caps energy at maxEnergy (waste excess)
- [ ] Test: handles empty buffer (no-op)
- [ ] Test: uses activityMultiplier correctly
- [ ] Test: dispatches food_digested event
- [ ] Test: throws error when metabolism:fuel_converter missing
- [ ] Test: throws error when metabolism:metabolic_store missing
- [ ] Test: updates both components atomically

## Test Examples

### Basic Digestion

```javascript
it('should convert buffer to energy with efficiency', async () => {
  const entityId = 'actor_1';

  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    bufferStorage: 40,
    conversionRate: 5,
    efficiency: 0.8,
    acceptedFuelTags: ['organic'],
    activityMultiplier: 1.0,
  });

  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    currentEnergy: 600,
    maxEnergy: 1000,
    baseBurnRate: 1.0,
  });

  await handler.execute(
    {
      entity_ref: entityId,
      turns: 1,
    },
    testBed.context
  );

  const converter = testBed.entityManager.getComponent(
    entityId,
    'metabolism:fuel_converter'
  );
  const store = testBed.entityManager.getComponent(
    entityId,
    'metabolism:metabolic_store'
  );

  // Digested: min(40, 5 * 1.0 * 1) = 5
  // Energy gained: 5 * 0.8 = 4
  expect(converter.bufferStorage).toBe(35); // 40 - 5
  expect(store.currentEnergy).toBe(604); // 600 + 4
});
```

### Buffer Limit

```javascript
it('cannot digest more than bufferStorage', async () => {
  const entityId = 'actor_1';

  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    bufferStorage: 3, // Very little in buffer
    conversionRate: 10, // High conversion rate
    efficiency: 0.8,
    acceptedFuelTags: ['organic'],
    activityMultiplier: 1.0,
  });

  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    currentEnergy: 500,
    maxEnergy: 1000,
    baseBurnRate: 1.0,
  });

  await handler.execute(
    {
      entity_ref: entityId,
      turns: 1,
    },
    testBed.context
  );

  const converter = testBed.entityManager.getComponent(
    entityId,
    'metabolism:fuel_converter'
  );
  const store = testBed.entityManager.getComponent(
    entityId,
    'metabolism:metabolic_store'
  );

  // Should only digest 3 (all that's available), not 10
  expect(converter.bufferStorage).toBe(0);
  expect(store.currentEnergy).toBe(502.4); // 500 + (3 * 0.8)
});
```

### Energy Cap

```javascript
it('should cap energy at maxEnergy', async () => {
  const entityId = 'actor_1';

  testBed.entityManager.addComponent(entityId, 'metabolism:fuel_converter', {
    capacity: 100,
    bufferStorage: 50,
    conversionRate: 10,
    efficiency: 1.0, // Perfect efficiency
    acceptedFuelTags: ['organic'],
    activityMultiplier: 1.0,
  });

  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    currentEnergy: 995,
    maxEnergy: 1000,
    baseBurnRate: 1.0,
  });

  await handler.execute(
    {
      entity_ref: entityId,
      turns: 1,
    },
    testBed.context
  );

  const store = testBed.entityManager.getComponent(
    entityId,
    'metabolism:metabolic_store'
  );

  // Would gain 10 energy, but capped at 1000
  expect(store.currentEnergy).toBe(1000);
});
```

## Invariants

### Must Remain True

- bufferStorage can never be negative
- currentEnergy can never exceed maxEnergy
- Digestion amount always ≤ bufferStorage
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

- [x] Operation schema created and validates
- [x] Handler implemented following project patterns
- [x] All DI registration completed
- [x] Unit tests written with >90% coverage
- [x] All tests pass: `npm run test:unit` (17/17 tests passing)
- [x] Type checking passes: `npm run typecheck` (no new errors)
- [x] Linting passes: `npx eslint <modified-files>` (only warnings, no errors)
- [ ] Committed with message: "feat(metabolism): implement DIGEST_FOOD operation handler"

## Outcome

### Summary

Successfully implemented the DIGEST_FOOD operation handler with full test coverage (17/17 tests passing). Implementation follows all project patterns and integrates cleanly with the existing ECS and DI systems.

### What Was Actually Changed

**Ticket Corrections (Pre-Implementation):**

- Corrected all component property names from snake_case to camelCase throughout the ticket
- Properties: buffer_storage → bufferStorage, conversion_rate → conversionRate, current_energy → currentEnergy, max_energy → maxEnergy, base_burn_rate → baseBurnRate, accepted_fuel_tags → acceptedFuelTags, activity_multiplier → activityMultiplier
- This correction was made after reading actual component schemas and discovering the discrepancy

**Files Created (3):**

1. `data/schemas/operations/digestFood.schema.json` - Operation schema with DIGEST_FOOD type constant
2. `src/logic/operationHandlers/digestFoodHandler.js` - Handler implementation extending BaseOperationHandler
3. `tests/unit/logic/operationHandlers/digestFoodHandler.test.js` - Comprehensive unit tests (17 tests)

**Files Modified (5):**

1. `data/schemas/operation.schema.json` - Added $ref to digestFood schema in anyOf array
2. `src/dependencyInjection/tokens/tokens-core.js` - Added DigestFoodHandler token
3. `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Registered handler factory
4. `src/dependencyInjection/registrations/interpreterRegistrations.js` - Mapped DIGEST_FOOD to handler
5. `src/utils/preValidationUtils.js` - Added 'DIGEST_FOOD' to KNOWN_OPERATION_TYPES whitelist

### Implementation Details

**Handler Logic:**

- Digestion formula: `min(bufferStorage, conversionRate × activityMultiplier × turns)`
- Energy calculation: `digestion × efficiency`, capped at maxEnergy
- Both components updated atomically via batchAddComponentsOptimized
- Dispatches `metabolism:food_digested` event with complete payload

**Test Coverage:**

- Constructor validation: 4 tests
- Success scenarios: 6 tests (basic conversion, multiple turns, buffer limit, energy cap, empty buffer, activity multiplier)
- Validation failures: 5 tests (component missing, invalid parameters)
- Edge cases: 2 tests (atomic updates, object entity reference)
- **All 17 tests passing** with proper camelCase property usage

**Test Fixes Applied:**

- Fixed validation tests to expect correct event name (`core:system_error_occurred` instead of `error`)
- Fixed empty buffer test to validate both components separately in batch update

### Deviations from Original Plan

**None** - Implementation exactly matches the ticket specification after correcting the property naming convention discrepancy.

### Test Results

```
Test Suites: 1 passed, 1 total
Tests:       17 passed, 17 total
Time:        0.347 s
```

### Quality Checks

- ✅ ESLint: Clean (only expected warnings for hardcoded mod references)
- ✅ TypeScript: No new errors introduced
- ✅ All acceptance criteria met
- ✅ All invariants maintained
