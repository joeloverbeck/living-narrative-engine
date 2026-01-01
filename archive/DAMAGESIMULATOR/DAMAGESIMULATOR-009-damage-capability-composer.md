# DAMAGESIMULATOR-009: Create DamageCapabilityComposer

## Summary
Create the `DamageCapabilityComposer` component that provides a UI for composing damage capability entries. This includes damage type selection, amount configuration, penetration slider, and effect toggles with their sub-configurations.

## Dependencies
- DAMAGESIMULATOR-006 must be completed (DamageSimulatorUI for integration)

## Files to Touch

### Create
- `src/domUI/damage-simulator/DamageCapabilityComposer.js` - Composer component
- `tests/unit/domUI/damage-simulator/DamageCapabilityComposer.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageSimulatorUI.js` - Integrate composer
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Register composer
- `css/damage-simulator.css` - Add form control styles (if needed)

### Reference (Read Only)
- `data/schemas/damage-capability-entry.schema.json` - Schema to validate against

## Out of Scope
- DO NOT implement weapon preset loading (separate ticket)
- DO NOT implement damage execution (separate ticket)
- DO NOT implement export/import functionality
- DO NOT modify any schema files

## Acceptance Criteria

### UI Requirements
1. Damage type dropdown (slashing, piercing, blunt, fire, cold, lightning, etc.)
2. Amount input with slider (range: 0-100)
3. Penetration slider (range: 0-1, step 0.1)
4. Effect toggles with expandable configuration:
   - Bleed: severity dropdown, duration input
   - Fracture: threshold percentage, stun chance
   - Burn: DPS, duration, stack toggle
   - Poison: tick damage, duration, scope
   - Dismember: threshold percentage
5. Damage multiplier input
6. Custom flags input (comma-separated)
7. Real-time validation against schema

### Validation Requirements
1. Show validation errors inline
2. Prevent invalid configurations from being applied
3. Use AJV for schema validation
4. Highlight invalid fields

### Tests That Must Pass
1. **Unit: DamageCapabilityComposer.test.js**
   - `should render all form controls`
   - `should emit change event on any input change`
   - `should validate against damage-capability-entry schema`
   - `should show validation errors for invalid config`
   - `should expand effect configuration when effect enabled`
   - `should collapse effect configuration when effect disabled`
   - `should provide valid damage entry on getDamageEntry()`
   - `should handle edge cases (0 damage, 0 penetration)`
   - `should parse custom flags from comma-separated input`
   - `should apply damage multiplier correctly`
   - `should reset to defaults on reset()`

2. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Output always matches damage-capability-entry schema
2. No direct calls to damage handlers (just configuration)
3. Event-based communication with parent
4. Form state persists until explicitly reset

## Implementation Notes

### DamageCapabilityComposer Interface
```javascript
class DamageCapabilityComposer {
  constructor({
    containerElement,
    schemaValidator,
    eventBus,
    logger
  })

  /**
   * Initialize the form controls
   */
  initialize()

  /**
   * Get the current damage entry configuration
   * @returns {Object} Validated damage entry
   * @throws {ValidationError} If configuration is invalid
   */
  getDamageEntry()

  /**
   * Get the damage multiplier
   * @returns {number}
   */
  getDamageMultiplier()

  /**
   * Set configuration (for presets)
   * @param {Object} config
   */
  setConfiguration(config)

  /**
   * Reset to default values
   */
  reset()

  /**
   * Check if current configuration is valid
   * @returns {boolean}
   */
  isValid()

  /**
   * Get validation errors
   * @returns {Array<string>}
   */
  getValidationErrors()
}
```

### Form Structure
```html
<div class="ds-damage-composer">
  <!-- Damage Type -->
  <div class="ds-form-group">
    <label for="damage-type">Damage Type</label>
    <select id="damage-type">
      <option value="slashing">Slashing</option>
      <option value="piercing">Piercing</option>
      <option value="blunt">Blunt</option>
      <option value="fire">Fire</option>
      <option value="cold">Cold</option>
      <option value="lightning">Lightning</option>
    </select>
  </div>

  <!-- Amount -->
  <div class="ds-form-group">
    <label for="damage-amount">Amount</label>
    <input type="range" id="damage-amount-slider" min="0" max="100" value="10">
    <input type="number" id="damage-amount" min="0" value="10">
  </div>

  <!-- Penetration -->
  <div class="ds-form-group">
    <label for="penetration">Penetration</label>
    <input type="range" id="penetration-slider" min="0" max="1" step="0.1" value="0.3">
    <span id="penetration-value">0.3</span>
  </div>

  <!-- Effects -->
  <fieldset class="ds-effects-fieldset">
    <legend>Effects</legend>

    <!-- Bleed -->
    <div class="ds-effect-toggle">
      <label>
        <input type="checkbox" id="effect-bleed"> Bleed
      </label>
      <div class="ds-effect-config" data-for="bleed">
        <label>Severity: <select id="bleed-severity">
          <option value="minor">Minor</option>
          <option value="moderate">Moderate</option>
          <option value="severe">Severe</option>
        </select></label>
        <label>Duration: <input type="number" id="bleed-duration" value="2" min="1"></label>
      </div>
    </div>

    <!-- Similar for fracture, burn, poison, dismember -->
  </fieldset>

  <!-- Multiplier -->
  <div class="ds-form-group">
    <label for="damage-multiplier">Damage Multiplier</label>
    <input type="number" id="damage-multiplier" value="1" min="0" step="0.1">
  </div>

  <!-- Flags -->
  <div class="ds-form-group">
    <label for="custom-flags">Custom Flags (comma-separated)</label>
    <input type="text" id="custom-flags" placeholder="magical, silver">
  </div>

  <!-- Validation -->
  <div id="validation-errors" class="ds-validation-errors"></div>
</div>
```

