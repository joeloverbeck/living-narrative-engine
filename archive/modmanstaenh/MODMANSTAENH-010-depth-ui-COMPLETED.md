# MODMANSTAENH-010: Dependency Depth UI Section

**Status:** Completed
**Priority:** Medium (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-007
**Parent:** MODMANSTAENH-000

---

## Objective

Add a collapsible "Dependency Depth" section to SummaryPanelView that displays dependency chain analysis from `ModStatisticsService.getDependencyDepthAnalysis()`, including max depth, average depth, and a visual representation of the deepest chain.

---

## Files to Touch

### Modified Files
- `src/modManager/views/SummaryPanelView.js` (add depth section)
- `src/modManager/ModManagerBootstrap.js` (pass depthAnalysis to render)
- `css/mod-manager.css` (add depth styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/controllers/ModManagerController.js` - already has service
- Footprint UI (MODMANSTAENH-011)
- Any calculation logic (handled by service)

**Architecture Note:**
SummaryPanelView does NOT have direct service access. Data flows as follows:
1. `ModManagerBootstrap` gets `modStatisticsService` from container
2. Calls `getDependencyDepthAnalysis()`
3. Passes result to `summaryPanelView.render({ depthAnalysis, ... })`

---

## Implementation Details

### Section Structure

```javascript
/**
 * Render dependency depth section
 * @param {Object} depthAnalysis - Depth analysis from ModStatisticsService
 * @param {number} depthAnalysis.maxDepth - Maximum dependency chain depth
 * @param {string[]} depthAnalysis.deepestChain - Mod IDs in deepest chain
 * @param {number} depthAnalysis.averageDepth - Average depth across all mods
 * @returns {HTMLElement}
 */
#renderDepthSection(depthAnalysis) {
  const section = document.createElement('section');
  section.className = 'summary-panel__section summary-panel__section--collapsible';

  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.setAttribute('aria-expanded', 'false'); // Start collapsed
  header.innerHTML = `
    <span class="summary-panel__section-title">Dependency Depth</span>
    <span class="summary-panel__section-toggle">▶</span>
  `;

  const content = document.createElement('div');
  content.className = 'summary-panel__section-content summary-panel__section-content--collapsed';

  if (!depthAnalysis || depthAnalysis.maxDepth === 0) {
    content.innerHTML = '<p class="summary-panel__empty">No active mods</p>';
  } else {
    // Stats summary
    const stats = document.createElement('div');
    stats.className = 'summary-panel__depth-stats';
    stats.innerHTML = `
      <div class="summary-panel__depth-stat">
        <span class="summary-panel__depth-value">${this.#escapeHtml(String(depthAnalysis.maxDepth))}</span>
        <span class="summary-panel__depth-label">Max Depth</span>
      </div>
      <div class="summary-panel__depth-stat">
        <span class="summary-panel__depth-value">${this.#escapeHtml(String(depthAnalysis.averageDepth))}</span>
        <span class="summary-panel__depth-label">Avg Depth</span>
      </div>
    `;
    content.appendChild(stats);

    // Deepest chain visualization
    if (depthAnalysis.deepestChain.length > 0) {
      const chainTitle = document.createElement('p');
      chainTitle.className = 'summary-panel__depth-chain-title';
      chainTitle.textContent = 'Deepest Chain:';
      content.appendChild(chainTitle);

      const chain = document.createElement('div');
      chain.className = 'summary-panel__depth-chain';

      for (let i = 0; i < depthAnalysis.deepestChain.length; i++) {
        const modId = depthAnalysis.deepestChain[i];
        const node = document.createElement('div');
        node.className = 'summary-panel__depth-chain-node';
        node.style.marginLeft = `${i * 1}rem`;
        node.innerHTML = `
          <span class="summary-panel__depth-chain-connector">${i > 0 ? '└─' : ''}</span>
          <span class="summary-panel__depth-chain-mod">${this.#escapeHtml(modId)}</span>
        `;
        chain.appendChild(node);
      }

      content.appendChild(chain);
    }
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
/* Depth Section */
.summary-panel__depth-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 0.75rem;
}

.summary-panel__depth-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-panel__depth-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: var(--text-primary, #fff);
}

.summary-panel__depth-label {
  font-size: 0.75rem;
  color: var(--text-secondary, #aaa);
}

.summary-panel__depth-chain-title {
  font-size: 0.8125rem;
  color: var(--text-secondary, #aaa);
  margin: 0.5rem 0 0.25rem 0;
}

.summary-panel__depth-chain {
  font-family: monospace;
  font-size: 0.75rem;
  line-height: 1.4;
}

.summary-panel__depth-chain-node {
  display: flex;
  align-items: center;
}

.summary-panel__depth-chain-connector {
  color: var(--text-muted, #666);
  margin-right: 0.25rem;
}

.summary-panel__depth-chain-mod {
  color: var(--text-primary, #fff);
}
```

---

## Acceptance Criteria

### Tests That Must Pass

```bash
NODE_ENV=test npx jest tests/unit/modManager/views/SummaryPanelView.test.js --no-coverage --verbose
```

### Specific Test Cases Required

1. **Stats display**
   - Shows max depth value
   - Shows average depth value
   - Empty message when no mods

2. **Chain visualization**
   - Displays deepest chain in correct order
   - Each node properly indented
   - Shows connector symbols

3. **Collapsible behavior**
   - Starts collapsed (unlike hotspots/health)
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
# Open mod manager UI and verify depth section renders correctly
# Check chain visualization and indentation
```

---

## Test Cases to Add

**Note:** Tests pass data via `render()` options, not via service mocks. The view receives data; it does not fetch it.

```javascript
describe('Dependency Depth Section', () => {
  let container;
  let mockLogger;
  let onSave;

  beforeEach(() => {
    container = document.createElement('div');
    mockLogger = { error: jest.fn() };
    onSave = jest.fn().mockResolvedValue(undefined);
  });

  const createView = () => {
    return new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave,
    });
  };

  const defaultRenderOptions = (depthOverrides = {}) => ({
    loadOrder: [],
    activeCount: 0,
    explicitCount: 0,
    dependencyCount: 0,
    hotspots: [],
    healthStatus: {
      hasCircularDeps: false,
      missingDeps: [],
      loadOrderValid: true,
      warnings: [],
      errors: [],
    },
    depthAnalysis: {
      maxDepth: 0,
      deepestChain: [],
      averageDepth: 0,
      ...depthOverrides,
    },
    hasUnsavedChanges: false,
    isSaving: false,
    isLoading: false,
  });

  it('should display max and average depth', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 5,
      deepestChain: ['mod-e', 'mod-d', 'mod-c', 'mod-b', 'mod-a'],
      averageDepth: 2.4,
    }));

    const depthValues = container.querySelectorAll('.summary-panel__depth-value');
    expect(depthValues[0].textContent).toBe('5');
    expect(depthValues[1].textContent).toBe('2.4');
  });

  it('should display deepest chain with correct nodes', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 3,
      deepestChain: ['leaf', 'middle', 'root'],
      averageDepth: 2,
    }));

    const chainNodes = container.querySelectorAll('.summary-panel__depth-chain-mod');
    expect(chainNodes).toHaveLength(3);
    expect(chainNodes[0].textContent).toBe('leaf');
    expect(chainNodes[1].textContent).toBe('middle');
    expect(chainNodes[2].textContent).toBe('root');
  });

  it('should show empty message when no mods', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 0,
      deepestChain: [],
      averageDepth: 0,
    }));

    // Find the depth section's empty message
    const sections = container.querySelectorAll('.summary-panel__section');
    const depthSection = Array.from(sections).find(s =>
      s.textContent.includes('Dependency Depth')
    );
    const emptyMessage = depthSection?.querySelector('.summary-panel__empty');

    expect(emptyMessage).toBeTruthy();
    expect(emptyMessage.textContent).toBe('No active mods');
  });

  it('should start collapsed', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 2,
      deepestChain: ['a', 'b'],
      averageDepth: 1.5,
    }));

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const depthHeader = Array.from(headers).find(h =>
      h.textContent.includes('Dependency Depth')
    );

    expect(depthHeader.getAttribute('aria-expanded')).toBe('false');
  });

  it('should toggle section on header click', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 2,
      deepestChain: ['a', 'b'],
      averageDepth: 1.5,
    }));

    const headers = container.querySelectorAll('.summary-panel__section-header');
    const depthHeader = Array.from(headers).find(h =>
      h.textContent.includes('Dependency Depth')
    );

    depthHeader.click();

    expect(depthHeader.getAttribute('aria-expanded')).toBe('true');
  });

  it('should have correct BEM class structure', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 2,
      deepestChain: ['a', 'b'],
      averageDepth: 1.5,
    }));

    expect(container.querySelector('.summary-panel__depth-stats')).toBeTruthy();
    expect(container.querySelector('.summary-panel__depth-stat')).toBeTruthy();
    expect(container.querySelector('.summary-panel__depth-value')).toBeTruthy();
    expect(container.querySelector('.summary-panel__depth-label')).toBeTruthy();
    expect(container.querySelector('.summary-panel__depth-chain')).toBeTruthy();
  });

  it('should escape HTML in chain mod IDs', () => {
    const view = createView();
    view.render(defaultRenderOptions({
      maxDepth: 1,
      deepestChain: ['<script>alert("xss")</script>'],
      averageDepth: 1,
    }));

    const chainMod = container.querySelector('.summary-panel__depth-chain-mod');
    expect(chainMod.innerHTML).not.toContain('<script>');
    expect(chainMod.textContent).toBe('<script>alert("xss")</script>');
  });
});
```

---

## Outcome

### Corrections Made to Ticket

Before implementation, three discrepancies were identified between the ticket assumptions and actual codebase:

1. **Data Flow Pattern**: The ticket assumed `#renderDepthSection()` would call `this.#modStatisticsService.getDependencyDepthAnalysis()` directly, but SummaryPanelView does NOT have service access. Data flows through `render()` options.
   - **Fix**: Changed to `#renderDepthSection(depthAnalysis)` receiving data as a parameter

2. **Test Mock Pattern**: The ticket's test examples used `modGraphService` and `modStatisticsService` mocks in the constructor, but SummaryPanelView only takes `{container, logger, onSave}`.
   - **Fix**: Rewrote tests to pass `depthAnalysis` data via `render()` options

3. **Collapsed Initial State**: Ticket specified `aria-expanded="false"` (collapsed by default), while existing sections (hotspots, health) start expanded.
   - **Kept as specified**: Depth section is less critical than health, so collapsed-by-default is intentional.

### Implementation Summary

| File | Changes |
|------|---------|
| `src/modManager/views/SummaryPanelView.js` | Added `#depthSection` field, section creation in `#createStructure()`, `#renderDepthSection()` method (~90 lines), updated `render()` JSDoc and signature |
| `src/modManager/ModManagerBootstrap.js` | Added `depthAnalysis` to render() call |
| `css/mod-manager.css` | Added depth section styles (~50 lines) |
| `tests/unit/modManager/views/SummaryPanelView.test.js` | Added 8 test cases for depth section |

### Test Results

- 62 SummaryPanelView tests pass (including 8 new depth section tests)
- 706 total modManager tests pass
- ESLint: 0 errors (warnings only for existing code)
