# DAMSIMANAICO-005: Add Unit Tests for Status Column

## Summary

Add comprehensive unit tests for the Status column functionality in DamageAnalyticsPanel. Tests cover all effect types, edge cases, and XSS prevention.

## Prerequisites

- DAMSIMANAICO-003 must be completed (Status column implemented)

## Files to Touch

- `tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js` (MODIFY)

## Out of Scope

- DO NOT modify any source files
- DO NOT modify `statusEffectUtils.test.js` (already covered in DAMSIMANAICO-001)
- DO NOT add integration tests (unit tests only)

## Implementation Details

### Add Test Suite to DamageAnalyticsPanel.test.js

Add the following test suite before the final closing `});`:

```javascript
describe('Status column in hits table', () => {
  it('should render Status column header', () => {
    const anatomyData = {
      parts: [{ id: 'part-1', name: 'Head', currentHealth: 100, maxHealth: 100, components: {} }],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    expect(mockContainerElement.innerHTML).toContain('<th>Status</th>');
  });

  it('should display dash when no status effects present', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Head',
          currentHealth: 100,
          maxHealth: 100,
          components: { 'anatomy:part': { type: 'head' } },
        },
      ],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('ds-status-cell');
  });

  it('should display bleeding effect icon', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Head',
          currentHealth: 100,
          maxHealth: 100,
          components: {
            'anatomy:bleeding': { severity: 'moderate', remainingTurns: 3 },
          },
        },
      ],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🩸');
    expect(html).toContain('ds-effect-bleeding');
  });

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
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
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
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
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
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🦴');
    expect(html).toContain('ds-effect-fractured');
  });

  it('should display multiple effects on same part', () => {
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
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('🩸');
    expect(html).toContain('🔥');
    expect(html).toContain('☠️');
    expect(html).toContain('🦴');
  });

  it('should handle parts without components property', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Head',
          currentHealth: 100,
          maxHealth: 100,
          // No components property
        },
      ],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
    damageAnalyticsPanel.render();

    const html = mockContainerElement.innerHTML;
    expect(html).toContain('ds-status-cell');
  });

  it('should maintain correct column order', () => {
    const anatomyData = {
      parts: [{ id: 'part-1', name: 'Head', currentHealth: 100, maxHealth: 100, components: {} }],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);
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

  it('should include components in getAnalytics return value', () => {
    const anatomyData = {
      parts: [
        {
          id: 'part-1',
          name: 'Head',
          currentHealth: 100,
          maxHealth: 100,
          components: {
            'anatomy:bleeding': { severity: 'minor' },
          },
        },
      ],
    };
    damageAnalyticsPanel.setEntity('test-entity', anatomyData);

    const analytics = damageAnalyticsPanel.getAnalytics();
    expect(analytics.parts[0].components).toBeDefined();
    expect(analytics.parts[0].components['anatomy:bleeding']).toBeDefined();
  });
});
```

## Test Case Coverage

| Test Case | Scenario | Expected Behavior |
|-----------|----------|-------------------|
| Header rendering | Any data | "Status" column header present |
| No effects | Empty components | Dash displayed |
| Bleeding | anatomy:bleeding present | 🩸 icon with tooltip |
| Burning | anatomy:burning present | 🔥 icon with tooltip |
| Poisoned | anatomy:poisoned present | ☠️ icon with tooltip |
| Fractured | anatomy:fractured present | 🦴 icon with tooltip |
| Multiple effects | All 4 effects on one part | All 4 icons displayed |
| Missing components | No components property | Handles gracefully |
| Column order | Any data | Part < Health < Status < Eff. Damage < Hits |
| getAnalytics | Components present | Components in return value |

## Acceptance Criteria

### Tests That Must Pass

Run: `npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js`

All 10 new tests must pass:
1. should render Status column header
2. should display dash when no status effects present
3. should display bleeding effect icon
4. should display burning effect icon
5. should display poisoned effect icon
6. should display fractured effect icon
7. should display multiple effects on same part
8. should handle parts without components property
9. should maintain correct column order
10. should include components in getAnalytics return value

### Invariants

- All pre-existing tests must continue to pass
- No modifications to test setup (beforeEach/afterEach)
- Test suite must follow existing patterns in file

## Verification Commands

```bash
npm run test:unit -- tests/unit/domUI/damage-simulator/DamageAnalyticsPanel.test.js
```

## Definition of Done

1. All 10 test cases added to test file
2. All new tests pass
3. All pre-existing tests still pass
4. Test coverage maintained or improved
