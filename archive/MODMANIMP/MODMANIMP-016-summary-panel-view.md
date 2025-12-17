# MODMANIMP-016: SummaryPanelView

**Status:** Completed
**Priority:** Phase 5 (UI Components)
**Estimated Effort:** S (2-3 hours)
**Dependencies:** None (CSS included in this ticket)

---

## Objective

Create a view component for the right-side summary panel that displays load order, active mod count, and the save button. This panel provides at-a-glance information about the current configuration.

---

## Files to Touch

### New Files

- `src/modManager/views/SummaryPanelView.js`
- `tests/unit/modManager/views/SummaryPanelView.test.js`

### Modified Files

- `css/mod-manager.css` - Add BEM classes for summary panel components

---

## Out of Scope

**DO NOT modify:**

- ModManagerController (receives callbacks from it)
- ConfigPersistenceService (controller handles saving)
- Save animation logic (MODMANIMP-023 handles that)
- Load order calculation (ModGraphService handles that)

---

## Implementation Details

### View Class

```javascript
// src/modManager/views/SummaryPanelView.js
/**
 * @file View component for the summary panel
 * @see src/domUI/panels/GameStatusPanel.js
 */

/**
 * @typedef {Object} SummaryPanelViewOptions
 * @property {HTMLElement} container - Container element
 * @property {Object} logger - Logger instance
 * @property {() => Promise<void>} onSave - Callback for save action
 */

/**
 * View for the configuration summary panel
 */
export class SummaryPanelView {
  #container;
  #logger;
  #onSave;
  #countElement;
  #loadOrderElement;
  #saveButton;
  #unsavedIndicator;

  /**
   * @param {SummaryPanelViewOptions} options
   */
  constructor({ container, logger, onSave }) {
    this.#container = container;
    this.#logger = logger;
    this.#onSave = onSave;

    this.#createStructure();
    this.#bindEvents();
  }

  /**
   * Create the panel structure
   */
  #createStructure() {
    this.#container.innerHTML = '';

    // Panel header
    const header = document.createElement('h2');
    header.className = 'summary-panel__title';
    header.textContent = 'Configuration Summary';

    // Stats section
    const statsSection = document.createElement('section');
    statsSection.className = 'summary-panel__stats';
    statsSection.setAttribute('aria-label', 'Mod statistics');

    this.#countElement = document.createElement('div');
    this.#countElement.className = 'summary-panel__stat';
    this.#countElement.innerHTML = `
      <span class="summary-panel__stat-label">Active Mods</span>
      <span class="summary-panel__stat-value" id="active-mod-count">0</span>
    `;

    statsSection.appendChild(this.#countElement);

    // Load order section
    const loadOrderSection = document.createElement('section');
    loadOrderSection.className = 'summary-panel__load-order';
    loadOrderSection.setAttribute('aria-label', 'Load order');

    const loadOrderHeader = document.createElement('h3');
    loadOrderHeader.className = 'summary-panel__section-title';
    loadOrderHeader.textContent = 'Load Order';

    this.#loadOrderElement = document.createElement('ol');
    this.#loadOrderElement.className = 'summary-panel__load-order-list';
    this.#loadOrderElement.setAttribute('aria-label', 'Mods will load in this order');

    loadOrderSection.appendChild(loadOrderHeader);
    loadOrderSection.appendChild(this.#loadOrderElement);

    // Save section
    const saveSection = document.createElement('section');
    saveSection.className = 'summary-panel__save';

    this.#unsavedIndicator = document.createElement('div');
    this.#unsavedIndicator.className = 'summary-panel__unsaved';
    this.#unsavedIndicator.setAttribute('role', 'status');
    this.#unsavedIndicator.setAttribute('aria-live', 'polite');
    this.#unsavedIndicator.innerHTML = `
      <span aria-hidden="true">⚠️</span>
      <span>You have unsaved changes</span>
    `;
    this.#unsavedIndicator.hidden = true;

    this.#saveButton = document.createElement('button');
    this.#saveButton.className = 'summary-panel__save-button';
    this.#saveButton.type = 'button';
    this.#saveButton.innerHTML = `
      <span class="save-button__icon" aria-hidden="true">💾</span>
      <span class="save-button__text">Save Configuration</span>
    `;
    this.#saveButton.disabled = true;

    saveSection.appendChild(this.#unsavedIndicator);
    saveSection.appendChild(this.#saveButton);

    // Assemble panel
    this.#container.appendChild(header);
    this.#container.appendChild(statsSection);
    this.#container.appendChild(loadOrderSection);
    this.#container.appendChild(saveSection);
  }

  /**
   * Bind event listeners
   */
  #bindEvents() {
    this.#saveButton.addEventListener('click', async () => {
      if (this.#saveButton.disabled) return;

      this.#setSaving(true);
      try {
        await this.#onSave();
      } finally {
        this.#setSaving(false);
      }
    });
  }

  /**
   * Render the summary panel
   * @param {Object} options
   * @param {string[]} options.loadOrder - Ordered list of mod IDs
   * @param {number} options.activeCount - Number of active mods
   * @param {boolean} options.hasUnsavedChanges
   * @param {boolean} options.isSaving
   * @param {boolean} options.isLoading
   */
  render({ loadOrder, activeCount, hasUnsavedChanges, isSaving, isLoading }) {
    // Update count
    const countValue = this.#countElement.querySelector('.summary-panel__stat-value');
    if (countValue) {
      countValue.textContent = String(activeCount);
    }

    // Update load order list
    this.#renderLoadOrder(loadOrder, isLoading);

    // Update unsaved indicator
    this.#unsavedIndicator.hidden = !hasUnsavedChanges || isSaving;

    // Update save button
    this.#saveButton.disabled = !hasUnsavedChanges || isSaving || isLoading;
    this.#setSaving(isSaving);
  }

  /**
   * Render the load order list
   * @param {string[]} loadOrder
   * @param {boolean} isLoading
   */
  #renderLoadOrder(loadOrder, isLoading) {
    if (isLoading) {
      this.#loadOrderElement.innerHTML = '<li class="summary-panel__loading">Loading...</li>';
      return;
    }

    if (loadOrder.length === 0) {
      this.#loadOrderElement.innerHTML = '<li class="summary-panel__empty">No mods active</li>';
      return;
    }

    this.#loadOrderElement.innerHTML = loadOrder
      .map((modId, index) => {
        const isCore = modId === 'core';
        const itemClass = isCore ? 'summary-panel__load-order-item summary-panel__load-order-item--core' : 'summary-panel__load-order-item';
        return `
          <li class="${itemClass}">
            <span class="load-order__number">${index + 1}</span>
            <span class="load-order__mod-id">${this.#escapeHtml(modId)}</span>
            ${isCore ? '<span class="load-order__badge" aria-label="Core mod">🔒</span>' : ''}
          </li>
        `;
      })
      .join('');
  }

  /**
   * Set saving state for button
   * @param {boolean} isSaving
   */
  #setSaving(isSaving) {
    const textElement = this.#saveButton.querySelector('.save-button__text');
    const iconElement = this.#saveButton.querySelector('.save-button__icon');

    if (isSaving) {
      this.#saveButton.classList.add('summary-panel__save-button--saving');
      this.#saveButton.setAttribute('aria-busy', 'true');
      if (textElement) textElement.textContent = 'Saving...';
      if (iconElement) iconElement.textContent = '⏳';
    } else {
      this.#saveButton.classList.remove('summary-panel__save-button--saving');
      this.#saveButton.removeAttribute('aria-busy');
      if (textElement) textElement.textContent = 'Save Configuration';
      if (iconElement) iconElement.textContent = '💾';
    }
  }

  /**
   * Show save success feedback
   */
  showSaveSuccess() {
    const textElement = this.#saveButton.querySelector('.save-button__text');
    const iconElement = this.#saveButton.querySelector('.save-button__icon');

    this.#saveButton.classList.add('summary-panel__save-button--success');
    if (textElement) textElement.textContent = 'Saved!';
    if (iconElement) iconElement.textContent = '✅';

    // Reset after delay
    setTimeout(() => {
      this.#saveButton.classList.remove('summary-panel__save-button--success');
      if (textElement) textElement.textContent = 'Save Configuration';
      if (iconElement) iconElement.textContent = '💾';
    }, 2000);
  }

  /**
   * Show save error feedback
   * @param {string} message
   */
  showSaveError(message) {
    const textElement = this.#saveButton.querySelector('.save-button__text');
    const iconElement = this.#saveButton.querySelector('.save-button__icon');

    this.#saveButton.classList.add('summary-panel__save-button--error');
    if (textElement) textElement.textContent = 'Save Failed';
    if (iconElement) iconElement.textContent = '❌';

    // Reset after delay
    setTimeout(() => {
      this.#saveButton.classList.remove('summary-panel__save-button--error');
      if (textElement) textElement.textContent = 'Save Configuration';
      if (iconElement) iconElement.textContent = '💾';
    }, 3000);

    this.#logger.error('Save error displayed', { message });
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} text
   * @returns {string}
   */
  #escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#container.innerHTML = '';
  }
}

export default SummaryPanelView;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`SummaryPanelView.test.js`):
   - `render displays active mod count`
   - `render displays load order as numbered list`
   - `render marks core mod with lock icon`
   - `render shows unsaved indicator when hasUnsavedChanges`
   - `render hides unsaved indicator when no changes`
   - `render disables save button when no unsaved changes`
   - `render disables save button when saving`
   - `render shows loading state for load order`
   - `save button click triggers onSave callback`
   - `setSaving updates button text and icon`
   - `showSaveSuccess displays success state temporarily`
   - `showSaveError displays error state temporarily`
   - `destroy cleans up container`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/views/SummaryPanelView.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **Save button structure:**
   ```bash
   grep -q "save-button__icon" src/modManager/views/SummaryPanelView.js && \
   grep -q "save-button__text" src/modManager/views/SummaryPanelView.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. Load order displayed as numbered list (1-indexed)
2. Core mod marked with lock icon in load order
3. Save button disabled when no unsaved changes
4. Save button shows loading state during save
5. Success/error feedback auto-dismisses after timeout
6. Unsaved indicator uses aria-live for screen readers
7. All text HTML-escaped for XSS prevention

---

## Reference Files

- Panel pattern: `src/modManager/views/ModListView.js`
- View structure: `src/modManager/views/WorldListView.js`
- Component pattern: `src/modManager/components/ModCardComponent.js`
- Test pattern: `tests/unit/modManager/views/ModListView.test.js`

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Ticket Corrections Made:**
1. Fixed reference files that didn't exist:
   - Original: `src/domUI/panels/GameStatusPanel.js`, `src/domUI/components/ActionButtonComponent.js`, `src/domUI/StatusDisplayRenderer.js`
   - Corrected to: `src/modManager/views/ModListView.js`, `src/modManager/views/WorldListView.js`, `src/modManager/components/ModCardComponent.js`

2. Updated dependencies: CSS was originally "out of scope (MODMANIMP-005)" but required CSS classes didn't exist. Changed to "None (CSS included in this ticket)".

**Implementation:**
- Created `src/modManager/views/SummaryPanelView.js` (285 lines) - matches ticket specification exactly
- Added ~160 lines of CSS to `css/mod-manager.css` for all BEM classes
- Created comprehensive test file with 25 tests (exceeds 13 acceptance criteria tests)

**Test Results:**
- All 25 unit tests pass
- ESLint: No errors (20 JSDoc style warnings - matches existing codebase patterns)
- TypeCheck: Same pre-existing issues as other modManager views (implicit 'any' for private fields)
- Save button structure: Verified ✓

**Additional Tests Beyond Acceptance Criteria:**
- Constructor validation tests (3 tests)
- `render disables save button when loading`
- `render shows empty state when no mods active`
- `render hides unsaved indicator when saving`
- `render enables save button when has unsaved changes and not saving or loading`
- `save button does not trigger callback when disabled`
- Structure creation tests (2 tests)
- Accessibility attributes tests
- XSS prevention tests
