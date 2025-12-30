# DAMAGESIMULATOR-010: Create WeaponPresetLoader

## Summary
Create the `WeaponPresetLoader` component that loads damage capability presets from existing weapon entities in the mod system. This allows users to quickly configure realistic weapon damage profiles.

## Dependencies
- DAMAGESIMULATOR-009 must be completed (DamageCapabilityComposer for integration)

## Files to Touch

### Create
- `src/domUI/damage-simulator/WeaponPresetLoader.js` - Preset loader
- `tests/unit/domUI/damage-simulator/WeaponPresetLoader.test.js` - Unit tests

### Modify
- `src/domUI/damage-simulator/DamageCapabilityComposer.js` - Add preset selector integration
- `css/damage-simulator.css` - Add preset dropdown styles (if needed)

### Reference (Read Only)
- `data/mods/anatomy/entities/definitions/threadscar_melissa_longsword.entity.json`
- `data/mods/anatomy/entities/definitions/vespera_rapier.entity.json`
- `data/mods/anatomy/entities/definitions/vespera_main_gauche.entity.json`
- `data/mods/anatomy/entities/definitions/rill_practice_stick.entity.json`

## Out of Scope
- DO NOT modify weapon entity definitions
- DO NOT add new weapon entities
- DO NOT modify the damage capability schema
- DO NOT implement custom preset saving

## Acceptance Criteria

### Loader Requirements
1. Scan registry for entities with `damage-types:damage_capabilities` component
2. Populate dropdown with available weapon presets
3. Load first damage entry from selected weapon
4. Apply preset to DamageCapabilityComposer
5. Handle weapons with multiple damage entries (show first)

### UI Requirements
1. Preset dropdown above manual configuration
2. "Load Preset" button (or auto-load on selection)
3. Show weapon name and primary damage type in dropdown
4. Clear indication that manual edits override preset

### Tests That Must Pass
1. **Unit: WeaponPresetLoader.test.js**
   - `should scan registry for entities with damage_capabilities`
   - `should populate dropdown with available weapons`
   - `should format dropdown options with name and damage type`
   - `should return damage entry for selected weapon`
   - `should handle weapons with multiple damage entries`
   - `should handle missing damage_capabilities gracefully`
   - `should emit event on preset loaded`
   - `should handle empty registry gracefully`

2. **Integration with DamageCapabilityComposer**
   - `should apply preset to composer form`
   - `should update form controls with preset values`

3. **Existing Tests Must Continue to Pass**
   - `npm run test:ci` passes

### Invariants
1. Read-only access to entity definitions
2. No modifications to weapon entities
3. Preset data matches damage-capability-entry schema
4. Graceful handling of malformed weapon data

## Implementation Notes

### WeaponPresetLoader Interface
```javascript
class WeaponPresetLoader {
  constructor({ dataRegistry, eventBus, logger })

  /**
   * Get all available weapon presets
   * @returns {Array<{id: string, name: string, damageType: string}>}
   */
  getAvailablePresets()

  /**
   * Load damage entry from a weapon preset
   * @param {string} weaponDefId
   * @returns {Object} Damage capability entry
   */
  loadPreset(weaponDefId)

  /**
   * Populate a select element with presets
   * @param {HTMLSelectElement} selectElement
   */
  populateSelector(selectElement)
}
```

### Preset Detection
```javascript
function hasWeaponCapabilities(definition) {
  return !!definition.components?.['damage-types:damage_capabilities'];
}

function extractDamageEntries(definition) {
  const capabilities = definition.components['damage-types:damage_capabilities'];
  return capabilities?.entries || [];
}
```

### Dropdown Format
```javascript
function formatPresetOption(definition) {
  const name = definition.components?.['core:name']?.name || definition.id;
  const entries = extractDamageEntries(definition);
  const primaryType = entries[0]?.name || 'unknown';
  return `${name} (${primaryType})`;
}
```

### Example Weapon Data Extraction
```javascript
// From vespera_rapier.entity.json
{
  "damage-types:damage_capabilities": {
    "entries": [
      { "name": "piercing", "amount": 18, "penetration": 0.6 },
      { "name": "slashing", "amount": 8, "penetration": 0.1 }
    ]
  }
}

// Extracted as:
{
  id: 'vespera_rapier',
  name: 'Vespera Rapier',
  entries: [
    { name: 'piercing', amount: 18, penetration: 0.6 },
    { name: 'slashing', amount: 8, penetration: 0.1 }
  ]
}
```

### Integration with Composer
```javascript
// In DamageCapabilityComposer or DamageSimulatorUI
presetSelector.addEventListener('change', async (e) => {
  const presetId = e.target.value;
  if (presetId) {
    const damageEntry = presetLoader.loadPreset(presetId);
    damageComposer.setConfiguration(damageEntry);
  }
});
```

### Event Types
```javascript
const PRESET_EVENTS = {
  PRESET_LOADED: 'damage-simulator:preset-loaded',
  PRESET_LOAD_ERROR: 'damage-simulator:preset-load-error'
};
```

## Definition of Done
- [ ] WeaponPresetLoader created with full JSDoc
- [ ] Unit tests with ≥90% coverage
- [ ] Preset dropdown added to composer section
- [ ] Presets load and apply to composer correctly
- [ ] Known weapons (rapier, longsword, etc.) appear in dropdown
- [ ] Handle weapons with multiple entries gracefully
- [ ] Events emitted on preset load
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/WeaponPresetLoader.js`
