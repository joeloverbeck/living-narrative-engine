# MODMANSTAENH-005: Dependency Hotspots UI Section

**Status:** Completed
**Priority:** High (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-002
**Parent:** MODMANSTAENH-000

---

## Objective

Add a collapsible "Dependency Hotspots" section to SummaryPanelView that displays the top 5 most depended-on mods using data from `ModStatisticsService.getDependencyHotspots()`.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add hotspots section rendering)
- `src/modManager/ModManagerBootstrap.js` (pass hotspots data to view)
- `css/mod-manager.css` (add hotspots styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Architecture Corrections (from original ticket)

**Original assumption was INCORRECT**: The original ticket assumed `SummaryPanelView` would accept services in its constructor and call `modStatisticsService.getDependencyHotspots(5)` internally.

**Correct architecture**: The view follows MVC pattern where:
1. `ModManagerBootstrap.#renderUI()` calls `modStatisticsService.getDependencyHotspots(5)`
2. Data is passed to `SummaryPanelView.render()` via a new `hotspots` parameter
3. View renders the section using provided data (no service access)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/controllers/ModManagerController.js` - data flows through Bootstrap
- Health Status UI (MODMANSTAENH-006)
- Any calculation logic (handled by service)

---

## Implementation Details

### Section Structure

```javascript
/**
 * Render dependency hotspots section
 * @param {Array<{modId: string, dependentCount: number}>} hotspots - Hotspots data from Bootstrap
 * @returns {HTMLElement}
 */
#renderHotspotsSection(hotspots) {
  const section = document.createElement('section');
  section.className = 'summary-panel__section summary-panel__section--collapsible';

  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.setAttribute('aria-expanded', 'true');
  header.innerHTML = `
    <span class="summary-panel__section-title">Dependency Hotspots</span>
    <span class="summary-panel__section-toggle">▼</span>
  `;

  const content = document.createElement('div');
  content.className = 'summary-panel__section-content';

  if (hotspots.length === 0) {
    content.innerHTML = '<p class="summary-panel__empty">No active mods</p>';
  } else {
    const list = document.createElement('ol');
    list.className = 'summary-panel__hotspots-list';

    for (const { modId, dependentCount } of hotspots) {
      const item = document.createElement('li');
      item.className = 'summary-panel__hotspot-item';
      item.innerHTML = `
        <span class="summary-panel__hotspot-name">${modId}</span>
        <span class="summary-panel__hotspot-count">${dependentCount} dependents</span>
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
/* Collapsible Sections */
.summary-panel__section {
  margin-bottom: 0.75rem;
}

.summary-panel__section--collapsible {
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
}

.summary-panel__section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-secondary, #2a2a2a);
  border: none;
  cursor: pointer;
  color: var(--text-primary, #fff);
  font-size: 0.875rem;
  font-weight: 600;
}

.summary-panel__section-header:hover {
  background: var(--bg-hover, #333);
}

.summary-panel__section-toggle {
  font-size: 0.75rem;
  color: var(--text-muted, #888);
}

.summary-panel__section-content {
  padding: 0.5rem 0.75rem;
}

.summary-panel__section-content--collapsed {
  display: none;
}

/* Hotspots List */
.summary-panel__hotspots-list {
  list-style: decimal;
  margin: 0;
  padding-left: 1.5rem;
}

.summary-panel__hotspot-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
}

.summary-panel__hotspot-name {
  color: var(--text-primary, #fff);
  font-family: monospace;
}

.summary-panel__hotspot-count {
  color: var(--text-secondary, #aaa);
  font-size: 0.75rem;
}

.summary-panel__empty {
  color: var(--text-muted, #666);
  font-style: italic;
  margin: 0;
  padding: 0.25rem 0;
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Rendering**
   - Renders hotspots section with correct class
   - Displays top 5 mods in order
   - Shows dependent count for each mod
   - Shows empty message when no mods

2. **Collapsible behavior**
   - Section starts expanded
   - Click toggles collapsed state
   - aria-expanded attribute updates correctly
   - Toggle icon changes appropriately

3. **Data integration**
   - Receives hotspots data via `render({ hotspots })` parameter
   - Displays mod IDs correctly
   - Displays dependent counts correctly
   - Defaults to empty array when hotspots not provided (backward compatibility)

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. BEM naming convention maintained
3. Accessibility attributes present (aria-expanded)
4. Section is keyboard navigable

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
# Open mod manager UI and verify hotspots section renders correctly
# Test collapse/expand functionality
```

---

## Test Cases to Add

**NOTE**: Tests use the correct architecture where hotspots data is passed via `render()`, not via constructor injection.

```javascript
describe('Dependency Hotspots Section', () => {
  /** @type {HTMLElement} */
  let container;
  /** @type {{error: jest.Mock}} */
  let mockLogger;
  /** @type {jest.Mock} */
  let onSave;
  /** @type {SummaryPanelView} */
  let view;

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    container = document.getElementById('root');
    mockLogger = { error: jest.fn() };
    onSave = jest.fn().mockResolvedValue(undefined);

    view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave,
    });
  });

  it('should render hotspots list with provided data', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      hotspots: [
        { modId: 'core', dependentCount: 42 },
        { modId: 'anatomy', dependentCount: 28 },
        { modId: 'positioning', dependentCount: 15 },
      ],
    });

    const hotspotItems = container.querySelectorAll('.summary-panel__hotspot-item');
    expect(hotspotItems).toHaveLength(3);

    expect(hotspotItems[0].querySelector('.summary-panel__hotspot-name').textContent).toBe('core');
    expect(hotspotItems[0].querySelector('.summary-panel__hotspot-count').textContent).toBe('42 dependents');
  });

  it('should show empty message when hotspots array is empty', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      hotspots: [],
    });

    const emptyMessage = container.querySelector('.summary-panel__hotspots-empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toBe('No dependency hotspots');
  });

  it('should toggle section on header click', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      hotspots: [{ modId: 'core', dependentCount: 10 }],
    });

    const header = container.querySelector('.summary-panel__section-header');
    const content = container.querySelector('.summary-panel__section-content');

    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(content.classList.contains('summary-panel__section-content--collapsed')).toBe(false);

    header.click();

    expect(header.getAttribute('aria-expanded')).toBe('false');
    expect(content.classList.contains('summary-panel__section-content--collapsed')).toBe(true);

    header.click();

    expect(header.getAttribute('aria-expanded')).toBe('true');
    expect(content.classList.contains('summary-panel__section-content--collapsed')).toBe(false);
  });

  it('should have correct BEM class structure', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      hotspots: [{ modId: 'core', dependentCount: 10 }],
    });

    expect(container.querySelector('.summary-panel__section--collapsible')).toBeTruthy();
    expect(container.querySelector('.summary-panel__section-header')).toBeTruthy();
    expect(container.querySelector('.summary-panel__section-title')).toBeTruthy();
    expect(container.querySelector('.summary-panel__section-toggle')).toBeTruthy();
    expect(container.querySelector('.summary-panel__section-content')).toBeTruthy();
    expect(container.querySelector('.summary-panel__hotspots-list')).toBeTruthy();
  });

  it('should default to empty array when hotspots not provided (backward compatibility)', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      // hotspots not provided
    });

    const emptyMessage = container.querySelector('.summary-panel__hotspots-empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toBe('No dependency hotspots');
  });

  it('should escape HTML in mod IDs to prevent XSS', () => {
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
      hotspots: [{ modId: '<script>alert("xss")</script>', dependentCount: 5 }],
    });

    const modName = container.querySelector('.summary-panel__hotspot-name');
    expect(modName.textContent).toBe('<script>alert("xss")</script>');
    expect(modName.innerHTML).not.toContain('<script>');
  });
});
```

---

## Outcome

### Implementation Summary

**Completed Successfully** - All acceptance criteria met.

### Files Modified

| File | Changes |
|------|---------|
| `src/modManager/views/SummaryPanelView.js` | Added `#hotspotsSection` private field, `hotspots` parameter to `render()`, `#renderHotspotsSection()` private method |
| `src/modManager/ModManagerBootstrap.js` | Added hotspots retrieval via `modStatisticsService.getDependencyHotspots(5)` and passing to view |
| `css/mod-manager.css` | Added collapsible section styles and hotspots list styles |
| `tests/unit/modManager/views/SummaryPanelView.test.js` | Added 10 new test cases for hotspots functionality |
| `tests/integration/modManager/modManagerUIRendering.integration.test.js` | Added mock `getDependencyHotspots()` method |

### Tests Added (10 new test cases)

1. `should render hotspots list with provided data` - Validates correct HTML structure
2. `should show empty message when hotspots array is empty` - Edge case handling
3. `should toggle section on header click` - Collapsible behavior verification
4. `should have correct BEM class structure` - CSS naming convention compliance
5. `should default to empty array when hotspots not provided` - Backward compatibility
6. `should escape HTML in mod IDs to prevent XSS` - Security validation
7. `should update toggle icon when collapsing/expanding` - Visual feedback
8. `should have correct accessibility attributes on header button` - WCAG compliance
9. `should render multiple hotspots in order` - Order preservation
10. `should have hotspots section with correct aria-label` - Accessibility

### Test Results

- Unit tests: 42 passed (SummaryPanelView.test.js)
- All mod manager unit tests: 649 passed
- Integration tests: 55 passed

### Architecture Validation

The implementation correctly follows the MVC pattern:
1. Bootstrap retrieves data from service
2. Data flows to view via render() parameters
3. View renders without service access

### Deviations from Original Ticket

The original ticket incorrectly assumed constructor-based service injection. Implementation follows actual codebase architecture with render-parameter data flow.
