# DAMAGESIMULATOR-011: Create DamageExecutionService

## Summary
Create the `DamageExecutionService` that bridges the UI damage configuration to the real `APPLY_DAMAGE` operation handler. This service handles constructing proper operation parameters, executing damage, and capturing results for display.

## Dependencies
- DAMAGESIMULATOR-009 must be completed (DamageCapabilityComposer for configuration)
- DAMAGESIMULATOR-007 must be completed (HierarchicalAnatomyRenderer for refresh)

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageExecutionService.js` - Execution service
- `tests/unit/domUI/damage-simulator/DamageExecutionService.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Add "Apply Damage" button handling
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register service
- `damage-simulator.html` - Add Apply Damage button (if not present)

### Reference (Read Only)
- `src/logic/operationHandlers/applyDamageHandler.js` - Handler interface

## Out of Scope
- DO NOT modify applyDamageHandler.js
- DO NOT modify any damage resolution services
- DO NOT implement damage history (separate ticket)
- DO NOT implement analytics updates (separate ticket)

## Acceptance Criteria

### Execution Requirements
1. Construct valid APPLY_DAMAGE operation parameters
2. Support random weighted targeting OR specific part targeting
3. Execute via real applyDamageHandler
4. Capture damage results from events
5. Trigger anatomy display refresh after execution
6. Handle execution errors gracefully

### UI Requirements
1. "Apply Damage" button in damage composer section
2. Target mode selector (Random / Specific Part)
3. Part dropdown for specific targeting (populated from loaded entity)
4. Loading state during execution
5. Error display on failure

### Tests That Must Pass
1. **Unit: DamageExecutionService.test.js**
   - `should construct valid operation parameters`
   - `should include entity_ref from current entity`
   - `should include damage_entry from composer`
   - `should include damage_multiplier when specified`
   - `should omit part_ref for random targeting`
   - `should include part_ref for specific targeting`
   - `should execute via applyDamageHandler`
   - `should capture damage_applied events`
   - `should emit execution complete event`
   - `should handle handler errors gracefully`
   - `should return damage results array`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Operation parameters match APPLY_DAMAGE schema
2. Real handler executed (not mocked in integration)
3. Event subscription properly cleaned up after execution
4. No side effects beyond damage application

## Implementation Notes

### DamageExecutionService Interface
```javascript
class DamageExecutionService {
  constructor({
    operationInterpreter, // Or direct applyDamageHandler
    entityManager,
    eventBus,
    logger
  })

  /**
   * Apply damage to an entity
   * @param {Object} options
   * @param {string} options.entityId - Target entity instance ID
   * @param {Object} options.damageEntry - From DamageCapabilityComposer
   * @param {number} [options.multiplier=1] - Damage multiplier
   * @param {string|null} [options.targetPartId=null] - Specific part or null for random
   * @returns {Promise<DamageResult>}
   */
  async applyDamage(options)

  /**
   * Get list of targetable parts for an entity
   * @param {string} entityId
   * @returns {Array<{id: string, name: string, weight: number}>}
   */
  getTargetableParts(entityId)
}
```

### DamageResult Structure
```javascript
/**
 * @typedef {Object} DamageResult
 * @property {boolean} success
 * @property {string} targetPartId - Which part was hit
 * @property {string} targetPartName
 * @property {number} damageDealt
 * @property {Object} healthBefore
 * @property {Object} healthAfter
 * @property {Array<string>} effectsTriggered
 * @property {string|null} error
 */
```

### Operation Parameters Construction
```javascript
function buildOperationParams(options) {
  const params = {
    type: 'APPLY_DAMAGE',
    entity_ref: options.entityId,
    damage_entry: options.damageEntry,
    damage_multiplier: options.multiplier || 1
  };

  if (options.targetPartId) {
    params.part_ref = options.targetPartId;
  }

  return params;
}
```

### Event Capture Pattern
```javascript
async applyDamage(options) {
  const results = [];

  // Subscribe to damage events
  const unsubscribe = this.eventBus.subscribe(
    'anatomy:damage_applied',
    (event) => results.push(this.extractResult(event.payload))
  );

  try {
    const context = this.createExecutionContext(options.entityId);
    const params = this.buildOperationParams(options);

    await this.operationInterpreter.execute(params, context);

    return {
      success: true,
      results
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      results
    };
  } finally {
    unsubscribe();
  }
}
```

### Target Mode UI
```html
<div class="ds-target-mode">
  <fieldset>
    <legend>Target Mode</legend>
    <label>
      <input type="radio" name="target-mode" value="random" checked>
      Random (weighted)
    </label>
    <label>
      <input type="radio" name="target-mode" value="specific">
      Specific Part:
      <select id="target-part" disabled>
        <option value="">Select part...</option>
      </select>
    </label>
  </fieldset>
</div>

<button id="apply-damage-btn" class="ds-btn-primary">
  Apply Damage
</button>
```

### Event Types
```javascript
const EXECUTION_EVENTS = {
  EXECUTION_STARTED: 'damage-simulator:execution-started',
  EXECUTION_COMPLETE: 'damage-simulator:execution-complete',
  EXECUTION_ERROR: 'damage-simulator:execution-error'
};
```

## Definition of Done
- [ ] DamageExecutionService created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Service registered in DI container
- [ ] "Apply Damage" button wired up in UI
- [ ] Target mode selector functional
- [ ] Part dropdown populated for specific targeting
- [ ] Damage executes via real handler
- [ ] Results captured from events
- [ ] Anatomy display refreshes after damage
- [ ] Errors displayed appropriately
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageExecutionService.js`
