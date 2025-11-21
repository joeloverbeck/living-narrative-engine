# HUNMETSYS-012: JSON Logic Operators - Energy Prediction

**Status:** Not Started  
**Phase:** 3 - GOAP Integration  
**Priority:** High  
**Estimated Effort:** 5 hours  
**Dependencies:** HUNMETSYS-001 (Fuel Converter), HUNMETSYS-002 (Metabolic Store)

## Objective

Implement `predicted_energy` and `can_consume` JSON Logic operators to prevent AI overeating by calculating future energy state and validating consumption safety.

## Context

GOAP planners need to avoid spam-eating by considering not just current energy, but also food already in the stomach being digested. The `predicted_energy` operator calculates total available energy (current + buffered), while `can_consume` validates whether consumption is safe and beneficial.

**Key Behaviors:**
- **predicted_energy:** Returns current_energy + (buffer_storage × efficiency)
- **can_consume:** Validates fuel tags match AND buffer has capacity

## Files to Touch

### New Files (4)
1. **`src/logic/operators/predictedEnergyOperator.js`**
   - Calculate predicted energy from current + buffer
   - Handle missing components gracefully

2. **`src/logic/operators/canConsumeOperator.js`**
   - Validate fuel tag compatibility
   - Validate buffer capacity available

3. **`tests/unit/logic/operators/predictedEnergyOperator.test.js`**
   - Test energy calculation
   - Test missing components
   - Test edge cases

4. **`tests/unit/logic/operators/canConsumeOperator.test.js`**
   - Test fuel tag validation
   - Test capacity validation
   - Test combined validation

### Modified Files (1)
1. **`src/logic/jsonLogicCustomOperators.js`**
   - Import and register both operators

## Implementation Details

### predictedEnergyOperator.js
```javascript
/**
 * @file JSON Logic operator that calculates predicted energy
 * Predicted energy = current energy + buffered energy
 * This prevents AI from overeating by considering digesting food
 */

import { resolveEntityReference } from '../utils/entityReferenceResolver.js';
import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Custom operator: predicted_energy
 * Returns entity's current energy plus energy being digested in buffer
 *
 * @example
 * { "predicted_energy": ["actor"] }
 * { ">": [{ "predicted_energy": ["self"] }, 700] }
 */
export class PredictedEnergyOperator {
  #entityManager;
  #logger;
  #operatorName = 'predicted_energy';

  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  get name() {
    return this.#operatorName;
  }

  /**
   * Calculate predicted energy
   *
   * @param {Array} params - [entityRef]
   * @param {Object} context - Evaluation context
   * @returns {number} Predicted energy (current + buffered)
   */
  evaluate(params, context) {
    if (!Array.isArray(params) || params.length !== 1) {
      this.#logger.error(
        `predicted_energy requires exactly 1 parameter, got ${params?.length || 0}`
      );
      return 0;
    }

    try {
      const entityId = resolveEntityReference(params[0], context);

      // Get components
      const store = this.#entityManager.getComponent(
        entityId,
        'metabolism:metabolic_store'
      );
      const converter = this.#entityManager.getComponent(
        entityId,
        'metabolism:fuel_converter'
      );

      // Missing components = no metabolic system
      if (!store || !converter) {
        this.#logger.debug(
          `Entity ${entityId} missing metabolism components, returning 0`
        );
        return 0;
      }

      // Calculate buffered energy (what will be digested)
      const bufferedEnergy = converter.buffer_storage * converter.efficiency;

      // Total predicted energy
      const predicted = store.current_energy + bufferedEnergy;

      this.#logger.debug(
        `Entity ${entityId} predicted energy: ` +
        `current=${store.current_energy}, ` +
        `buffered=${bufferedEnergy.toFixed(1)}, ` +
        `predicted=${predicted.toFixed(1)}`
      );

      return predicted;
    } catch (err) {
      this.#logger.error(`Error evaluating predicted_energy operator:`, err);
      return 0;
    }
  }
}
```

