# MODMANSTAENH-014: Orphan Risk (Fragility Warnings) UI Section

**Status:** Not Started
**Priority:** Low (Phase 3)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-013
**Parent:** MODMANSTAENH-000

---

## Objective

Add a collapsible "Fragility Warnings" section to SummaryPanelView that displays dependencies at orphan risk from `ModStatisticsService.getSingleParentDependencies()`, showing which mods are vulnerable if their single dependent is deactivated.

---

## Architecture Notes (CORRECTED)

**Key Pattern**: `SummaryPanelView` does NOT have direct access to services. It receives data via the `render()` method, following the same pattern as other sections (hotspots, healthStatus, depthAnalysis, footprintAnalysis, profileRatio).

**Constructor signature**: `{ container, logger, onSave }` - no service parameters
**Data injection**: Via `render({ ..., fragilityAnalysis, ... })` parameter

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add fragility section)
- `css/mod-manager.css` (add fragility styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/ModManagerBootstrap.js` - no changes needed
- `src/modManager/controllers/ModManagerController.js` - already has service
- Profile UI (MODMANSTAENH-012)
- Any calculation logic (handled by service)

---

## Implementation Details

### Section Structure

```javascript
/**
 * Render fragility warnings section
 * @param {object|null} fragilityAnalysis - From ModStatisticsService.getSingleParentDependencies()
 * @param {Array<{modId: string, singleDependent: string, status: string}>} [fragilityAnalysis.atRiskMods]
 * @param {number} [fragilityAnalysis.totalAtRisk]
 * @param {number} [fragilityAnalysis.percentageOfDeps]
 */
#renderFragilitySection(fragilityAnalysis) {
  this.#fragilitySection.innerHTML = '';

  // Hide section if no data
  if (!fragilityAnalysis) {
    this.#fragilitySection.hidden = true;
    return;
  }
  this.#fragilitySection.hidden = false;

  const analysis = fragilityAnalysis;

  const section = document.createElement('section');
  section.className = 'summary-panel__section summary-panel__section--collapsible';

  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.setAttribute('aria-expanded', 'false'); // Start collapsed

  // Add warning indicator if there are at-risk mods
  const warningIcon = analysis.totalAtRisk > 0 ? '⚠️ ' : '';
  header.innerHTML = `
    <span class="summary-panel__section-title">${warningIcon}Fragility Warnings</span>
    <span class="summary-panel__section-toggle">▶</span>
  `;

  const content = document.createElement('div');
  content.className = 'summary-panel__section-content summary-panel__section-content--collapsed';

  if (analysis.totalAtRisk === 0) {
    content.innerHTML = '<p class="summary-panel__success">No fragile dependencies detected</p>';
  } else {
    // Summary stats
    const stats = document.createElement('div');
    stats.className = 'summary-panel__fragility-stats';
    stats.innerHTML = `
      <span class="summary-panel__fragility-count">${analysis.totalAtRisk}</span>
      <span class="summary-panel__fragility-label">at-risk dependencies (${analysis.percentageOfDeps}% of all deps)</span>
    `;
    content.appendChild(stats);

    // Explanation
    const explanation = document.createElement('p');
    explanation.className = 'summary-panel__fragility-explanation';
    explanation.textContent = 'These mods have only one dependent. If that dependent is disabled, these become orphaned.';
    content.appendChild(explanation);

    // At-risk list
    const list = document.createElement('ul');
    list.className = 'summary-panel__fragility-list';

    for (const risk of analysis.atRiskMods) {
      const item = document.createElement('li');
      item.className = 'summary-panel__fragility-item';

      const statusBadge = risk.status === 'core' ? 'core' : 'dep';

      item.innerHTML = `
        <div class="summary-panel__fragility-row">
          <span class="summary-panel__fragility-badge summary-panel__fragility-badge--${risk.status}">${statusBadge}</span>
          <span class="summary-panel__fragility-mod">${risk.modId}</span>
        </div>
        <div class="summary-panel__fragility-dependent">
          ← only used by <strong>${risk.singleDependent}</strong>
        </div>
      `;

      list.appendChild(item);
    }

    content.appendChild(list);
  }

  // Toggle behavior
  header.addEventListener('click', () => {
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', !isExpanded);
    content.classList.toggle('summary-panel__section-content--collapsed');
    header.querySelector('.summary-panel__section-toggle').textContent = isExpanded ? '▶' : '▼';
  });

  section.appendChild(header);
  section.appendChild(content);

  return section;
}
```

### CSS Updates

In `css/mod-manager.css`:

```css
/* Fragility Section */
.summary-panel__success {
  color: var(--color-success, #4a4);
  font-style: italic;
  margin: 0;
}

.summary-panel__fragility-stats {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.summary-panel__fragility-count {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-warning, #fa4);
}

.summary-panel__fragility-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.summary-panel__fragility-explanation {
  font-size: 0.75rem;
  color: var(--text-muted, #666);
  font-style: italic;
  margin: 0 0 0.75rem 0;
}

.summary-panel__fragility-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.summary-panel__fragility-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle, #333);
}

.summary-panel__fragility-item:last-child {
  border-bottom: none;
}

.summary-panel__fragility-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-panel__fragility-badge {
  display: inline-block;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.625rem;
  font-weight: bold;
  text-transform: uppercase;
}

.summary-panel__fragility-badge--core {
  background-color: var(--color-core, #5a5a8a);
  color: var(--text-light, #fff);
}

.summary-panel__fragility-badge--dependency {
  background-color: var(--color-dependency, #5a8a5a);
  color: var(--text-light, #fff);
}

.summary-panel__fragility-mod {
  font-family: monospace;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
}

.summary-panel__fragility-dependent {
  font-size: 0.6875rem;
  color: var(--text-muted, #666);
  margin-left: 2.5rem;
  margin-top: 0.125rem;
}

.summary-panel__fragility-dependent strong {
  color: var(--text-secondary, #aaa);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Summary display**
   - Shows count of at-risk mods
   - Shows percentage of all dependencies
   - Displays explanation text

2. **At-risk list**
   - Lists each at-risk mod with status badge
   - Shows the single dependent for each
   - Correct styling for core vs dependency

3. **Edge cases**
   - Success message when no fragile deps
   - Warning icon in header when risks exist
   - Handles empty list correctly

4. **Collapsible behavior**
   - Starts collapsed
   - Toggle works correctly
   - aria-expanded updates

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. BEM naming convention maintained
3. Accessibility attributes present
4. Consistent with other collapsible sections

---

## Verification Steps

```bash
# 1. Run SummaryPanelView tests
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose

# 2. Run all view tests
NODE_ENV=test npx jest tests/unit/modManager/views/ --no-coverage --silent

# 3. Run full mod manager tests
NODE_ENV=test npx jest tests/unit/modManager/ --no-coverage --silent

# 4. Visual verification (manual)
# Open mod manager UI and verify fragility section renders correctly
# Check warning icon appears when risks exist
```

---

## Test Cases to Add (CORRECTED)

**Note**: Tests follow the actual SummaryPanelView architecture pattern where:
- Constructor takes `{ container, logger, onSave }` only
- Data is passed via `render({ ..., fragilityAnalysis, ... })`

```javascript
describe('Fragility Warnings Section', () => {
  let container;
  let mockLogger;
  let onSave;
  let view;

  beforeEach(() => {
    container = document.createElement('div');
    mockLogger = { error: jest.fn() };
    onSave = jest.fn().mockResolvedValue(undefined);
    view = new SummaryPanelView({ container, logger: mockLogger, onSave });
  });

  const renderWithFragility = (fragilityAnalysis) => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      explicitCount: 1,
      dependencyCount: 0,
      hotspots: [],
      healthStatus: null,
      depthAnalysis: null,
      footprintAnalysis: null,
      profileRatio: null,
      fragilityAnalysis,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });
  };

  it('should display success message when no fragile deps', () => {
    renderWithFragility({
      atRiskMods: [],
      totalAtRisk: 0,
      percentageOfDeps: 0
    });

    const successMessage = container.querySelector('.summary-panel__success');
    expect(successMessage).toBeTruthy();
    expect(successMessage.textContent).toBe('No fragile dependencies detected');
  });

  it('should display count and percentage of at-risk mods', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        { modId: 'core', singleDependent: 'anatomy', status: 'core' },
      ],
      totalAtRisk: 2,
      percentageOfDeps: 40
    });

    const count = container.querySelector('.summary-panel__fragility-count');
    const label = container.querySelector('.summary-panel__fragility-label');

    expect(count.textContent).toBe('2');
    expect(label.textContent).toContain('40%');
  });

  it('should display at-risk mods with their single dependent', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const items = container.querySelectorAll('.summary-panel__fragility-item');
    expect(items).toHaveLength(1);

    const modName = items[0].querySelector('.summary-panel__fragility-mod');
    const dependent = items[0].querySelector('.summary-panel__fragility-dependent');

    expect(modName.textContent).toBe('anatomy');
    expect(dependent.textContent).toContain('clothing');
  });

  it('should show correct badge for core status', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'core', singleDependent: 'anatomy', status: 'core' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 50
    });

    const badge = container.querySelector('.summary-panel__fragility-badge');
    expect(badge.textContent).toBe('core');
    expect(badge.classList.contains('summary-panel__fragility-badge--core')).toBe(true);
  });

  it('should show correct badge for dependency status', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const badge = container.querySelector('.summary-panel__fragility-badge');
    expect(badge.textContent).toBe('dep');
    expect(badge.classList.contains('summary-panel__fragility-badge--dependency')).toBe(true);
  });

  it('should include warning icon in header when risks exist', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.textContent).toContain('⚠️');
  });

  it('should not include warning icon when no risks', () => {
    renderWithFragility({
      atRiskMods: [],
      totalAtRisk: 0,
      percentageOfDeps: 0
    });

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.textContent).not.toContain('⚠️');
  });

  it('should start collapsed', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('should toggle section on header click', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    fragilityHeader.click();

    expect(fragilityHeader.getAttribute('aria-expanded')).toBe('true');
  });

  it('should display explanation text', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const explanation = container.querySelector('.summary-panel__fragility-explanation');
    expect(explanation).toBeTruthy();
    expect(explanation.textContent).toContain('only one dependent');
  });

  it('should hide section when fragilityAnalysis is null', () => {
    renderWithFragility(null);

    const fragilitySection = container.querySelector('[aria-label="Fragility warnings"]');
    expect(fragilitySection.hidden).toBe(true);
  });

  it('should have correct BEM class structure', () => {
    renderWithFragility({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    expect(container.querySelector('.summary-panel__fragility-stats')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-count')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-list')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-item')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-badge')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-mod')).toBeTruthy();
    expect(container.querySelector('.summary-panel__fragility-dependent')).toBeTruthy();
  });
});
```

---

## Outcome

**Status:** ✅ Completed

### Files Modified

1. **`src/modManager/views/SummaryPanelView.js`**
   - Added `#fragilitySection` private field
   - Created section element in `#createStructure()` with `aria-label="Fragility warnings"`
   - Added `fragilityAnalysis` parameter to `render()` method with full JSDoc
   - Implemented `#renderFragilitySection(fragilityAnalysis)` private method

2. **`css/mod-manager.css`**
   - Added 16 new CSS rules for `.summary-panel__fragility-*` classes
   - Added `.summary-panel__success` class for success messages

3. **`tests/unit/modManager/views/SummaryPanelView.test.js`**
   - Added 13 new test cases in "Fragility Warnings Section" describe block
   - Tests cover: success state, at-risk display, badges, warning icons, collapsible behavior, XSS prevention

### Actual vs Planned Changes

| Aspect | Ticket Plan | Actual Implementation |
|--------|-------------|----------------------|
| Data Source | ❌ Direct service call | ✅ Data injection via `render()` |
| Constructor | ❌ `{ ..., modStatisticsService }` | ✅ `{ container, logger, onSave }` |
| API Pattern | ❌ `this.#modStatisticsService.getSingleParentDependencies()` | ✅ `fragilityAnalysis` parameter |
| Test Setup | ❌ Service mocking | ✅ `renderWithFragility()` helper |

### Test Results

```
Test Suites: 20 passed, 20 total
Tests:       755 passed, 755 total
```

All existing tests continue to pass. 13 new fragility section tests added and passing.

### Notes

The ticket was corrected early in implementation to document the actual `SummaryPanelView` architecture pattern. The view follows data injection via `render()` method, not direct service access. This matches all other sections (hotspots, health, depth, footprint, profile).
