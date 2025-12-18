# MODMANSTAENH-012: Configuration Profile UI Section

**Status:** Not Started
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-009
**Parent:** MODMANSTAENH-000

---

## Objective

Add a "Configuration Profile" section to SummaryPanelView that displays the foundation vs optional ratio from `ModStatisticsService.getCoreOptionalRatio()`, including visual bar representation and profile classification badge.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add profile section)
- `css/mod-manager.css` (add profile styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/ModManagerBootstrap.js` - no changes needed
- `src/modManager/controllers/ModManagerController.js` - already has service
- Depth UI (MODMANSTAENH-010)
- Footprint UI (MODMANSTAENH-011)
- Any calculation logic (handled by service)

---

## Implementation Details

### Section Structure

```javascript
/**
 * Render configuration profile section
 * @returns {HTMLElement}
 */
#renderProfileSection() {
  const ratio = this.#modStatisticsService.getCoreOptionalRatio();

  const section = document.createElement('section');
  section.className = 'summary-panel__section';

  const header = document.createElement('h3');
  header.className = 'summary-panel__section-title';
  header.textContent = 'Configuration Profile';
  section.appendChild(header);

  const content = document.createElement('div');
  content.className = 'summary-panel__profile-content';

  if (ratio.totalActive === 0) {
    content.innerHTML = '<p class="summary-panel__empty">No active mods</p>';
  } else {
    // Profile badge
    const badge = document.createElement('div');
    badge.className = `summary-panel__profile-badge summary-panel__profile-badge--${ratio.profile}`;
    badge.textContent = this.#formatProfileLabel(ratio.profile);
    content.appendChild(badge);

    // Ratio bar visualization
    const barContainer = document.createElement('div');
    barContainer.className = 'summary-panel__profile-bar-container';

    const foundationBar = document.createElement('div');
    foundationBar.className = 'summary-panel__profile-bar summary-panel__profile-bar--foundation';
    foundationBar.style.width = `${ratio.foundationPercentage}%`;
    foundationBar.setAttribute('aria-label', `Foundation: ${ratio.foundationPercentage}%`);

    const optionalBar = document.createElement('div');
    optionalBar.className = 'summary-panel__profile-bar summary-panel__profile-bar--optional';
    optionalBar.style.width = `${ratio.optionalPercentage}%`;
    optionalBar.setAttribute('aria-label', `Optional: ${ratio.optionalPercentage}%`);

    barContainer.appendChild(foundationBar);
    barContainer.appendChild(optionalBar);
    content.appendChild(barContainer);

    // Legend
    const legend = document.createElement('div');
    legend.className = 'summary-panel__profile-legend';
    legend.innerHTML = `
      <div class="summary-panel__profile-legend-item">
        <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--foundation"></span>
        <span>Foundation: ${ratio.foundationCount} (${ratio.foundationPercentage}%)</span>
      </div>
      <div class="summary-panel__profile-legend-item">
        <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--optional"></span>
        <span>Optional: ${ratio.optionalCount} (${ratio.optionalPercentage}%)</span>
      </div>
    `;
    content.appendChild(legend);

    // Total count
    const total = document.createElement('div');
    total.className = 'summary-panel__profile-total';
    total.textContent = `Total Active: ${ratio.totalActive}`;
    content.appendChild(total);
  }

  section.appendChild(content);
  return section;
}

/**
 * Format profile label for display
 * @param {string} profile - Profile classification
 * @returns {string} Human-readable label
 */
#formatProfileLabel(profile) {
  const labels = {
    'foundation-heavy': 'Foundation Heavy',
    'content-heavy': 'Content Heavy',
    'balanced': 'Balanced'
  };
  return labels[profile] || profile;
}
```

### CSS Updates

In `css/mod-manager.css`:

```css
/* Profile Section */
.summary-panel__profile-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.summary-panel__profile-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 1rem;
  font-size: 0.75rem;
  font-weight: bold;
  text-transform: uppercase;
  text-align: center;
  align-self: center;
}

