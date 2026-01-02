# DAMSIMANAICO-002: Refactor HierarchicalAnatomyRenderer to Use Shared Module

## Summary

Refactor HierarchicalAnatomyRenderer to import and use the shared `statusEffectUtils.js` module instead of local definitions. Remove duplicated code while maintaining backward compatibility.

## Prerequisites

- DAMSIMANAICO-001 must be completed (statusEffectUtils.js exists)

## Files to Touch

- `src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js` (MODIFY)

## Out of Scope

- DO NOT modify `statusEffectUtils.js`
- DO NOT modify `DamageAnalyticsPanel.js`
- DO NOT modify any CSS files
- DO NOT add new tests (existing tests must continue to pass)

## Implementation Details

### Changes to HierarchicalAnatomyRenderer.js

1. **Add Import Statement** (near top of file):

```javascript
import {
  EFFECT_COMPONENTS,
  EFFECT_EMOJIS,
  EFFECT_CSS_CLASSES,
  capitalize,
  getActiveEffects,
  formatEffectTooltip,
} from './statusEffectUtils.js';
```

2. **Remove Local Constants** (approximately lines 62-78):
   - Delete the local `EFFECT_COMPONENTS` constant
   - Delete the local `EFFECT_EMOJIS` constant

3. **Remove Local Methods**:
   - Delete `#capitalize(str)` method (approximately line 686-688)
   - Delete `#getActiveEffects(components)` method (approximately lines 642-657)
   - Delete `#formatEffectTooltip(effectType, effectData)` method (approximately lines 697-726)

4. **Update CSS_CLASSES Constant**:
   - Remove these properties from local `CSS_CLASSES`:
     - `effect`
     - `effectBleeding`
     - `effectBurning`
     - `effectPoisoned`
     - `effectFractured`
     - `partEffects`

5. **Update #renderEffectsSection Method** (approximately lines 665-678):

```javascript
#renderEffectsSection(effects) {
  const section = document.createElement('div');
  section.className = EFFECT_CSS_CLASSES.container;

  for (const effect of effects) {
    const effectBadge = document.createElement('span');
    effectBadge.className = `${EFFECT_CSS_CLASSES.base} ${EFFECT_CSS_CLASSES[effect.type] || ''}`;
    effectBadge.textContent = EFFECT_EMOJIS[effect.type];
    effectBadge.setAttribute('title', formatEffectTooltip(effect.type, effect.data));
    section.appendChild(effectBadge);
  }

  return section;
}
```

6. **Update Internal Callers**:
   - Replace `this.#getActiveEffects(...)` with `getActiveEffects(...)`
   - Replace `this.#formatEffectTooltip(...)` with `formatEffectTooltip(...)`
   - Replace `this.#capitalize(...)` with `capitalize(...)`

7. **Maintain Static Exports** for backward compatibility:

```javascript
static EFFECT_COMPONENTS = EFFECT_COMPONENTS;
static EFFECT_EMOJIS = EFFECT_EMOJIS;
```

## Acceptance Criteria

### Tests That Must Pass

Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js`

All existing tests must pass without modification:
- Constructor validation tests
- render() tests
- updatePart() tests
- Status Effects Display tests
- Effects rendering tests

### Invariants

- `HierarchicalAnatomyRenderer.EFFECT_COMPONENTS` must still be accessible
- `HierarchicalAnatomyRenderer.EFFECT_EMOJIS` must still be accessible
- All effect emojis must render the same as before
- All effect tooltips must display the same content as before
- All effect CSS classes must be applied the same as before
- No change to the public API of HierarchicalAnatomyRenderer

## Verification Commands

```bash
# Must all pass:
npm run test:unit -- tests/unit/domUI/damage-simulator/HierarchicalAnatomyRenderer.test.js
npx eslint src/domUI/damage-simulator/HierarchicalAnatomyRenderer.js
npm run typecheck
```

## Definition of Done

1. Import statement added for shared module
2. Local constants and methods removed
3. Internal callers updated to use imported functions
4. Static exports maintained for backward compatibility
5. All existing tests pass without modification
6. Linting passes
7. Type checking passes
