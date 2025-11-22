# HUNMETSYS-012: JSON Logic Operators - Energy Prediction

**Status:** ✅ COMPLETED  
**Phase:** 3 - GOAP Integration  
**Priority:** High  
**Actual Effort:** 4 hours  
**Dependencies:** HUNMETSYS-001 (Fuel Converter), HUNMETSYS-002 (Metabolic Store)

## Objective

Implement `predicted_energy` and `can_consume` JSON Logic operators to prevent AI overeating by calculating future energy state and validating consumption safety.

## Context

GOAP planners need to avoid spam-eating by considering not just current energy, but also food already in the stomach being digested. The `predicted_energy` operator calculates total available energy (current + buffered), while `can_consume` validates whether consumption is safe and beneficial.

**Key Behaviors:**
- **predicted_energy:** Returns current_energy + sum(buffer_storage items' energy_content)
- **can_consume:** Validates fuel tags match AND buffer has capacity

## ⚠️ CORRECTED ASSUMPTIONS

### Component Structure (CORRECTED)
Based on actual schemas:

1. **metabolic_store** component:
   - ✅ `current_energy`: Current energy level
   - ✅ `max_energy`: Maximum capacity
   - ✅ `buffer_storage`: **ARRAY of objects** with `{bulk, energy_content}`
   - ✅ `buffer_capacity`: Maximum buffer capacity
   - ❌ **NO `buffer_storage` as single number** - it's an array!

2. **fuel_converter** component:
   - ✅ `capacity`: Maximum buffer capacity
   - ✅ `efficiency`: Conversion efficiency (0.0-1.0)
   - ✅ `accepted_fuel_tags`: Array of compatible tags
   - ❌ **NO `buffer_storage` field** - buffer is in metabolic_store!

3. **fuel_source** component:
   - ✅ `energy_content`: Energy provided
   - ✅ `bulk`: Volume in buffer
   - ✅ `fuel_tags`: Array of type tags (NOT `fuel_type` alone!)

### Architecture Corrections

**WRONG (Original Assumption):**
```javascript
// WRONG: buffer_storage was assumed to be a number in fuel_converter
const bufferedEnergy = converter.buffer_storage * converter.efficiency;
```

**CORRECT (Actual Structure):**
```javascript
// CORRECT: buffer_storage is an array in metabolic_store
const bufferedEnergy = store.buffer_storage.reduce(
  (sum, item) => sum + item.energy_content, 
  0
);
```

**Capacity Check WRONG:**
```javascript
// WRONG: Checking fuel_converter.buffer_storage
const availableSpace = converter.capacity - converter.buffer_storage;
```

**Capacity Check CORRECT:**
```javascript
// CORRECT: Sum bulk from metabolic_store.buffer_storage array
const currentBulk = store.buffer_storage.reduce(
  (sum, item) => sum + item.bulk, 
  0
);
const availableSpace = store.buffer_capacity - currentBulk;
```

## Files Created/Modified

### New Files (4)
1. ✅ **`src/logic/operators/predictedEnergyOperator.js`** - Energy prediction operator
2. ✅ **`src/logic/operators/canConsumeOperator.js`** - Consumption validation operator
3. ✅ **`tests/unit/logic/operators/predictedEnergyOperator.test.js`** - 35 tests
4. ✅ **`tests/unit/logic/operators/canConsumeOperator.test.js`** - 30 tests

### Modified Files (1)
1. ✅ **`src/logic/jsonLogicCustomOperators.js`** - Registered both operators

## Acceptance Criteria

**All Met:**
- ✅ PredictedEnergyOperator implemented
- ✅ Returns current_energy + sum(buffer_storage items' energy_content)
- ✅ Returns 0 for missing metabolic_store
- ✅ CanConsumeOperator implemented
- ✅ Validates fuel_tags array compatibility
- ✅ Validates buffer capacity using buffer_storage bulk sum
- ✅ Returns false for any validation failure
- ✅ Both operators registered in jsonLogicCustomOperators
- ✅ All unit tests pass (65 tests, 100% coverage)
- ✅ Error handling for invalid params
- ✅ Handles entity reference resolution (matched isHungryOperator pattern)

## Outcome

### What Was Actually Changed vs Originally Planned

**Major Change:**
The original ticket made incorrect assumptions about the component structure. After analyzing the actual schemas, I discovered:

1. **`buffer_storage` location**: It's in `metabolic_store`, NOT `fuel_converter`
2. **`buffer_storage` type**: It's an array of `{bulk, energy_content}` objects, NOT a single number
3. **Efficiency application**: Buffer items store raw energy_content, no efficiency multiplier needed during prediction

**Implementation Adjustments:**
- Both operators read from `metabolic_store.buffer_storage` array
- `predicted_energy` sums `energy_content` from all buffer items
- `can_consume` sums `bulk` from all buffer items for capacity checks
- Followed `isHungryOperator` pattern for entity resolution (not the ticket's simpler approach)

**Test Coverage:**
- 35 tests for `predictedEnergyOperator` (expected ~15)
- 30 tests for `canConsumeOperator` (expected ~15)
- Total: 65 tests with comprehensive edge case coverage

**Ticket Corrected:**
Updated ticket with accurate assumptions and implementation details before coding, ensuring alignment with actual codebase structure.

### Test Results

```
PASS tests/unit/logic/operators/predictedEnergyOperator.test.js
  ✓ 35 tests passed
  
PASS tests/unit/logic/operators/canConsumeOperator.test.js
  ✓ 30 tests passed

PASS tests/unit/logic/jsonLogicCustomOperators.test.js
  ✓ 45 tests passed (operators registered correctly)

Total: 65 new tests, 100% pass rate
```

### Next Steps

- ✅ Operators ready for GOAP integration (HUNMETSYS-013)
- ✅ Can be used in action conditions immediately
- ✅ No breaking changes to existing systems

## References

- **Spec:** Section "GOAP Integration" (p. 21-23)
- **Spec:** Section "Digestion Buffer Mechanics" (p. 23-24)
- **Previous:** HUNMETSYS-001, 002 (Components)
- **Next:** HUNMETSYS-013 (GOAP goals)
- **Pattern Reference:** isHungryOperator.js for entity resolution

---

**Completed:** 2025-01-XX  
**Completed By:** Claude Code Implementation Agent