.summary-panel__profile-badge--foundation-heavy {
  background-color: var(--color-foundation, #2a5a8a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-badge--content-heavy {
  background-color: var(--color-optional, #8a5a2a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-badge--balanced {
  background-color: var(--color-balanced, #5a8a5a);
  color: var(--text-light, #fff);
}

.summary-panel__profile-bar-container {
  display: flex;
  height: 1.5rem;
  border-radius: 0.25rem;
  overflow: hidden;
  background-color: var(--bg-tertiary, #333);
}

.summary-panel__profile-bar {
  height: 100%;
  transition: width 0.3s ease;
}

.summary-panel__profile-bar--foundation {
  background-color: var(--color-foundation, #2a5a8a);
}

.summary-panel__profile-bar--optional {
  background-color: var(--color-optional, #8a5a2a);
}

.summary-panel__profile-legend {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.75rem;
}

.summary-panel__profile-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.summary-panel__profile-legend-color {
  width: 0.75rem;
  height: 0.75rem;
  border-radius: 0.125rem;
}

.summary-panel__profile-legend-color--foundation {
  background-color: var(--color-foundation, #2a5a8a);
}

.summary-panel__profile-legend-color--optional {
  background-color: var(--color-optional, #8a5a2a);
}

.summary-panel__profile-total {
  font-size: 0.8125rem;
  color: var(--text-secondary, #aaa);
  text-align: center;
  padding-top: 0.5rem;
  border-top: 1px solid var(--border-color, #444);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Profile badge display**
   - Shows correct badge for 'foundation-heavy'
   - Shows correct badge for 'content-heavy'
   - Shows correct badge for 'balanced'

2. **Bar visualization**
   - Foundation bar width matches percentage
   - Optional bar width matches percentage
   - Bars have correct aria-labels

3. **Legend and counts**
   - Shows foundation count and percentage
   - Shows optional count and percentage
   - Shows total active count

4. **Edge cases**
   - Empty message when no active mods
   - Handles 0% foundation correctly
   - Handles 100% foundation correctly

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. BEM naming convention maintained
3. Accessibility attributes present (aria-label on bars)
4. Consistent styling with other sections

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
# Open mod manager UI and verify profile section renders correctly
# Check bar proportions and badge styling
```

---

## Test Cases to Add

```javascript
describe('Configuration Profile Section', () => {
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
      getCoreOptionalRatio: jest.fn(),
      invalidateCache: jest.fn(),
    };
  });

  it('should display foundation-heavy badge correctly', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 8,
      optionalCount: 2,
      totalActive: 10,
      foundationPercentage: 80,
      optionalPercentage: 20,
      foundationMods: ['core', 'anatomy', 'positioning'],
      profile: 'foundation-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const badge = container.querySelector('.summary-panel__profile-badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe('Foundation Heavy');
    expect(badge.classList.contains('summary-panel__profile-badge--foundation-heavy')).toBe(true);
  });

  it('should display content-heavy badge correctly', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 2,
      optionalCount: 8,
      totalActive: 10,
      foundationPercentage: 20,
      optionalPercentage: 80,
      foundationMods: ['core'],
      profile: 'content-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const badge = container.querySelector('.summary-panel__profile-badge');
    expect(badge.textContent).toBe('Content Heavy');
    expect(badge.classList.contains('summary-panel__profile-badge--content-heavy')).toBe(true);
  });

  it('should display balanced badge correctly', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 5,
      optionalCount: 5,
      totalActive: 10,
      foundationPercentage: 50,
      optionalPercentage: 50,
      foundationMods: ['core', 'anatomy'],
      profile: 'balanced'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const badge = container.querySelector('.summary-panel__profile-badge');
    expect(badge.textContent).toBe('Balanced');
    expect(badge.classList.contains('summary-panel__profile-badge--balanced')).toBe(true);
  });

  it('should render bar visualization with correct widths', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 7,
      optionalCount: 3,
      totalActive: 10,
      foundationPercentage: 70,
      optionalPercentage: 30,
      foundationMods: [],
      profile: 'foundation-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const foundationBar = container.querySelector('.summary-panel__profile-bar--foundation');
    const optionalBar = container.querySelector('.summary-panel__profile-bar--optional');

    expect(foundationBar.style.width).toBe('70%');
    expect(optionalBar.style.width).toBe('30%');
  });

  it('should have accessible aria-labels on bars', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 6,
      optionalCount: 4,
      totalActive: 10,
      foundationPercentage: 60,
      optionalPercentage: 40,
      foundationMods: [],
      profile: 'foundation-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const foundationBar = container.querySelector('.summary-panel__profile-bar--foundation');
    const optionalBar = container.querySelector('.summary-panel__profile-bar--optional');

    expect(foundationBar.getAttribute('aria-label')).toBe('Foundation: 60%');
    expect(optionalBar.getAttribute('aria-label')).toBe('Optional: 40%');
  });

  it('should display legend with counts and percentages', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 4,
      optionalCount: 6,
      totalActive: 10,
      foundationPercentage: 40,
      optionalPercentage: 60,
      foundationMods: [],
      profile: 'content-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const legend = container.querySelector('.summary-panel__profile-legend');
    expect(legend.textContent).toContain('Foundation: 4 (40%)');
    expect(legend.textContent).toContain('Optional: 6 (60%)');
  });

  it('should display total active count', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 3,
      optionalCount: 7,
      totalActive: 10,
      foundationPercentage: 30,
      optionalPercentage: 70,
      foundationMods: [],
      profile: 'content-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const total = container.querySelector('.summary-panel__profile-total');
    expect(total.textContent).toBe('Total Active: 10');
  });

  it('should show empty message when no active mods', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 0,
      optionalCount: 0,
      totalActive: 0,
      foundationPercentage: 0,
      optionalPercentage: 0,
      foundationMods: [],
      profile: 'balanced'
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
    expect(emptyMessage.textContent).toBe('No active mods');
  });

  it('should handle 100% foundation correctly', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 5,
      optionalCount: 0,
      totalActive: 5,
      foundationPercentage: 100,
      optionalPercentage: 0,
      foundationMods: ['core', 'anatomy'],
      profile: 'foundation-heavy'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    const foundationBar = container.querySelector('.summary-panel__profile-bar--foundation');
    const optionalBar = container.querySelector('.summary-panel__profile-bar--optional');

    expect(foundationBar.style.width).toBe('100%');
    expect(optionalBar.style.width).toBe('0%');
  });

  it('should have correct BEM class structure', () => {
    mockModStatisticsService.getCoreOptionalRatio.mockReturnValue({
      foundationCount: 5,
      optionalCount: 5,
      totalActive: 10,
      foundationPercentage: 50,
      optionalPercentage: 50,
      foundationMods: [],
      profile: 'balanced'
    });

    const container = document.createElement('div');
    const view = new SummaryPanelView({
      container,
      modGraphService: mockModGraphService,
      modStatisticsService: mockModStatisticsService,
      logger: mockLogger,
    });

    view.render();

    expect(container.querySelector('.summary-panel__profile-content')).toBeTruthy();
    expect(container.querySelector('.summary-panel__profile-badge')).toBeTruthy();
    expect(container.querySelector('.summary-panel__profile-bar-container')).toBeTruthy();
    expect(container.querySelector('.summary-panel__profile-legend')).toBeTruthy();
    expect(container.querySelector('.summary-panel__profile-total')).toBeTruthy();
  });
});
```
