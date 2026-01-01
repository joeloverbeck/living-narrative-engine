# DAMAGESIMULATOR-008: Anatomy Display Enhancements (Oxygen, Status Effects)

## Summary
Enhance the HierarchicalAnatomyRenderer with oxygen capacity display for respiratory organs and status effect indicators (bleeding, burning, etc.) on affected parts.

## Dependencies
- DAMAGESIMULATOR-007 must be completed (base renderer exists)

## Files to Touch

### Modify
- `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` - Add oxygen and status display
- `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js` - Add new tests
- `css/damage-simulator.css` - Add oxygen bar and effect-specific styles

## Out of Scope
- DO NOT implement status effect application logic (handled by damage handler)
- DO NOT modify damage handler or effects service
- DO NOT implement status effect removal/expiration
- DO NOT implement oxygen consumption logic

## Acceptance Criteria

### Oxygen Display Requirements
1. Show oxygen capacity for parts with `breathing-states:respiratory_organ` component
2. Display as separate bar below health bar
3. Show current/max oxygen values (from `currentOxygen`/`oxygenCapacity` fields)
4. Blue color scheme for oxygen bar
5. Handle missing oxygen data gracefully

### Status Effect Requirements
1. Show active status effects as icons/badges on affected parts
2. Support effects: bleeding, burning, poisoned, fractured
3. Show remaining duration if available (note: `anatomy:fractured` has NO duration field)
4. Update when effects change (via updatePart method, not event subscription - out of scope)

### Tests That Must Pass
1. **Unit: HierarchicalAnatomyRenderer.test.js (additions)**
   - `should display oxygen bar for respiratory parts`
   - `should not show oxygen bar for non-respiratory parts`
   - `should show oxygen percentage correctly`
   - `should display bleeding status effect indicator`
   - `should display burning status effect indicator`
   - `should display poison status effect indicator`
   - `should display fracture status effect indicator`
   - `should show effect duration when available`
   - `should handle multiple simultaneous effects`
   - `should handle missing oxygen data gracefully`

2. **Existing Tests Must Continue to Pass**
   - All previous HierarchicalAnatomyRenderer tests
   - `npm run test:ci` passes

### Invariants
1. Base card rendering unchanged for parts without these features
2. No additional DOM queries on each update
3. Effects update via updatePart method (event subscription out of scope for this ticket)

## Implementation Notes

### Oxygen Bar HTML
```html
<div class="ds-part-oxygen">
  <div class="ds-oxygen-bar">
    <div class="ds-oxygen-fill" style="width: 100%"></div>
  </div>
  <span class="ds-oxygen-text">10/10 O₂</span>
</div>
```

### Status Effects HTML
```html
<div class="ds-part-effects">
  <span class="ds-effect ds-effect-bleeding" title="Bleeding (moderate, 3 turns)">🩸</span>
  <span class="ds-effect ds-effect-burning" title="Burning (2 turns, x3)">🔥</span>
  <span class="ds-effect ds-effect-poisoned" title="Poisoned (5 turns)">☠️</span>
  <span class="ds-effect ds-effect-fractured" title="Fractured">🦴</span>
</div>
```

### Component Detection for Oxygen
```javascript
const RESPIRATORY_COMPONENT = 'breathing-states:respiratory_organ';

function hasOxygenCapacity(components) {
  return !!components[RESPIRATORY_COMPONENT];
}

function getOxygenData(components) {
  const respiratory = components[RESPIRATORY_COMPONENT];
  if (!respiratory) return null;
  return {
    current: respiratory.currentOxygen ?? respiratory.oxygenCapacity,
    max: respiratory.oxygenCapacity
  };
}
```

