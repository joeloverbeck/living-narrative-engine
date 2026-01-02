# DAMSIMANAICO-005: Add Unit Tests for Status Column

## Status

Completed.

## Summary

Add missing unit tests for Status column rendering in DamageAnalyticsPanel. The status column and several tests already exist (header, dash when empty, bleeding icon/XSS handling, and components passthrough), so this ticket focuses only on the remaining effect icons and column ordering.

## Prerequisites

- Status column implementation and baseline tests already present in `DamageAnalyticsPanel.test.js`.

## Files to Touch

- `tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js` (MODIFY)

## Out of Scope

- DO NOT modify any source files
- DO NOT modify `statusEffectUtils.test.js`
- DO NOT add integration tests (unit tests only)

## Implementation Details

### Add Tests in DamageAnalyticsPanel.test.js

Add the following tests near the existing Status column assertions in the `render` describe block:

```javascript
describe('render', () => {
  it('should display burning effect icon', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Torso',
          currentHealth: 80,
          maxHealth: 100,
          components: {
            'anatomy:burning': { remainingTurns: 2, stackedCount: 3 },
          },
        },
      ],
    };

    damageAnalyticsPanel.setEntity('entity-1', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🔥');
    expect(html).toContain('ds-effect-burning');
  });

  it('should display poisoned effect icon', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Arm',
          currentHealth: 60,
          maxHealth: 100,
          components: {
            'anatomy:poisoned': { remainingTurns: 5 },
          },
        },
      ],
    };

    damageAnalyticsPanel.setEntity('entity-1', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('☠️');
    expect(html).toContain('ds-effect-poisoned');
  });

  it('should display fractured effect icon', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Leg',
          currentHealth: 40,
          maxHealth: 100,
          components: {
            'anatomy:fractured': { sourceDamageType: 'blunt' },
          },
        },
      ],
    };

    damageAnalyticsPanel.setEntity('entity-1', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🦴');
    expect(html).toContain('ds-effect-fractured');
  });

  it('should display multiple effects on the same part', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Torso',
          currentHealth: 50,
          maxHealth: 100,
          components: {
            'anatomy:bleeding': { severity: 'minor' },
            'anatomy:burning': { remainingTurns: 1 },
            'anatomy:poisoned': { remainingTurns: 4 },
            'anatomy:fractured': {},
          },
        },
      ],
    };

    damageAnalyticsPanel.setEntity('entity-1', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🩸');
    expect(html).toContain('🔥');
    expect(html).toContain('☠️');
    expect(html).toContain('🦴');
  });

  it('should maintain correct column order', () => {
    const anatomyData = {
      parts: [{ id: 'part-1', name: 'Head', currentHealth: 100, maxHealth: 100, components: {} }],
    };

    damageAnalyticsPanel.setEntity('entity-1', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    const headerMatch = html.match(/<thead>[\s\S]*?<\/thead>/);
    expect(headerMatch).not.toBeNull();

    const headers = headerMatch[0];
    const partIndex = headers.indexOf('Part');
    const healthIndex = headers.indexOf('Health');
    const statusIndex = headers.indexOf('Status');
    const effDamageIndex = headers.indexOf('Eff. Damage');
    const hitsIndex = headers.indexOf('Hits');

    expect(partIndex).toBeLessThan(healthIndex);
    expect(healthIndex).toBeLessThan(statusIndex);
    expect(statusIndex).toBeLessThan(effDamageIndex);
    expect(effDamageIndex).toBeLessThan(hitsIndex);
  });
});
```

## Test Case Coverage

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Burning | anatomy:burning present | 🔥 icon and burning CSS class |
| Poisoned | anatomy:poisoned present | ☠️ icon and poisoned CSS class |
| Fractured | anatomy:fractured present | 🦴 icon and fractured CSS class |
| Multiple effects | all 4 effects present | all 4 icons displayed |
| Column order | any data | Part < Health < Status < Eff. Damage < Hits |

## Acceptance Criteria

### Tests That Must Pass

Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js`

All new tests must pass:
1. should display burning effect icon
2. should display poisoned effect icon
3. should display fractured effect icon
4. should display multiple effects on the same part
5. should maintain correct column order

### Invariants

- All pre-existing tests must continue to pass
- No modifications to test setup (beforeEach/afterEach)
- Test suite must follow existing patterns in file

## Verification Commands

```bash
npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js
```

## Definition of Done

1. All listed test cases added to test file
2. All new tests pass
3. All pre-existing tests still pass
4. Test coverage maintained or improved

## Outcome

Added missing status effect coverage in DamageAnalyticsPanel unit tests (burning/poisoned/fractured, multiple effects, column order). No source changes were required; the scope was narrowed from adding 10 tests to filling the remaining gaps.
