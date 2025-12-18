# MODMANSTAENH-006: Dependency Health UI Section

**Status:** Completed
**Priority:** High (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** MODMANSTAENH-003
**Parent:** MODMANSTAENH-000
**Completed:** 2025-12-18

---

## Objective

Add a "Dependency Health" section to SummaryPanelView that displays health status indicators from `ModStatisticsService.getHealthStatus()`, showing checkmarks for healthy states, warnings, and errors.

---

## Architecture Note (Corrected Assumption)

**IMPORTANT:** `SummaryPanelView` follows a **data-driven pattern**:
- Constructor receives only `{container, logger, onSave}` - NOT service references
- All display data is passed via `render()` method parameters
- `ModManagerBootstrap.#renderUI()` is responsible for:
  1. Calling `modStatisticsService.getHealthStatus()`
  2. Passing the result as `healthStatus` parameter to `render()`

This matches the existing pattern for `hotspots` which is fetched in Bootstrap and passed to render.

---

## Files to Touch

### Modified Files
- `src/modManager/ModManagerBootstrap.js` (add healthStatus to render call)
- `src/modManager/views/SummaryPanelView.js` (add health section rendering)
- `css/mod-manager.css` (add health styling)
- `tests/unit/modManager/views/SummaryPanelView.test.js` (add tests)

---

## Out of Scope

**DO NOT modify:**
- `src/modManager/services/ModStatisticsService.js` - use existing API only
- `src/modManager/services/ModGraphService.js` - no direct access
- `src/modManager/controllers/ModManagerController.js` - already has service
- Hotspots UI (MODMANSTAENH-005)
- Any calculation logic (handled by service)

---

## Implementation Details

### Step 1: ModManagerBootstrap.js Changes

In `#renderUI()` method, add health status fetching:

```javascript
// Get dependency hotspots from statistics service
const modStatisticsService = this.#container.get('modStatisticsService');
const hotspots = modStatisticsService.getDependencyHotspots(5);
const healthStatus = modStatisticsService.getHealthStatus();  // ADD THIS

this.#summaryPanelView.render({
  loadOrder: state.resolvedMods || [],
  activeCount: (state.resolvedMods || []).length,
  explicitCount,
  dependencyCount,
  hotspots,
  healthStatus,  // ADD THIS
  hasUnsavedChanges: state.hasUnsavedChanges,
  isSaving: state.isSaving,
  isLoading: state.isLoading,
});
```

### Step 2: SummaryPanelView.js Changes

**Add private field:**
```javascript
#healthSection;
```

**Update render() signature to accept healthStatus:**
```javascript
render({
  loadOrder,
  activeCount,
  explicitCount = 0,
  dependencyCount = 0,
  hotspots = [],
  healthStatus = null,  // NEW - default null for backward compatibility
  hasUnsavedChanges,
  isSaving,
  isLoading,
})
```

**Add in #createStructure():**
```javascript
// Health section (placeholder - content rendered dynamically)
this.#healthSection = document.createElement('section');
this.#healthSection.className =
  'summary-panel__section summary-panel__section--collapsible';
this.#healthSection.setAttribute('aria-label', 'Dependency health');
```

**Add in render() method:**
```javascript
// Update health section
this.#renderHealthSection(healthStatus);
```

**Add new private method:**
```javascript
/**
 * Render dependency health section
 * @param {object|null} healthStatus - Health status from ModStatisticsService
 */
#renderHealthSection(healthStatus) {
  this.#healthSection.innerHTML = '';

  if (!healthStatus) {
    this.#healthSection.hidden = true;
    return;
  }
  this.#healthSection.hidden = false;

  // Section header (collapsible button)
  const header = document.createElement('button');
  header.className = 'summary-panel__section-header';
  header.type = 'button';
  header.setAttribute('aria-expanded', 'true');

  // Determine overall status for header styling
  const hasErrors = healthStatus.errors?.length > 0;
  const hasWarnings = healthStatus.warnings?.length > 0;
  if (hasErrors) {
    header.classList.add('summary-panel__section-header--error');
  } else if (hasWarnings) {
    header.classList.add('summary-panel__section-header--warning');
  }

  header.innerHTML = `
    <span class="summary-panel__section-title">Dependency Health</span>
    <span class="summary-panel__section-toggle" aria-hidden="true">▼</span>
  `;

  // Section content
  const content = document.createElement('div');
  content.className = 'summary-panel__section-content';

  const statusList = document.createElement('ul');
  statusList.className = 'summary-panel__health-list';

  // Circular dependencies status
  statusList.appendChild(this.#createHealthItem(
    !healthStatus.hasCircularDeps,
    'No circular dependencies'
  ));

  // Missing dependencies status
  const missingDeps = healthStatus.missingDeps || [];
  statusList.appendChild(this.#createHealthItem(
    missingDeps.length === 0,
    missingDeps.length === 0
      ? 'All dependencies resolved'
      : `Missing: ${missingDeps.map(d => this.#escapeHtml(d)).join(', ')}`
  ));

  // Load order status
  statusList.appendChild(this.#createHealthItem(
    healthStatus.loadOrderValid,
    'Load order is valid'
  ));

  content.appendChild(statusList);

  // Show errors and warnings if any
  const errors = healthStatus.errors || [];
  const warnings = healthStatus.warnings || [];
  if (errors.length > 0 || warnings.length > 0) {
    const messagesDiv = document.createElement('div');
    messagesDiv.className = 'summary-panel__health-messages';

    for (const error of errors) {
      const errorEl = document.createElement('p');
      errorEl.className = 'summary-panel__health-error';
      errorEl.textContent = error;
      messagesDiv.appendChild(errorEl);
    }

    for (const warning of warnings) {
      const warningEl = document.createElement('p');
      warningEl.className = 'summary-panel__health-warning';
      warningEl.textContent = warning;
      messagesDiv.appendChild(warningEl);
    }

    content.appendChild(messagesDiv);
  }

  // Summary counts
  const summary = document.createElement('div');
  summary.className = 'summary-panel__health-summary';
  summary.innerHTML = `
    <span>Warnings: ${warnings.length}</span>
    <span>Errors: ${errors.length}</span>
  `;
  content.appendChild(summary);

  // Toggle behavior
  header.addEventListener('click', () => {
    const isExpanded = header.getAttribute('aria-expanded') === 'true';
    header.setAttribute('aria-expanded', String(!isExpanded));
    content.classList.toggle('summary-panel__section-content--collapsed');
    const toggle = header.querySelector('.summary-panel__section-toggle');
    if (toggle) {
      toggle.textContent = isExpanded ? '▶' : '▼';
    }
  });

  this.#healthSection.appendChild(header);
  this.#healthSection.appendChild(content);
}

