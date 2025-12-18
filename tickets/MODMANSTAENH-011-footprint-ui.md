# MODMANSTAENH-011: Transitive Footprint UI Section

**Status:** Not Started
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-008
**Parent:** MODMANSTAENH-000

---

## Objective

Add a collapsible "Dependency Footprint" section to SummaryPanelView that displays per-mod transitive dependency counts and overlap analysis from `ModStatisticsService.getTransitiveDependencyFootprints()`.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add footprint section)
- `css/mod-manager.css` (add footprint styling)
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
 * Render dependency footprint section
 * @returns {HTMLElement}
 */
#renderFootprintSection() {
  const analysis = this.#modStatisticsService.getTransitiveDependencyFootprints();

  const section = document.createElement('section');
  section.className = 'summary-panel__section summary-panel__section--collapsible';

  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.setAttribute('aria-expanded', 'false'); // Start collapsed
  header.innerHTML = `
    <span class="summary-panel__section-title">Dependency Footprint</span>
    <span class="summary-panel__section-toggle">▶</span>
  `;

  const content = document.createElement('div');
  content.className = 'summary-panel__section-content summary-panel__section-content--collapsed';

  if (analysis.footprints.length === 0) {
    content.innerHTML = '<p class="summary-panel__empty">No explicit mods</p>';
  } else {
    // Overlap summary
    const overlapSummary = document.createElement('div');
    overlapSummary.className = 'summary-panel__footprint-overlap';
    overlapSummary.innerHTML = `
      <span class="summary-panel__footprint-overlap-value">${analysis.overlapPercentage}%</span>
      <span class="summary-panel__footprint-overlap-label">dependencies shared</span>
    `;
    content.appendChild(overlapSummary);

    // Per-mod footprint list
    const list = document.createElement('ul');
    list.className = 'summary-panel__footprint-list';

    for (const footprint of analysis.footprints) {
      const item = document.createElement('li');
      item.className = 'summary-panel__footprint-item';

      // Create expandable deps list
      const depsPreview = footprint.dependencies.slice(0, 3).join(', ');
      const hasMore = footprint.dependencies.length > 3;

      item.innerHTML = `
        <div class="summary-panel__footprint-header">
          <span class="summary-panel__footprint-mod">${footprint.modId}</span>
          <span class="summary-panel__footprint-count">+${footprint.count} deps</span>
        </div>
        <div class="summary-panel__footprint-deps">
          ${depsPreview}${hasMore ? ', ...' : ''}
        </div>
      `;

      list.appendChild(item);
    }

    content.appendChild(list);

    // Summary footer
    const footer = document.createElement('div');
    footer.className = 'summary-panel__footprint-footer';
    footer.innerHTML = `
      <span>Total unique: ${analysis.totalUniqueDeps}</span>
      <span>Shared: ${analysis.sharedDepsCount}</span>
    `;
    content.appendChild(footer);
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
/* Footprint Section */
.summary-panel__footprint-overlap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem 0;
  margin-bottom: 0.5rem;
  border-bottom: 1px solid var(--border-color, #444);
}

.summary-panel__footprint-overlap-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--color-info, #4af);
}

.summary-panel__footprint-overlap-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.summary-panel__footprint-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.summary-panel__footprint-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border-subtle, #333);
}

.summary-panel__footprint-item:last-child {
  border-bottom: none;
}

