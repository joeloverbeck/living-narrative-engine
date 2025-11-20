# HUNMETSYS-003: Operation Handler - BURN_ENERGY

**Status:** Ready  
**Priority:** High  
**Estimated Effort:** 6 hours  
**Phase:** 1 - Foundation  
**Dependencies:** HUNMETSYS-002 (metabolic_store schema)

## Objective

Implement the BURN_ENERGY operation handler that calculates and subtracts energy based on base burn rate and activity multiplier.

## Files to Touch

### New Files (4)
- `data/schemas/operations/burnEnergy.schema.json`
- `src/logic/operationHandlers/burnEnergyHandler.js`
- `tests/unit/logic/operationHandlers/burnEnergyHandler.test.js`
- `tests/unit/validation/burnEnergySchema.test.js`

### Modified Files (4)
- `data/schemas/operation.schema.json` (add $ref to burnEnergy schema)
- `src/dependencyInjection/tokens/tokens-core.js` (add BurnEnergyHandler token)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (add handler factory)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (register BURN_ENERGY operation)
- `src/utils/preValidationUtils.js` (add to KNOWN_OPERATION_TYPES whitelist)

## Out of Scope

- ❌ Integration with turn system (covered in HUNMETSYS-007)
- ❌ Activity multiplier calculation logic (each action sets its own)
- ❌ Integration tests with actual game scenarios (covered in HUNMETSYS-017)
- ❌ Performance testing (covered in HUNMETSYS-017)

## Implementation Details

### Operation Schema

**File:** `data/schemas/operations/burnEnergy.schema.json`

**Parameters:**
- `entity_ref`: Entity with metabolic_store component (required)
- `activity_multiplier`: Multiplier for burn rate (default 1.0, minimum 0)
- `turns`: Number of turns to calculate burn for (default 1, minimum 1)

**Calculation Formula:**
```
energy_burned = base_burn_rate × activity_multiplier × turns
new_energy = max(0, current_energy - energy_burned)
```

### Handler Implementation

**File:** `src/logic/operationHandlers/burnEnergyHandler.js`

**Class:** `BurnEnergyHandler extends BaseOperationHandler`

**Key Responsibilities:**
1. Resolve entity reference from parameters
2. Retrieve metabolic_store component
3. Calculate energy burned
4. Clamp result to minimum 0
5. Update component via entityManager
6. Dispatch `metabolism:energy_burned` event

**Dependencies (via DI):**
- `#entityManager` (IEntityManager)
- `#logger` (ILogger)
- `#safeEventDispatcher` (ISafeEventDispatcher)

**Event Dispatched:**
```json
{
  "type": "metabolism:energy_burned",
  "payload": {
    "entityId": "string",
    "energyBurned": number,
    "newEnergy": number,
    "activityMultiplier": number
  }
}
```

### Error Handling

**Must throw clear errors for:**
- Missing metabolic_store component
- Invalid entity reference
- Negative activity multiplier
- Negative or zero turns

**Must NOT throw for:**
- Energy dropping to zero (clamp to 0)
- Very high activity multipliers (valid gameplay)

## Acceptance Criteria

### Schema Validation
- [ ] Operation schema validates against base-operation.schema.json
- [ ] Schema added to operation.schema.json anyOf array
- [ ] Type constant is "BURN_ENERGY"
- [ ] All parameters properly typed with defaults

### Handler Implementation
- [ ] Handler extends BaseOperationHandler
- [ ] All dependencies validated via validateDependency
- [ ] Execute method is async
- [ ] Energy calculation matches spec formula
- [ ] Energy clamped to minimum 0
- [ ] Component updated via modifyComponent
- [ ] Event dispatched with correct payload

### Dependency Injection
- [ ] Token added to tokens-core.js as 'BurnEnergyHandler'
- [ ] Factory registered in operationHandlerRegistrations.js
- [ ] Operation mapped in interpreterRegistrations.js
- [ ] Type added to KNOWN_OPERATION_TYPES in preValidationUtils.js

### Unit Test Coverage (>90%)
- [ ] Test: reduces energy based on burn rate and activity
- [ ] Test: handles multiple turns correctly
- [ ] Test: does not reduce energy below zero
- [ ] Test: dispatches energy_burned event with correct data
- [ ] Test: throws error when metabolic_store missing
- [ ] Test: throws error for invalid entity reference
- [ ] Test: handles default parameters correctly
- [ ] Test: validates activity_multiplier range

### Schema Validation Tests
- [ ] Test: valid operation data validates
- [ ] Test: missing required parameters rejected
- [ ] Test: negative activity_multiplier rejected
- [ ] Test: zero or negative turns rejected

## Test Examples

### Basic Energy Burn
```javascript
it('should reduce energy based on burn rate and activity', async () => {
  const entityId = 'actor_1';
  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    current_energy: 1000,
    max_energy: 1000,
    base_burn_rate: 10
  });

  await handler.execute({
    entity_ref: entityId,
    activity_multiplier: 2.0,
    turns: 1
  }, testBed.context);

  const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  expect(store.current_energy).toBe(980); // 1000 - (10 * 2.0 * 1)
});
```

### Energy Floor at Zero
```javascript
it('should not reduce energy below zero', async () => {
  const entityId = 'actor_1';
  testBed.entityManager.addComponent(entityId, 'metabolism:metabolic_store', {
    current_energy: 5,
    max_energy: 1000,
    base_burn_rate: 10
  });

  await handler.execute({
    entity_ref: entityId,
    activity_multiplier: 1.0,
    turns: 1
  }, testBed.context);

  const store = testBed.entityManager.getComponent(entityId, 'metabolism:metabolic_store');
  expect(store.current_energy).toBe(0);
});
```

## Invariants

### Must Remain True
- Energy can never be negative
- Energy burned calculation must be deterministic
- Event must be dispatched after successful burn
- Original max_energy must not be modified

### System Invariants
- EntityManager component modification works correctly
- Event dispatcher continues functioning
- No other components are modified
- Operation can be called multiple times per turn

## References

- Spec: Lines 393-486 (BURN_ENERGY Operation)
- CLAUDE.md: Adding New Operations checklist
- Related: HUNMETSYS-002 (metabolic_store schema)
- Related: HUNMETSYS-007 (turn-based energy burn rule)

## Definition of Done

- [ ] Operation schema created and validates
- [ ] Handler implemented following project patterns
- [ ] All DI registration completed
- [ ] Unit tests written with >90% coverage
- [ ] All tests pass: `npm run test:unit`
- [ ] Type checking passes: `npm run typecheck`
- [ ] Linting passes: `npx eslint <modified-files>`
- [ ] Committed with message: "feat(metabolism): implement BURN_ENERGY operation handler"
