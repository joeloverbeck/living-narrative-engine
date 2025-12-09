# Remove Metabolism Mod - Specification

## Overview

This specification details the complete removal of the `metabolism` mod from the Living Narrative Engine, including all source code, schemas, tests, and references in dependent mods.

### Rationale

1. The metabolism system is not used in current gameplay scenarios
2. Runtime errors appear in `game.html` (e.g., "burning energy" errors)
3. The intoxicants mod entities contain metabolism-related data that is unused
4. Removing this mod simplifies the codebase and eliminates runtime pollution

---

## Files to Delete

### 1. Metabolism Mod Directory (28 files)

**Delete entire directory**: `data/mods/metabolism/`

| Category | Files |
|----------|-------|
| **Components (4)** | `components/fuel_converter.component.json`, `components/fuel_source.component.json`, `components/hunger_state.component.json`, `components/metabolic_store.component.json` |
| **Actions (3)** | `actions/drink.action.json`, `actions/eat.action.json`, `actions/rest.action.json` |
| **Rules (6)** | `rules/handle_drink_beverage.rule.json`, `rules/handle_eat_food.rule.json`, `rules/handle_rest.rule.json`, `rules/turn_1_energy_burn.rule.json`, `rules/turn_2_digestion.rule.json`, `rules/turn_3_update_hunger_state.rule.json` |
| **Conditions (8)** | `conditions/can-consume.condition.json`, `conditions/can_consume_item.condition.json`, `conditions/event-is-action-drink-beverage.condition.json`, `conditions/event-is-action-eat.condition.json`, `conditions/event-is-action-rest.condition.json`, `conditions/has_energy_above.condition.json`, `conditions/is_digesting.condition.json`, `conditions/is_hungry.condition.json` |
| **Scopes (2)** | `scopes/consumable_items.scope`, `scopes/inventory_food.scope` |
| **Entity Definitions (3)** | `entities/definitions/bread.entity.json`, `entities/definitions/steak.entity.json`, `entities/definitions/water.entity.json` |
| **Goals (1)** | `goals/satisfy_hunger.goal.json` |
| **Lookups (1)** | `lookups/hunger_thresholds.json` |
| **Manifest (1)** | `mod-manifest.json` |

---

### 2. Operation Handlers (4 files)

**Delete**:
- `src/logic/operationHandlers/burnEnergyHandler.js`
- `src/logic/operationHandlers/digestFoodHandler.js`
- `src/logic/operationHandlers/consumeItemHandler.js`
- `src/logic/operationHandlers/updateHungerStateHandler.js`

---

### 3. Operators (3 files)

**Delete**:
- `src/logic/operators/isHungryOperator.js`
- `src/logic/operators/predictedEnergyOperator.js`
- `src/logic/operators/canConsumeOperator.js`

---

### 4. Schema Files (4 files)

**Delete**:
- `data/schemas/operations/burnEnergy.schema.json`
- `data/schemas/operations/digestFood.schema.json`
- `data/schemas/operations/consumeItem.schema.json`
- `data/schemas/operations/updateHungerState.schema.json`

---

### 5. Test Files to Delete (22+ files)

#### Unit Tests - Operation Handlers
- `tests/unit/logic/operationHandlers/burnEnergyHandler.test.js`
- `tests/unit/logic/operationHandlers/digestFoodHandler.test.js`
- `tests/unit/logic/operationHandlers/consumeItemHandler.test.js`
- `tests/unit/logic/operationHandlers/updateHungerStateHandler.test.js`

#### Unit Tests - Edge Cases
- `tests/unit/logic/operationHandlers/edgeCases/burnEnergyEdgeCases.test.js`
- `tests/unit/logic/operationHandlers/edgeCases/digestFoodEdgeCases.test.js`
- `tests/unit/logic/operationHandlers/edgeCases/consumeItemEdgeCases.test.js`

#### Unit Tests - Operators
- `tests/unit/logic/operators/isHungryOperator.test.js`
- `tests/unit/logic/operators/predictedEnergyOperator.test.js`
- `tests/unit/logic/operators/canConsumeOperator.test.js`

#### Integration Tests
**Delete entire directory**: `tests/integration/mods/metabolism/`
- `handleDrinkBeverage.integration.test.js`
- `handleEatFood.integration.test.js`
- `handleRest.integration.test.js`
- `hungerCycle.test.js`
- `hungerOperators.test.js`
- `turnProcessing.test.js`

#### Performance Tests
**Delete entire directory**: `tests/performance/mods/metabolism/`
- `scalability.performance.test.js`
- `turnProcessing.performance.test.js`

#### GOAP Tests
- `tests/integration/goap/hungerGoals.test.js`

---

## Files to Modify

### 1. Configuration Files

#### `data/game.json`
**Action**: Remove `"metabolism"` from the mods array (line 32)

---

### 2. Dependency Injection System