/**
 * Create a health status list item
 * @param {boolean} isHealthy - Whether this check passes
 * @param {string} message - Status message (already escaped if needed)
 * @returns {HTMLElement}
 */
#createHealthItem(isHealthy, message) {
  const item = document.createElement('li');
  item.className = `summary-panel__health-item ${isHealthy ? 'summary-panel__health-item--ok' : 'summary-panel__health-item--fail'}`;

  const icon = document.createElement('span');
  icon.className = 'summary-panel__health-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = isHealthy ? '✓' : '✗';

  const messageEl = document.createElement('span');
  messageEl.className = 'summary-panel__health-message';
  messageEl.innerHTML = message; // Already escaped where needed

  item.appendChild(icon);
  item.appendChild(messageEl);
  return item;
}
```

### Step 3: CSS Updates

In `css/mod-manager.css`:

```css
/* Health Section */
.summary-panel__section-header--error {
  border-left: 3px solid var(--color-error, #f44);
}

.summary-panel__section-header--warning {
  border-left: 3px solid var(--color-warning, #fa0);
}

.summary-panel__health-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.summary-panel__health-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  font-size: 0.8125rem;
}

.summary-panel__health-icon {
  font-weight: bold;
  width: 1rem;
  text-align: center;
}

.summary-panel__health-item--ok .summary-panel__health-icon {
  color: var(--color-success, #4f4);
}

.summary-panel__health-item--fail .summary-panel__health-icon {
  color: var(--color-error, #f44);
}

.summary-panel__health-messages {
  margin-top: 0.5rem;
  padding: 0.5rem;
  background: var(--bg-tertiary, #1a1a1a);
  border-radius: 4px;
}

.summary-panel__health-error {
  color: var(--color-error, #f44);
  font-size: 0.75rem;
  margin: 0.25rem 0;
}

.summary-panel__health-warning {
  color: var(--color-warning, #fa0);
  font-size: 0.75rem;
  margin: 0.25rem 0;
}

.summary-panel__health-summary {
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

1. **Healthy configuration display**
   - Shows checkmarks for all healthy states
   - No error/warning messages displayed
   - Summary shows 0 warnings, 0 errors

2. **Error display**
   - Shows X marks for failing states
   - Displays error messages
   - Header has error styling

3. **Warning display**
   - Displays warning messages
   - Header has warning styling when no errors
   - Summary shows warning count

4. **Missing dependencies**
   - Lists missing mod IDs
   - Shows failure indicator

5. **Collapsible behavior**
   - Section is collapsible
   - Maintains expanded state correctly

6. **Backward compatibility**
   - healthStatus defaults to null
   - Section hidden when healthStatus is null

7. **XSS prevention**
   - HTML in messages is escaped

### Invariants That Must Remain True

1. Existing SummaryPanelView tests still pass
2. BEM naming convention maintained
3. Accessibility attributes present
4. Color contrast meets WCAG AA

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
# Open mod manager UI and verify health section renders correctly
# Test with both healthy and unhealthy configurations
```

---

## Test Cases to Add

```javascript
describe('Dependency Health Section', () => {
  let container;
  let mockLogger;
  let mockOnSave;

  beforeEach(() => {
    container = document.createElement('div');
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    mockOnSave = jest.fn().mockResolvedValue();
  });

  it('should render healthy configuration with checkmarks', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: [],
        errors: []
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const healthItems = container.querySelectorAll('.summary-panel__health-item--ok');
    expect(healthItems).toHaveLength(3);

    const failItems = container.querySelectorAll('.summary-panel__health-item--fail');
    expect(failItems).toHaveLength(0);
  });

  it('should display missing dependencies', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: ['missing-mod-1', 'missing-mod-2'],
        loadOrderValid: true,
        warnings: [],
        errors: ["Missing dependency: 'missing-mod-1'"]
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const healthMessage = container.querySelector('.summary-panel__health-item--fail .summary-panel__health-message');
    expect(healthMessage.textContent).toContain('missing-mod-1');
  });

  it('should show error messages', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: true,
        missingDeps: [],
        loadOrderValid: false,
        warnings: [],
        errors: ['Circular dependency detected', 'Load order computation failed']
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const errorMessages = container.querySelectorAll('.summary-panel__health-error');
    expect(errorMessages).toHaveLength(2);
  });

  it('should show warning messages', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: ['Load order is empty'],
        errors: []
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const warningMessages = container.querySelectorAll('.summary-panel__health-warning');
    expect(warningMessages).toHaveLength(1);
  });

  it('should add error class to header when errors exist', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: true,
        missingDeps: [],
        loadOrderValid: false,
        warnings: [],
        errors: ['Error message']
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const header = container.querySelector('.summary-panel__section-header--error');
    expect(header).toBeTruthy();
  });

  it('should add warning class to header when warnings and no errors', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: ['Some warning'],
        errors: []
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const header = container.querySelector('.summary-panel__section-header--warning');
    expect(header).toBeTruthy();
  });

  it('should show summary counts', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: ['warning1', 'warning2'],
        errors: ['error1']
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const summary = container.querySelector('.summary-panel__health-summary');
    expect(summary.textContent).toContain('Warnings: 2');
    expect(summary.textContent).toContain('Errors: 1');
  });

  it('should toggle section on header click', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: [],
        loadOrderValid: true,
        warnings: [],
        errors: []
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    // Find health section header (second collapsible section after hotspots)
    const headers = container.querySelectorAll('.summary-panel__section-header');
    const healthHeader = Array.from(headers).find(h =>
      h.textContent.includes('Dependency Health')
    );

    expect(healthHeader.getAttribute('aria-expanded')).toBe('true');

    healthHeader.click();
    expect(healthHeader.getAttribute('aria-expanded')).toBe('false');

    healthHeader.click();
    expect(healthHeader.getAttribute('aria-expanded')).toBe('true');
  });

  it('should default to null healthStatus (backward compatibility)', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    // Render without healthStatus
    view.render({
      loadOrder: ['core'],
      activeCount: 1,
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    // Health section should be hidden or empty
    const healthSection = container.querySelector('[aria-label="Dependency health"]');
    expect(healthSection.hidden || healthSection.children.length === 0).toBe(true);
  });

  it('should escape HTML in messages to prevent XSS', () => {
    const view = new SummaryPanelView({
      container,
      logger: mockLogger,
      onSave: mockOnSave,
    });

    view.render({
      loadOrder: [],
      activeCount: 0,
      healthStatus: {
        hasCircularDeps: false,
        missingDeps: ['<script>alert("xss")</script>'],
        loadOrderValid: true,
        warnings: [],
        errors: []
      },
      hasUnsavedChanges: false,
      isSaving: false,
      isLoading: false,
    });

    const healthMessage = container.querySelector('.summary-panel__health-item--fail .summary-panel__health-message');
    expect(healthMessage.innerHTML).not.toContain('<script>');
    expect(healthMessage.textContent).toContain('<script>');
  });
});
```

---

## Outcome

### Summary

Successfully implemented the Dependency Health UI section in the Mod Manager's Summary Panel. The feature displays health status indicators with checkmarks for healthy states, X marks for failures, and color-coded warnings/errors.

### Key Implementation Changes

1. **Fixed Constructor API Assumption**: Original ticket assumed `SummaryPanelView` receives `modStatisticsService` in constructor. Corrected to follow the existing data-driven pattern where all display data is passed via `render()` parameters.

2. **Files Modified**:
   - `src/modManager/ModManagerBootstrap.js` - Added `getHealthStatus()` call and passes `healthStatus` to `render()`
   - `src/modManager/views/SummaryPanelView.js` - Added `#healthSection` field, `#renderHealthSection()` and `#createHealthItem()` methods
   - `css/mod-manager.css` - Added health section styling (error/warning headers, health list, messages, summary)
   - `tests/unit/modManager/views/SummaryPanelView.test.js` - Added 12 new test cases
   - `tests/integration/modManager/modManagerUIRendering.integration.test.js` - Updated mock to include `getHealthStatus()`

3. **XSS Prevention**: Uses `textContent` for error/warning messages (inherently XSS-safe). Uses `#escapeHtml()` only where HTML is being set via `innerHTML` (e.g., missing deps list).

### Test Results

- **SummaryPanelView unit tests**: 54 passed
- **ModManagerBootstrap unit tests**: 21 passed
- **ModStatisticsService unit tests**: 27 passed
- **ModManager integration tests**: 55 passed

### Architectural Pattern Preserved

The implementation follows the established data-driven view pattern:
- Bootstrap fetches data from services
- Bootstrap passes data as parameters to `render()`
- View renders without direct service access

This maintains consistency with the existing `hotspots` parameter pattern.