### Effect Detection
```javascript
const EFFECT_COMPONENTS = Object.freeze({
  bleeding: 'anatomy:bleeding',
  burning: 'anatomy:burning',
  poisoned: 'anatomy:poisoned',
  fractured: 'anatomy:fractured'
});

const EFFECT_EMOJIS = Object.freeze({
  bleeding: '🩸',
  burning: '🔥',
  poisoned: '☠️',
  fractured: '🦴'
});

// Note: Effect component schemas:
// - bleeding: { severity: 'minor'|'moderate'|'severe', remainingTurns: number, tickDamage: number }
// - burning: { remainingTurns: number, tickDamage: number, stackedCount: number }
// - poisoned: { remainingTurns: number, tickDamage: number }
// - fractured: { sourceDamageType: string, appliedAtHealth: number } - NO duration!

function getActiveEffects(components) {
  const effects = [];
  for (const [effectType, componentId] of Object.entries(EFFECT_COMPONENTS)) {
    if (components[componentId]) {
      effects.push({
        type: effectType,
        data: components[componentId]
      });
    }
  }
  return effects;
}
```

### CSS Additions
```css
/* Oxygen bar styles */
.ds-part-oxygen {
  margin-top: 4px;
}

.ds-oxygen-bar {
  height: 8px;
  background: var(--border-color-subtle);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: var(--spacing-xs);
}

.ds-oxygen-fill {
  height: 100%;
  background: var(--oxygen-blue, #4a90d9);
  transition: width 0.3s ease;
}

.ds-oxygen-text {
  font-size: var(--font-size-small);
  color: var(--secondary-text-color);
}

/* Effect-specific styles (base .ds-part-effects exists in damage-simulator.css) */
.ds-part-effects {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.ds-effect {
  font-size: 14px;
  cursor: help;
}

.ds-effect-bleeding { filter: drop-shadow(0 0 2px red); }
.ds-effect-burning { animation: ds-pulse 1s infinite; }
.ds-effect-poisoned { filter: hue-rotate(90deg); }
.ds-effect-fractured { opacity: 0.8; }

@keyframes ds-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

## Definition of Done
- [x] Oxygen bar displays for respiratory parts
- [x] Oxygen values show correctly
- [x] Status effect indicators display for affected parts
- [x] Effect duration shown in tooltip (where applicable - fractured has no duration)
- [x] New tests pass with ≥90% coverage on additions
- [x] CSS styles added for oxygen and effects
- [x] All existing tests still pass
- [x] ESLint passes: `npx eslint src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js`

## Outcome

**Status**: ✅ Completed

**Date Completed**: 2025-12-31

### Implementation Summary

Added oxygen capacity display and status effect indicators to the HierarchicalAnatomyRenderer.

**Files Modified**:
1. `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js`
   - Added static constants: `RESPIRATORY_COMPONENT`, `EFFECT_COMPONENTS`, `EFFECT_EMOJIS`
   - Extended `CSS_CLASSES` with oxygen and effect class names
   - Added private methods for oxygen display: `#getOxygenData()`, `#renderOxygenSection()`, `#calculateOxygenPercentage()`, `#formatOxygenText()`, `#updateOxygenDisplay()`
   - Added private methods for effects display: `#getActiveEffects()`, `#renderEffectsSection()`, `#formatEffectTooltip()`, `#updateEffectsDisplay()`, `#capitalize()`
   - Updated `#renderNode()` to include oxygen and effects sections
   - Updated `updatePart()` to update oxygen and effects displays

2. `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js`
   - Added 25+ new tests covering oxygen display and status effects
   - Tests for static constants (RESPIRATORY_COMPONENT, EFFECT_COMPONENTS, EFFECT_EMOJIS)
   - Oxygen display tests: bar rendering, percentage calculation, edge cases
   - Status effects tests: individual effects, tooltips, multiple effects, updates

3. `css/damage-simulator.css` (modified in earlier session)
   - Oxygen bar styles already present
   - Effect-specific styles already present

### Test Results
- **Total Tests**: 67 passed
- **ESLint**: 0 errors (33 warnings - JSDoc formatting only)

### Notes
- Original ticket correctly specified `breathing-states:respiratory_organ` component
- `anatomy:fractured` correctly has no duration (only `sourceDamageType` and `appliedAtHealth`)
- CSS styles were already added in the earlier session
- Public API unchanged; all new functionality is additive
