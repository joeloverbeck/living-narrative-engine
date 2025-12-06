# HUNMETSYS-018: Edge Cases & Error Handling

**Status:** Not Started  
**Phase:** 6 - Polish  
**Priority:** High  
**Estimated Effort:** 6 hours  
**Dependencies:** HUNMETSYS-001-017 (all previous)

## Objective

Handle all edge cases identified in spec and add comprehensive error handling to all operation handlers, ensuring system robustness and graceful degradation.

## Context

The spec identifies 8 critical edge cases that must be handled gracefully. This ticket systematically addresses each one with proper validation, clamping, and error messages.

## Edge Cases to Handle

### 1. Negative Energy Scenarios

**Problem:** Entity energy drops to or below zero

**Solution:**

- Clamp energy to minimum of 0 in BURN_ENERGY handler
- Apply critical state when energy = 0
- Prevent energy from going negative

**Files to Modify:**

- `src/logic/operationHandlers/burnEnergyHandler.js`
- `src/logic/operationHandlers/updateHungerStateHandler.js`

```javascript
// In burnEnergyHandler.js
const newEnergy = Math.max(0, store.current_energy - energyBurned);
```

### 2. Overeating Mechanics

**Problem:** Player tries to eat beyond stomach capacity

**Solution:**

- Validate capacity in CONSUME_ITEM handler
- Throw clear error message
- Optional: Add overfull component with penalties

**Files to Modify:**

- `src/logic/operationHandlers/consumeItemHandler.js`

```javascript
const availableSpace = converter.capacity - converter.buffer_storage;
if (fuelSource.bulk > availableSpace) {
  throw new Error(
    `Stomach is too full. Need ${fuelSource.bulk} space, have ${availableSpace}`
  );
}
```

### 3. Invalid Fuel Types

**Problem:** Trying to consume fuel converter doesn't accept

**Solution:**

- Validate fuel tags match in CONSUME_ITEM handler
- Clear error message listing compatible types

**Files to Modify:**

- `src/logic/operationHandlers/consumeItemHandler.js`

```javascript
const hasMatchingTag = fuelSource.fuel_tags.some((tag) =>
  converter.accepted_fuel_tags.includes(tag)
);

if (!hasMatchingTag) {
  throw new Error(
    `Incompatible fuel type. ` +
      `Accepts: ${converter.accepted_fuel_tags.join(', ')}. ` +
      `Item has: ${fuelSource.fuel_tags.join(', ')}`
  );
}
```

### 4. Missing Components

**Problem:** Entity missing required metabolism components

**Solution:**

- Defensive checks in all handlers
- Graceful degradation (log warning, return early)
- OR: Throw clear error depending on context

**Files to Modify:** All operation handlers

```javascript
if (!entityManager.hasComponent(entityId, 'metabolism:metabolic_store')) {
  logger.warn(
    `Entity ${entityId} missing metabolism:metabolic_store, skipping`
  );
  return;
}
```

### 5. Energy Underflow/Overflow

**Problem:** Calculations causing negative or excessive values

**Solution:**

- Always clamp energy values
- Log overflow/underflow for debugging

**Files to Modify:**

- `src/logic/operationHandlers/digestFoodHandler.js`
- `src/logic/operationHandlers/burnEnergyHandler.js`

```javascript
const newEnergy = Math.max(0, Math.min(store.max_energy, calculatedEnergy));

if (calculatedEnergy > store.max_energy) {
  logger.debug(
    `Energy overflow: ${calculatedEnergy} > ${store.max_energy}, clamped`
  );
}
```

### 6. Turn Processing Order Issues

**Problem:** Conflicting operations in same turn

**Solution:**

- Ensure deterministic processing order in turn rules
- Document required sequence

**Files to Modify:**

- `data/mods/metabolism/rules/turn_energy_burn.rule.json` (ensure priority: 1)
- `data/mods/metabolism/rules/turn_digestion.rule.json` (ensure priority: 2)
- `data/mods/metabolism/rules/turn_hunger_update.rule.json` (ensure priority: 3)

### 7. Division by Zero

**Problem:** Zero conversion rate or burn rate

**Solution:**

- Validate non-zero rates in schemas (minimum: 0.1)
- Defensive checks in calculations

**Files to Modify:**

- Component schemas (add minimum: 0.1)
- Operation handlers (defensive max(0.1, rate))

### 8. Simultaneous Consumption

**Problem:** Multiple actions trying to consume same food item

**Solution:**

- Document that entity locking is handled by core system
- Add validation that item still exists

**Files to Modify:**

- `src/logic/operationHandlers/consumeItemHandler.js`

```javascript
// Verify item still exists
if (!this.#entityManager.hasEntity(itemId)) {
  throw new Error('Item no longer available');
}
```

## Files to Touch

### Modified Files (10+)

**Operation Handlers:**

1. `src/logic/operationHandlers/burnEnergyHandler.js` (edge cases 1, 5)
2. `src/logic/operationHandlers/digestFoodHandler.js` (edge cases 5, 7)
3. `src/logic/operationHandlers/consumeItemHandler.js` (edge cases 2, 3, 4, 8)
4. `src/logic/operationHandlers/updateHungerStateHandler.js` (edge case 4)
5. `src/logic/operationHandlers/updateBodyCompositionHandler.js` (edge case 4)

**Component Schemas:** 6. `data/mods/metabolism/components/fuel_converter.component.json` (edge case 7) 7. `data/mods/metabolism/components/metabolic_store.component.json` (edge case 7)

**Turn Rules:** 8. `data/mods/metabolism/rules/turn_energy_burn.rule.json` (edge case 6 - add priority) 9. `data/mods/metabolism/rules/turn_digestion.rule.json` (edge case 6 - add priority) 10. `data/mods/metabolism/rules/turn_hunger_update.rule.json` (edge case 6 - add priority)

## Out of Scope

**Not Included:**

- ❌ Vomit mechanic implementation (future extension)
- ❌ Overfull component with penalties (nice-to-have)
- ❌ Recovery mechanics for body composition
- ❌ Entity locking system (assumed exists in core)

## Acceptance Criteria

**Must Have:**

- ✅ All 8 edge cases handled
- ✅ Energy values always clamped to [0, max_energy]
- ✅ Clear error messages for invalid operations
- ✅ Graceful degradation for missing components
- ✅ No division by zero errors
- ✅ Deterministic turn processing order
- ✅ Validation added to all operation handlers
- ✅ Tests added for all edge cases
- ✅ No crashes or undefined behavior

**Error Message Quality:**

- ✅ Messages explain what went wrong
- ✅ Messages suggest what's needed
- ✅ Messages include relevant values

## Testing Strategy

Create edge case tests for each scenario:

```bash
# New test files
tests/unit/logic/operationHandlers/edgeCases/
  ├── burnEnergy.edgeCases.test.js
  ├── digestFood.edgeCases.test.js
  ├── consumeItem.edgeCases.test.js
  ├── updateHungerState.edgeCases.test.js
  └── updateBodyComposition.edgeCases.test.js
```

## References

- **Spec:** Section "Edge Cases" (p. 35-37)
- **Previous:** HUNMETSYS-017 (Integration tests)
- **Next:** HUNMETSYS-019 (Complete coverage)
