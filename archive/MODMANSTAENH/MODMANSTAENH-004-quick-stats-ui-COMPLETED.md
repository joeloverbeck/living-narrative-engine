# MODMANSTAENH-004: Quick Stats UI Enhancement

**Status:** Completed
**Priority:** High (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-001
**Parent:** MODMANSTAENH-000

---

## Assumptions Corrected (Pre-Implementation Review)

The original ticket made several incorrect assumptions about the codebase architecture:

| Original Assumption | Reality | Correction |
|---------------------|---------|------------|
| SummaryPanelView uses `modGraphService` | View receives pre-calculated data via `render()` params | Pass stats via render params instead |
| Controller creates SummaryPanelView | Bootstrap creates it (line 175-181) | Modify Bootstrap, not Controller |
| Need `#calculateQuickStats()` in view | Stats calculated in Bootstrap, not view | Keep view dumb, calculate in Bootstrap |
| Modify ModManagerController.js | Controller not involved in view creation | Remove from files to modify |

**Correct Architecture Pattern:**
```
State changes → Controller → Bootstrap#renderUI() → SummaryPanelView.render(params)
```

---

## Objective

Enhance the existing Quick Stats section in SummaryPanelView to display additional statistics from ModStatisticsService, including explicit mod count, dependency count, and conflict count with clear visual separation.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add stats display elements and render params)
- `src/modManager/ModManagerBootstrap.js` (calculate stats and pass to view)
- `css/mod-manager.css` (add stat styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

### Files NOT Modified (Corrected from Original)
- ~~`src/modManager/controllers/ModManagerController.js`~~ - Not involved in view creation

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - use existing API only
- `src/modManager/ModManagerBootstrap.js` - service already registered
- Any collapsible section UI (separate tickets)
- Dependency Hotspots section (MODMANSTAENH-005)
- Health Status section (MODMANSTAENH-006)

---

## Implementation Details

### Bootstrap Updates (Corrected Approach)

In `ModManagerBootstrap.js`, calculate stats in `#renderUI()` and pass to view:

```javascript
// In #renderUI() method
if (this.#summaryPanelView) {
  // Calculate quick stats from graph
  const modGraphService = this.#container.get('modGraphService');
  const nodes = modGraphService.getAllNodes();
  let explicitCount = 0;
  let dependencyCount = 0;

  for (const [, node] of nodes) {
    if (node.status === 'explicit') explicitCount++;
    if (node.status === 'dependency') dependencyCount++;
  }

  this.#summaryPanelView.render({
    loadOrder: state.resolvedMods || [],
    activeCount: (state.resolvedMods || []).length,
    explicitCount,  // NEW
    dependencyCount,  // NEW
    hasUnsavedChanges: state.hasUnsavedChanges,
    isSaving: state.isSaving,
    isLoading: state.isLoading,
  });
}
```

### View Updates

In `SummaryPanelView.js`, add new stat display elements in `#createStructure()` and update `render()`:

```javascript
// Update render method signature to accept new params
render({ loadOrder, activeCount, explicitCount, dependencyCount, hasUnsavedChanges, isSaving, isLoading })

// In #createStructure(), update stats section to show all three stats in a row
```

### CSS Updates

In `css/mod-manager.css`:

```css
/* Quick Stats Section */
.summary-panel__quick-stats {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-color, #444);
  margin-bottom: 0.5rem;
}

.summary-panel__stats-row {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.summary-panel__stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 3rem;
}

.summary-panel__stat-value {
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--text-primary, #fff);
}

.summary-panel__stat-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
  text-transform: uppercase;
}

.summary-panel__stat-divider {
  color: var(--text-muted, #666);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Stats calculation**
   - Correctly counts total active mods
   - Correctly counts explicit mods
   - Correctly counts dependency mods
   - Excludes inactive mods from counts

2. **Rendering**
   - Renders quick stats container with correct class
   - Displays all three stat values
   - Shows proper labels

3. **Update behavior**
   - Stats update when graph changes
   - Stats recalculate on refresh

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. ModGraphService API usage is unchanged
3. BEM naming convention maintained
4. View updates when controller signals changes

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
# Open mod manager UI and verify stats display correctly
```

---

## Test Cases to Add

```javascript
describe('Quick Stats', () => {
  let mockModGraphService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModGraphService = {
      getAllNodes: jest.fn(),
      getLoadOrder: jest.fn().mockReturnValue([]),
      getModStatus: jest.fn(),
    };
  });

  it('should calculate correct stats for mixed mod types', () => {
    const nodes = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['explicit1', { id: 'explicit1', status: 'explicit' }],
      ['explicit2', { id: 'explicit2', status: 'explicit' }],
      ['dep1', { id: 'dep1', status: 'dependency' }],
      ['inactive', { id: 'inactive', status: 'inactive' }],
    ]);
    mockModGraphService.getAllNodes.mockReturnValue(nodes);

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    view.render();

    const statsContainer = container.querySelector('.summary-panel__quick-stats');
    expect(statsContainer).toBeTruthy();

    const statValues = container.querySelectorAll('.summary-panel__stat-value');
    expect(statValues[0].textContent).toBe('4'); // total (excludes inactive)
    expect(statValues[1].textContent).toBe('2'); // explicit
    expect(statValues[2].textContent).toBe('1'); // dependencies
  });

  it('should render stats with correct BEM classes', () => {
    mockModGraphService.getAllNodes.mockReturnValue(new Map());

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    view.render();

    expect(container.querySelector('.summary-panel__quick-stats')).toBeTruthy();
    expect(container.querySelector('.summary-panel__stats-row')).toBeTruthy();
    expect(container.querySelector('.summary-panel__stat')).toBeTruthy();
    expect(container.querySelector('.summary-panel__stat-value')).toBeTruthy();
    expect(container.querySelector('.summary-panel__stat-label')).toBeTruthy();
  });

  it('should show zero stats for empty graph', () => {
    mockModGraphService.getAllNodes.mockReturnValue(new Map());

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    view.render();

    const statValues = container.querySelectorAll('.summary-panel__stat-value');
    expect(statValues[0].textContent).toBe('0');
    expect(statValues[1].textContent).toBe('0');
    expect(statValues[2].textContent).toBe('0');
  });

  it('should update stats when graph changes', () => {
    const nodes1 = new Map([
      ['core', { id: 'core', status: 'core' }],
    ]);
    const nodes2 = new Map([
      ['core', { id: 'core', status: 'core' }],
      ['new-mod', { id: 'new-mod', status: 'explicit' }],
    ]);

    mockModGraphService.getAllNodes.mockReturnValue(nodes1);

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      logger: mockLogger,
    });

    view.render();
    let statValues = container.querySelectorAll('.summary-panel__stat-value');
    expect(statValues[0].textContent).toBe('1');

    // Simulate graph change
    mockModGraphService.getAllNodes.mockReturnValue(nodes2);
    view.render();

    statValues = container.querySelectorAll('.summary-panel__stat-value');
    expect(statValues[0].textContent).toBe('2');
  });
});
```

---

## Outcome

**Status:** ✅ Completed
**Date:** 2025-12-18

### Changes Made

1. **SummaryPanelView.js** (~50 lines modified)
   - Added `#explicitCountElement` and `#dependencyCountElement` private fields
   - Refactored `#createStructure()` to create three-column stats row with dividers
   - Changed section class from `.summary-panel__stats` to `.summary-panel__quick-stats`
   - Added `.summary-panel__stats-row` for flex layout
   - Updated `render()` to accept and display `explicitCount` and `dependencyCount` params with defaults of 0

2. **ModManagerBootstrap.js** (~12 lines added)
   - Added stat calculation in `#renderUI()` method
   - Iterates over `modGraphService.getAllNodes()` to count 'explicit' and 'dependency' statuses
   - Passes calculated values to `SummaryPanelView.render()`

3. **mod-manager.css** (~25 lines added)
   - Added `.summary-panel__quick-stats` section styles
   - Added `.summary-panel__stats-row` with flexbox layout
   - Updated `.summary-panel__stat` for column display
   - Added `.summary-panel__stat-divider` for visual separation
   - Kept `.summary-panel__stats` for backwards compatibility

4. **SummaryPanelView.test.js** (~130 lines added)
   - 8 new test cases:
     - `displays explicit mod count`
     - `displays dependency mod count`
     - `displays all three stats correctly for mixed mod types`
     - `displays zero stats when counts are zero or missing`
     - `defaults explicitCount and dependencyCount to 0 when not provided`
     - `updates stats when values change`
     - `renders stats with correct BEM structure`
   - Updated structure tests for new class names

### Test Results

```
Tests:       32 passed (SummaryPanelView.test.js)
Tests:       21 passed (ModManagerBootstrap.test.js)
Tests:       639 passed (all modManager unit tests)
Tests:       55 passed (modManager integration tests)
```

### Architecture Notes

The implementation follows the "dumb view" pattern:
- View only displays pre-calculated data passed via render params
- Bootstrap orchestrates calculation from services and passes to view
- No service injection into the view (view remains stateless)
- Backwards compatible: default values for new params maintain existing API