.summary-panel__footprint-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-panel__footprint-mod {
  font-family: monospace;
  font-size: 0.8125rem;
  color: var(--text-primary, #fff);
}

.summary-panel__footprint-count {
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.summary-panel__footprint-deps {
  font-size: 0.6875rem;
  color: var(--text-muted, #666);
  margin-top: 0.25rem;
  font-style: italic;
}

.summary-panel__footprint-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 0.5rem;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color, #444);
  font-size: 0.75rem;
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

1. **Overlap display**
   - Shows overlap percentage prominently
   - Shows shared/total counts in footer

2. **Footprint list**
   - Lists each explicit mod with dep count
   - Shows first 3 deps as preview
   - Shows "..." for more than 3 deps

3. **Edge cases**
   - Empty message when no explicit mods
   - Handles 0% overlap correctly

4. **Collapsible behavior**
   - Starts collapsed
   - Toggle works correctly

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
# Open mod manager UI and verify footprint section renders correctly
```

---

## Test Cases to Add

```javascript
describe('Dependency Footprint Section', () => {
  let mockModGraphService;
  let mockModStatisticsService;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockModGraphService = {
      getAllNodes: jest.fn().mockReturnValue(new Map()),
      getLoadOrder: jest.fn().mockReturnValue([]),
    };

    mockModStatisticsService = {
      getDependencyHotspots: jest.fn().mockReturnValue([]),
      getHealthStatus: jest.fn().mockReturnValue({
        hasCircularDeps: false, missingDeps: [], loadOrderValid: true, warnings: [], errors: []
      }),
      getDependencyDepthAnalysis: jest.fn().mockReturnValue({
        maxDepth: 0, deepestChain: [], averageDepth: 0
      }),
      getTransitiveDependencyFootprints: jest.fn(),
      invalidateCache: jest.fn(),
    };
  });

  it('should display overlap percentage prominently', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [{ modId: 'mod1', dependencies: ['core'], count: 1 }],
      totalUniqueDeps: 5,
      sharedDepsCount: 3,
      overlapPercentage: 60
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const overlapValue = container.querySelector('.summary-panel__footprint-overlap-value');
    expect(overlapValue.textContent).toBe('60%');
  });

  it('should display footprint list for each explicit mod', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [
        { modId: 'large-mod', dependencies: ['a', 'b', 'c', 'd'], count: 4 },
        { modId: 'small-mod', dependencies: ['x'], count: 1 },
      ],
      totalUniqueDeps: 5,
      sharedDepsCount: 0,
      overlapPercentage: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const footprintItems = container.querySelectorAll('.summary-panel__footprint-item');
    expect(footprintItems).toHaveLength(2);

    const firstMod = footprintItems[0].querySelector('.summary-panel__footprint-mod');
    const firstCount = footprintItems[0].querySelector('.summary-panel__footprint-count');
    expect(firstMod.textContent).toBe('large-mod');
    expect(firstCount.textContent).toBe('+4 deps');
  });

  it('should show preview of first 3 deps with ellipsis for more', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [
        { modId: 'mod1', dependencies: ['a', 'b', 'c', 'd', 'e'], count: 5 },
      ],
      totalUniqueDeps: 5,
      sharedDepsCount: 0,
      overlapPercentage: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const depsPreview = container.querySelector('.summary-panel__footprint-deps');
    expect(depsPreview.textContent).toContain('a, b, c');
    expect(depsPreview.textContent).toContain('...');
  });

  it('should show footer with total and shared counts', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
      totalUniqueDeps: 10,
      sharedDepsCount: 4,
      overlapPercentage: 40
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const footer = container.querySelector('.summary-panel__footprint-footer');
    expect(footer.textContent).toContain('Total unique: 10');
    expect(footer.textContent).toContain('Shared: 4');
  });

  it('should show empty message when no explicit mods', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [],
      totalUniqueDeps: 0,
      sharedDepsCount: 0,
      overlapPercentage: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const emptyMessage = container.querySelector('.summary-panel__empty');
    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toBe('No explicit mods');
  });

  it('should start collapsed', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
      totalUniqueDeps: 1,
      sharedDepsCount: 0,
      overlapPercentage: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const footprintHeader = Array.from(headers).find(h =>
      h.textContent.includes('Footprint')
    );

    expect(footprintHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('should have correct BEM class structure', () => {
    mockModStatisticsService.getTransitiveDependencyFootprints.mockReturnValue({
      footprints: [{ modId: 'mod1', dependencies: ['a'], count: 1 }],
      totalUniqueDeps: 1,
      sharedDepsCount: 0,
      overlapPercentage: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    expect(container.querySelector('.summary-panel__footprint-overlap')).toBeTruthy();
    expect(container.querySelector('.summary-panel__footprint-list')).toBeTruthy();
    expect(container.querySelector('.summary-panel__footprint-item')).toBeTruthy();
    expect(container.querySelector('.summary-panel__footprint-footer')).toBeTruthy();
  });
});
```