#### `src/dependencyInjection/tokens/tokens-core.js`
**Action**: Remove these token definitions:
- `DigestFoodHandler: 'DigestFoodHandler'` (line 211)
- `BurnEnergyHandler: 'BurnEnergyHandler'` (line 237)
- `ConsumeItemHandler: 'ConsumeItemHandler'`
- `UpdateHungerStateHandler: 'UpdateHungerStateHandler'`

#### `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
**Action**:
- Remove import statements for: `BurnEnergyHandler`, `DigestFoodHandler`, `ConsumeItemHandler`, `UpdateHungerStateHandler`
- Remove factory registrations for these handlers (lines 170-179 for DigestFoodHandler, lines 413-422 for BurnEnergyHandler, and similar for others)

#### `src/dependencyInjection/registrations/interpreterRegistrations.js`
**Action**: Remove operation mappings:
- `registry.register('DIGEST_FOOD', bind(tokens.DigestFoodHandler));` (line 89)
- `registry.register('BURN_ENERGY', bind(tokens.BurnEnergyHandler));` (line 133)
- `registry.register('CONSUME_ITEM', bind(tokens.ConsumeItemHandler));`
- `registry.register('UPDATE_HUNGER_STATE', bind(tokens.UpdateHungerStateHandler));`

---

### 3. Pre-Validation System

#### `src/utils/preValidationUtils.js`
**Action**: Remove from `KNOWN_OPERATION_TYPES` array:
- `'BURN_ENERGY'` (line 42)
- `'CONSUME_ITEM'` (line 44)
- `'DIGEST_FOOD'` (line 45)
- `'UPDATE_HUNGER_STATE'` (line 105)

---

### 4. JSON Logic Operators

#### `src/logic/jsonLogicCustomOperators.js`
**Action**: Remove operator registrations (approximately lines 486-510):
- `is_hungry` operator registration
- `predicted_energy` operator registration
- `can_consume` operator registration
- Remove associated imports for these operators

---

### 5. Schema References

#### `data/schemas/operation.schema.json`
**Action**: Remove `$ref` entries from the `anyOf` array:
- `{ "$ref": "./operations/consumeItem.schema.json" }` (line 72)
- `{ "$ref": "./operations/digestFood.schema.json" }` (line 75)
- `{ "$ref": "./operations/burnEnergy.schema.json" }` (line 132)
- `{ "$ref": "./operations/updateHungerState.schema.json" }` (line 135)

---

### 6. Dependent Mods

#### Intoxicants Mod

**`data/mods/intoxicants/mod-manifest.json`**
**Action**: Remove metabolism from dependencies array (lines 11-23)

**Entity files to modify** (remove `metabolism:fuel_source` component):
- `data/mods/intoxicants/entities/definitions/jug_of_mead.entity.json` (lines 24-31)
- `data/mods/intoxicants/entities/definitions/jug_of_cider.entity.json` (lines 24-31)
- `data/mods/intoxicants/entities/definitions/jug_of_ale.entity.json` (lines 24-31)

#### Fantasy Mod

**Entity file to modify** (remove `metabolism:fuel_source` component):
- `data/mods/fantasy/entities/definitions/ale_tankard.entity.json` (lines 25-32)

---

### 7. Test Helpers

#### `tests/common/mods/ModTestHandlerFactory.js`
**Action**: Review and remove any metabolism-specific test helpers

#### `tests/unit/common/mods/ModTestHandlerFactory.completeness.test.js`
**Action**: Review and update if it references metabolism handlers

---

## Execution Order

1. **Phase 1: Delete source files**
   - Delete operation handlers
   - Delete operators
   - Delete schema files

2. **Phase 2: Update DI system**
   - Remove token definitions
   - Remove handler registrations
   - Remove interpreter mappings

3. **Phase 3: Update validation**
   - Remove operation types from preValidationUtils.js
   - Remove schema references from operation.schema.json
   - Remove operator registrations from jsonLogicCustomOperators.js

4. **Phase 4: Update configuration**
   - Remove metabolism from game.json mods array

5. **Phase 5: Update dependent mods**
   - Remove metabolism dependency from intoxicants manifest
   - Remove metabolism:fuel_source component from entity definitions

6. **Phase 6: Delete mod directory**
   - Delete entire data/mods/metabolism/ directory

7. **Phase 7: Delete tests**
   - Delete all metabolism-related test files

8. **Phase 8: Validate**
   - Run `npm run validate`
   - Run `npm run test:unit`
   - Run `npm run test:integration`
   - Verify no runtime errors in game.html

---

## Summary

| Category | Files to Delete | Files to Modify |
|----------|-----------------|-----------------|
| Mod Directory | 28 | 0 |
| Operation Handlers | 4 | 0 |
| Operators | 3 | 0 |
| Schemas | 4 | 1 |
| DI System | 0 | 3 |
| Validation | 0 | 2 |
| Configuration | 0 | 1 |
| Dependent Mods | 0 | 5 |
| Tests | 22+ | 2 |
| **Total** | **61+** | **14** |