### canConsumeOperator.js
```javascript
/**
 * @file JSON Logic operator that validates consumption safety
 * Checks: fuel tags match AND buffer has capacity
 */

import { resolveEntityReference } from '../utils/entityReferenceResolver.js';
import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Custom operator: can_consume
 * Returns true if consumer can safely eat the item
 *
 * @example
 * { "can_consume": ["actor", "bread"] }
 * { "can_consume": ["self", "{event.payload.itemId}"] }
 */
export class CanConsumeOperator {
  #entityManager;
  #logger;
  #operatorName = 'can_consume';

  constructor({ entityManager, logger }) {
    assertPresent(entityManager, 'entityManager is required');
    assertPresent(logger, 'logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  get name() {
    return this.#operatorName;
  }

  /**
   * Validate consumption
   *
   * @param {Array} params - [consumerRef, itemRef]
   * @param {Object} context - Evaluation context
   * @returns {boolean} True if can safely consume
   */
  evaluate(params, context) {
    if (!Array.isArray(params) || params.length !== 2) {
      this.#logger.error(
        `can_consume requires exactly 2 parameters, got ${params?.length || 0}`
      );
      return false;
    }

    try {
      const consumerId = resolveEntityReference(params[0], context);
      const itemId = resolveEntityReference(params[1], context);

      // Get components
      const converter = this.#entityManager.getComponent(
        consumerId,
        'metabolism:fuel_converter'
      );
      const fuelSource = this.#entityManager.getComponent(
        itemId,
        'metabolism:fuel_source'
      );

      // Missing components = cannot consume
      if (!converter || !fuelSource) {
        this.#logger.debug(
          `Missing components: consumer=${!!converter}, item=${!!fuelSource}`
        );
        return false;
      }

      // Check fuel tag compatibility
      const hasMatchingTag = fuelSource.fuel_tags.some(tag =>
        converter.accepted_fuel_tags.includes(tag)
      );

      if (!hasMatchingTag) {
        this.#logger.debug(
          `Fuel tags incompatible: ` +
          `item=${fuelSource.fuel_tags.join(',')}, ` +
          `accepts=${converter.accepted_fuel_tags.join(',')}`
        );
        return false;
      }

      // Check buffer capacity
      const availableSpace = converter.capacity - converter.buffer_storage;
      const hasRoom = fuelSource.bulk <= availableSpace;

      if (!hasRoom) {
        this.#logger.debug(
          `Insufficient buffer capacity: ` +
          `need=${fuelSource.bulk}, ` +
          `available=${availableSpace}`
        );
        return false;
      }

      // All checks passed
      this.#logger.debug(
        `Can consume: consumer=${consumerId}, item=${itemId}`
      );
      return true;

    } catch (err) {
      this.#logger.error(`Error evaluating can_consume operator:`, err);
      return false;
    }
  }
}
```

### Test Files
See implementation section for complete test suites (omitted here for brevity - follow pattern from HUNMETSYS-011).

## Out of Scope

**Not Included:**
- ❌ GOAP planner modifications (should work with existing)
- ❌ Consumption action implementation (handled in HUNMETSYS-005)
- ❌ Buffer optimization strategies
- ❌ Multi-converter support (future: stomach + secondary organs)

## Acceptance Criteria

**Must Have:**
- ✅ PredictedEnergyOperator implemented
- ✅ Returns current_energy + (buffer_storage × efficiency)
- ✅ Returns 0 for missing components
- ✅ CanConsumeOperator implemented
- ✅ Validates fuel tag compatibility
- ✅ Validates buffer capacity
- ✅ Returns false for any validation failure
- ✅ Both operators registered in jsonLogicCustomOperators
- ✅ All unit tests pass with 90%+ coverage
- ✅ Error handling for invalid params
- ✅ Handles entity reference resolution

**Nice to Have:**
- Consider: Predicted energy with burn rate projection
- Consider: Time-to-digest estimation

## References

- **Spec:** Section "GOAP Integration" (p. 21-23)
- **Spec:** Section "Digestion Buffer Mechanics" (p. 23-24)
- **Previous:** HUNMETSYS-001, 002 (Components)
- **Next:** HUNMETSYS-013 (GOAP goals)