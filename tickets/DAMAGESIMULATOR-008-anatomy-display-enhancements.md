# DAMAGESIMULATOR-008: Anatomy Display Enhancements (Oxygen, Status Effects)

## Summary
Enhance the HierarchicalAnatomyRenderer with oxygen capacity display for respiratory organs and status effect indicators (bleeding, burning, etc.) on affected parts.

## Dependencies
- DAMAGESIMULATOR-007 must be completed (base renderer exists)

## Files to Touch

### Modify
- `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` - Add oxygen and status display
- `tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js` - Add new tests
- `css/damage-simulator.css` - Add oxygen bar and status effect styles

## Out of Scope
- DO NOT implement status effect application logic (handled by damage handler)
- DO NOT modify damage handler or effects service
- DO NOT implement status effect removal/expiration
- DO NOT implement oxygen consumption logic

## Acceptance Criteria

### Oxygen Display Requirements
1. Show oxygen capacity for parts with `anatomy:lung` or respiratory components
2. Display as separate bar below health bar
3. Show current/max oxygen values
4. Blue color scheme for oxygen bar
5. Handle missing oxygen data gracefully

### Status Effect Requirements
1. Show active status effects as icons/badges on affected parts
2. Support effects: bleeding, burning, poisoned, fractured
3. Show remaining duration if available
4. Update when effects change (via event subscription)

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
   - `should update effects when events received`
   - `should handle multiple simultaneous effects`

2. **Existing Tests Must Continue to Pass**
   - All previous HierarchicalAnatomyRenderer tests
   - `npm run test:ci` passes

### Invariants
1. Base card rendering unchanged for parts without these features
2. No additional DOM queries on each update
3. Effects update via event subscription, not polling

## Implementation Notes

### Oxygen Bar HTML
```html
<div class="ds-part-oxygen" data-visible="true">
  <div class="ds-oxygen-bar">
    <div class="ds-oxygen-fill" style="width: 100%"></div>
  </div>
  <span class="ds-oxygen-text">10/10 O₂</span>
</div>
```

### Status Effects HTML
```html
<div class="ds-part-effects">
  <span class="ds-effect ds-effect-bleeding" title="Bleeding (3 turns)">🩸</span>
  <span class="ds-effect ds-effect-burning" title="Burning (2 turns)">🔥</span>
  <span class="ds-effect ds-effect-poisoned" title="Poisoned (5 turns)">☠️</span>
  <span class="ds-effect ds-effect-fractured" title="Fractured">🦴</span>
</div>
```

### Component Detection for Oxygen
```javascript
function hasOxygenCapacity(components) {
  return components['anatomy:lung'] ||
         components['anatomy:respiratory'] ||
         components['anatomy:part']?.oxygenCapacity > 0;
}

function getOxygenData(components) {
  const lung = components['anatomy:lung'];
  if (lung) {
    return { current: lung.currentOxygen, max: lung.maxOxygen };
  }
  const part = components['anatomy:part'];
  if (part?.oxygenCapacity) {
    return { current: part.currentOxygen || part.oxygenCapacity, max: part.oxygenCapacity };
  }
  return null;
}
```

### Effect Detection
```javascript
const EFFECT_COMPONENTS = {
  bleeding: 'anatomy:bleeding',
  burning: 'anatomy:burning',
  poisoned: 'anatomy:poisoned',
  fractured: 'anatomy:fractured'
};

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
.ds-part-oxygen {
  margin-top: 4px;
}

.ds-oxygen-bar {
  height: 8px;
  background: var(--bg-dark);
  border-radius: 4px;
  overflow: hidden;
}

.ds-oxygen-fill {
  height: 100%;
  background: var(--oxygen-blue, #4a90d9);
  transition: width 0.3s ease;
}

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
.ds-effect-burning { animation: pulse 1s infinite; }
.ds-effect-poisoned { filter: hue-rotate(90deg); }
.ds-effect-fractured { opacity: 0.8; }
```

## Definition of Done
- [ ] Oxygen bar displays for respiratory parts
- [ ] Oxygen values show correctly
- [ ] Status effect indicators display for affected parts
- [ ] Effect duration shown in tooltip
- [ ] New tests pass with ≥90% coverage on additions
- [ ] CSS styles added for oxygen and effects
- [ ] All existing tests still pass
- [ ] ESLint passes: `npx eslint src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js`
