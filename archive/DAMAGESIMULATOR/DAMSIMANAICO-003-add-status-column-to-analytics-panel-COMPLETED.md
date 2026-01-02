# DAMSIMANAICO-003: Add Status Column to DamageAnalyticsPanel

## Summary

Add a "Status" column to the HITS TO DESTROY table in DamageAnalyticsPanel. The column displays status effect icons (bleeding, burning, poisoned, fractured) using the shared statusEffectUtils module.

## Assumptions Reassessed

- DamageAnalyticsPanel already computes `hitProbability` and renders nullable values as dashes; PartAnalytics JSDoc must reflect nullability and the existing hitProbability field.
- Anatomy parts already carry `components` from both flat and tree formats, but analytics output currently drops them; the Status column needs analytics to include `components`.
- Tests will need targeted updates/additions for the new column; blocking test edits would prevent validation.

## Prerequisites

- DAMSIMANAICO-001 must be completed (statusEffectUtils.js exists)

## Files to Touch

- `src/domUI/damage-simulator/DamageAnalyticsPanel.js` (MODIFY)
- `tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js` (MODIFY)

## Out of Scope

- DO NOT modify `statusEffectUtils.js`
- DO NOT modify `HierarchicalAnatomyRenderer.js`
- DO NOT modify any CSS files (handled in DAMSIMANAICO-004)
- Avoid unrelated test changes; add/adjust tests only to cover the new Status column behavior.

## Implementation Details

### Changes to DamageAnalyticsPanel.js

1. **Add Import Statement** (near top of file):

```javascript
import { getActiveEffects, generateEffectIconsHTML } from './statusEffectUtils.js';
```

2. **Modify #generateHitsTableHTML Method** (approximately lines 387-424):

Update the table header to include Status column between Health and Eff. Damage:

```javascript
<thead>
  <tr>
    <th>Part</th>
    <th>Health</th>
    <th>Status</th>
    <th>Eff. Damage</th>
    <th>Hits</th>
  </tr>
</thead>
```

Update the row generation to include status cell:

```javascript
const rowsHTML = parts.map((part) => {
  const criticalClass = part.isCritical ? 'ds-critical-part' : '';
  const hitsDisplay =
    part.hitsToDestroy === null ? '—' : part.hitsToDestroy === Infinity ? '∞' : part.hitsToDestroy;
  const damageDisplay = part.effectiveDamage === null ? '—' : part.effectiveDamage.toFixed(1);

  // NEW: Generate status effect icons
  const effects = getActiveEffects(part.components);
  const statusHTML = generateEffectIconsHTML(effects, this.#escapeHtml.bind(this));

  return `
    <tr class="${criticalClass}">
      <td>${this.#escapeHtml(part.partName)}</td>
      <td>${part.currentHealth}/${part.maxHealth}</td>
      <td class="ds-status-cell">${statusHTML || '—'}</td>
      <td>${damageDisplay}</td>
      <td>${hitsDisplay}</td>
    </tr>
  `;
}).join('');
```

3. **Update getAnalytics Method** (approximately line 673):

Include `components` in the returned part data:

```javascript
parts.push({
  partId: part.id,
  partName: part.name,
  currentHealth: part.currentHealth,
  maxHealth: part.maxHealth,
  hitsToDestroy,
  effectiveDamage,
  isCritical,
  hitProbability: probabilitiesMap.get(part.id) ?? 0,
  components: part.components || {}, // ADD THIS LINE
});
```

4. **Update PartAnalytics JSDoc Type** (near top of file):

```javascript
/**
 * @typedef {Object} PartAnalytics
 * @property {string} partId
 * @property {string} partName
 * @property {number} currentHealth
 * @property {number} maxHealth
 * @property {number|null} hitsToDestroy
 * @property {number|null} effectiveDamage
 * @property {boolean} isCritical
 * @property {number} hitProbability
 * @property {Object} components - Component map for status effects
 */
```

## Acceptance Criteria

### Tests That Must Pass

Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js`

All existing tests must pass. Some tests may need adjustment or additions if they check specific HTML structure:
- Tests checking for table headers should still pass (new column added)
- Tests checking for specific cell content should still pass (cells preserved)

### Invariants

- Column order must be: Part, Health, Status, Eff. Damage, Hits
- Parts without effects must show "—" in Status column
- Parts without `components` property must show "—" in Status column
- Effect icons must use same emojis as HierarchicalAnatomyRenderer
- XSS must be prevented via escapeHtml in tooltips
- `getAnalytics()` return value must now include `components` field

### Verification Steps

1. Load damage-simulator.html in browser
2. Load an entity with body parts
3. Verify "Status" column appears in HITS TO DESTROY table
4. Verify column shows "—" when no effects
5. Apply damage until an effect is triggered
6. Verify effect icon appears with tooltip

## Verification Commands

```bash
# Must all pass:
npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js
npx eslint src/domUI/damage-simulator/DamageAnalyticsPanel.js
npm run typecheck
```

## Definition of Done

1. Import statement added for shared module
2. Table header updated with Status column
3. Row generation includes status cell with effect icons
4. getAnalytics() returns components in part data
5. JSDoc type updated
6. Status column tests added/updated to cover icons, dashes, and escaping
7. All existing tests pass
8. Linting passes
9. Type checking passes

## Status

Completed

## Outcome

Added the Status column with effect icons and tooltip escaping, updated analytics output to include components, and extended unit tests to validate header/emoji/dash behavior instead of leaving tests untouched.