### Event Types
```javascript
const COMPOSER_EVENTS = {
  CONFIG_CHANGED: 'damage-composer:config-changed',
  VALIDATION_ERROR: 'damage-composer:validation-error',
  VALIDATION_SUCCESS: 'damage-composer:validation-success'
};
```

### Default Configuration
```javascript
// UPDATED: Values corrected to match data/schemas/damage-capability-entry.schema.json defaults
const DEFAULT_CONFIG = {
  name: 'slashing',
  amount: 10,
  penetration: 0.3,
  bleed: { enabled: false, severity: 'minor', baseDurationTurns: 2 },
  fracture: { enabled: false, thresholdFraction: 0.5, stunChance: 0.2 },
  burn: { enabled: false, dps: 1, durationTurns: 2, canStack: false },
  poison: { enabled: false, tickDamage: 1, durationTurns: 3, scope: 'part' },
  dismember: { enabled: false, thresholdFraction: 0.8 }
};
```

## Definition of Done
- [x] DamageCapabilityComposer created with full JSDoc
- [x] Unit tests with ≥90% coverage
- [x] Composer registered in DI container
- [x] Integrated with DamageSimulatorUI (via factory pattern for runtime container injection)
- [x] All form controls render and function
- [x] Effect toggles expand/collapse configuration
- [x] Schema validation works with error display
- [x] Change events emitted properly
- [x] CSS styles complete for form controls
- [x] ESLint passes: `npx eslint src/domUI/damage-simulator/DamageCapabilityComposer.js`

## Outcome

**Status**: ✅ COMPLETED (2025-12-31)

### Files Created
- `src/domUI/damage-simulator/DamageCapabilityComposer.js` (~870 lines)
- `tests/unit/domUI/damage-simulator/DamageCapabilityComposer.test.js` (36 tests)

### Files Modified
- `src/dependencyInjection/tokens/tokens-ui.js` - Added `DamageCapabilityComposer` token
- `src/dependencyInjection/registrations/damageSimulatorRegistrations.js` - Added DI factory registration
- `css/damage-simulator.css` - Added effect toggle and validation error styles

### Key Implementation Details

1. **Corrected Default Values**: The original ticket had incorrect default values that didn't match the schema. These were corrected:
   - `bleed.baseDurationTurns`: 3 → 2
   - `fracture.stunChance`: 0.15 → 0.2
   - `burn.durationTurns`: 3 → 2
   - `dismember.thresholdFraction`: 0.7 → 0.8

2. **Factory Pattern for DI**: Uses singletonFactory lifecycle with runtime containerElement injection

3. **Dynamic Effect Configuration**: Effect checkboxes are created dynamically during `initialize()`, with expandable configuration sections that toggle visibility

4. **Schema Validation**: Uses `ISchemaValidator` token (AJV-based) to validate against `damage-capability-entry.schema.json`

5. **Event-Based Communication**: Emits `CONFIG_CHANGED`, `VALIDATION_ERROR`, and `VALIDATION_SUCCESS` events via `ISafeEventDispatcher`

6. **Penetration Handling**: When penetration is 0, it's omitted from the output (optional field in schema)

### Test Coverage
- 36 unit tests covering:
  - Constructor validation
  - Form control rendering
  - Event emission
  - Schema validation
  - Effect toggle expand/collapse
  - Edge cases (0 damage, 0 penetration)
  - Custom flags parsing
  - Damage multiplier
  - Reset functionality
  - setConfiguration with partial configs

### Verification
```bash
npx eslint src/domUI/damage-simulator/DamageCapabilityComposer.js  # ✅ No errors
npx jest tests/unit/domUI/damage-simulator/DamageCapabilityComposer.test.js  # ✅ 36/36 passed
```
