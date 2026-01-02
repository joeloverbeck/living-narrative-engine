# DAMSIMANAICO-001: Create Status Effect Utils Shared Module

## Summary

Create a new shared module `statusEffectUtils.js` containing constants and utility functions for status effect rendering. This module will mirror the current behavior in `HierarchicalAnatomyRenderer` and is intended for future reuse by that renderer and any other UI components.

## Status

Completed

## Files to Touch

- `src/domUI/damage-simulator/statusEffectUtils.js` (CREATE)
- `tests/unit/domUI/damage-simulator/statusEffectUtils.test.js` (CREATE)

## Out of Scope

- DO NOT modify `HierarchicalAnatomyRenderer.js` (handled in DAMSIMANAICO-002)
- DO NOT modify `DamageAnalyticsPanel.js` (note: it currently renders effect thresholds, not per-part effect icons)
- DO NOT modify any CSS files
- DO NOT modify any existing test files

## Implementation Details

### statusEffectUtils.js

Create at `src/domUI/damage-simulator/statusEffectUtils.js`:

```javascript
/**
 * @file statusEffectUtils.js
 * @description Shared utilities for status effect rendering across damage simulator components
 */

// Export these constants:
export const EFFECT_COMPONENTS = Object.freeze({
  bleeding: 'anatomy:bleeding',
  burning: 'anatomy:burning',
  poisoned: 'anatomy:poisoned',
  fractured: 'anatomy:fractured',
});

export const EFFECT_EMOJIS = Object.freeze({
  bleeding: '🩸',
  burning: '🔥',
  poisoned: '☠️',
  fractured: '🦴',
});

export const EFFECT_CSS_CLASSES = Object.freeze({
  container: 'ds-part-effects',
  base: 'ds-effect',
  bleeding: 'ds-effect-bleeding',
  burning: 'ds-effect-burning',
  poisoned: 'ds-effect-poisoned',
  fractured: 'ds-effect-fractured',
});

// Export these functions:
export function capitalize(str) { ... }
export function getActiveEffects(components) { ... }
export function formatEffectTooltip(effectType, effectData) { ... }
export function generateEffectIconsHTML(effects, escapeHtml) { ... }
```

### Function Specifications

1. **capitalize(str)**: Capitalizes first letter. Returns '' for empty string. (Callers provide valid strings; no null/undefined handling required.)
2. **getActiveEffects(components)**: Returns array of `{type, data}` for effects found in components map.
3. **formatEffectTooltip(effectType, effectData)**: Returns tooltip string per effect type.
4. **generateEffectIconsHTML(effects, escapeHtml)**: Returns HTML string with effect icons or empty string. Matches the same tooltip and class composition as `HierarchicalAnatomyRenderer`.

## Acceptance Criteria

### Tests That Must Pass

Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/statusEffectUtils.test.js`

Required test cases:

1. **Constants Tests**
   - `EFFECT_COMPONENTS` has all 4 effects mapped correctly
   - `EFFECT_EMOJIS` has all 4 emojis
   - `EFFECT_CSS_CLASSES` has container, base, and 4 effect classes
   - All constants are frozen

2. **capitalize Tests**
   - Capitalizes 'bleeding' → 'Bleeding'
   - Returns '' for empty string
   - Handles single character 'a' → 'A'

3. **getActiveEffects Tests**
   - Returns [] for null/undefined/non-object
   - Returns [] for components with no effects
   - Extracts single effect correctly
   - Extracts multiple effects correctly
   - Ignores non-effect components

4. **formatEffectTooltip Tests**
   - Bleeding: formats with severity and turns, or severity only (default severity is "unknown")
   - Burning: formats with turns and stacks, omits stacks when 1 (matches `HierarchicalAnatomyRenderer`)
   - Poisoned: formats with turns, or just name
   - Fractured: always just "Fractured"

5. **generateEffectIconsHTML Tests**
   - Returns '' for null/empty effects
   - Generates correct HTML for single effect
   - Generates correct HTML for multiple effects
   - Includes proper CSS classes
   - Includes tooltip title attribute
   - Escapes HTML in tooltips

### Invariants

- Constants must be immutable (Object.freeze)
- Functions must be pure (no side effects)
- All exports must use named exports (no default export)
- Must not import from any other project file (standalone module)

## Definition of Done

1. `statusEffectUtils.js` created with all exports
2. `statusEffectUtils.test.js` created with 100% branch coverage
3. All tests pass: `npm run test:unit -- tests/unit/domUI/damage-simulator/statusEffectUtils.test.js`
4. Linting passes: `npx eslint src/domUI/damage-simulator/statusEffectUtils.js`
5. Type checking passes: `npm run typecheck`

## Outcome

- Added `src/domUI/damage-simulator/statusEffectUtils.js` with status effect constants and helper functions mirroring `HierarchicalAnatomyRenderer`.
- Added `tests/unit/domUI/damage-simulator/statusEffectUtils.test.js` to cover constants, formatting, and HTML output, including fallback branches.
- No consumer wiring changes were made yet; the module is ready for future integration work.
