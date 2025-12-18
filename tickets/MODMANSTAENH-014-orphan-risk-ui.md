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
 * @returns {HTMLElement}
 */
#renderFragilitySection() {
  const analysis = this.#modStatisticsService.getSingleParentDependencies();

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

## Test Cases to Add

```javascript
describe('Fragility Warnings Section', () => {
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
      getTransitiveDependencyFootprints: jest.fn().mockReturnValue({
        footprints: [], totalUniqueDeps: 0, sharedDepsCount: 0, overlapPercentage: 0
      }),
      getCoreOptionalRatio: jest.fn().mockReturnValue({
        foundationCount: 0, optionalCount: 0, totalActive: 0,
        foundationPercentage: 0, optionalPercentage: 0, foundationMods: [], profile: 'balanced'
      }),
      getSingleParentDependencies: jest.fn(),
      invalidateCache: jest.fn(),
    };
  });

  it('should display success message when no fragile deps', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [],
      totalAtRisk: 0,
      percentageOfDeps: 0
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const successMessage = container.querySelector('.summary-panel__success');
    expect(successMessage).toBeTruthy();
    expect(successMessage.textContent).toBe('No fragile dependencies detected');
  });

  it('should display count and percentage of at-risk mods', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
        { modId: 'core', singleDependent: 'anatomy', status: 'core' },
      ],
      totalAtRisk: 2,
      percentageOfDeps: 40
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const count = container.querySelector('.summary-panel__fragility-count');
    const label = container.querySelector('.summary-panel__fragility-label');

    expect(count.textContent).toBe('2');
    expect(label.textContent).toContain('40%');
  });

  it('should display at-risk mods with their single dependent', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const items = container.querySelectorAll('.summary-panel__fragility-item');
    expect(items).toHaveLength(1);

    const modName = items[0].querySelector('.summary-panel__fragility-mod');
    const dependent = items[0].querySelector('.summary-panel__fragility-dependent');

    expect(modName.textContent).toBe('anatomy');
    expect(dependent.textContent).toContain('clothing');
  });

  it('should show correct badge for core status', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'core', singleDependent: 'anatomy', status: 'core' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 50
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const badge = container.querySelector('.summary-panel__fragility-badge');
    expect(badge.textContent).toBe('core');
    expect(badge.classList.contains('summary-panel__fragility-badge--core')).toBe(true);
  });

  it('should show correct badge for dependency status', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const badge = container.querySelector('.summary-panel__fragility-badge');
    expect(badge.textContent).toBe('dep');
    expect(badge.classList.contains('summary-panel__fragility-badge--dependency')).toBe(true);
  });

  it('should include warning icon in header when risks exist', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
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
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.textContent).toContain('⚠️');
  });

  it('should not include warning icon when no risks', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [],
      totalAtRisk: 0,
      percentageOfDeps: 0
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
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.textContent).not.toContain('⚠️');
  });

  it('should start collapsed', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
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
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    expect(fragilityHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('should toggle section on header click', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
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
    const fragilityHeader = Array.from(headers).find(h =>
      h.textContent.includes('Fragility')
    );

    fragilityHeader.click();

    expect(fragilityHeader.getAttribute('aria-expanded')).toBe('true');
  });

  it('should display explanation text', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const explanation = container.querySelector('.summary-panel__fragility-explanation');
    expect(explanation).toBeTruthy();
    expect(explanation.textContent).toContain('only one dependent');
  });

  it('should have correct BEM class structure', () => {
    mockModStatisticsService.getSingleParentDependencies.mockReturnValue({
      atRiskMods: [
        { modId: 'anatomy', singleDependent: 'clothing', status: 'dependency' },
      ],
      totalAtRisk: 1,
      percentageOfDeps: 25
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

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
