# MODMANIMP-013: ModListView

**Status:** Completed (2025-12-17)
**Priority:** Phase 5 (UI Components)
**Estimated Effort:** S (3-4 hours)
**Dependencies:** MODMANIMP-014 (ModCardComponent)

---

## Objective

Create a view component that renders the scrollable list of mod cards. This component manages the container, coordinates with `ModCardComponent` for individual mod rendering, and avoids full re-render when only card state changes.

**Note:** Despite the original ticket text, this repo’s current Mod Manager MVP does not implement true virtual scrolling; this ticket focuses on DOM batching (`DocumentFragment`) plus “update-in-place” behavior.

---

## Files to Touch

### New Files

- `src/modManager/views/ModListView.js`
- `tests/unit/modManager/views/ModListView.test.js`

---

## Out of Scope

**DO NOT modify:**

- ModCardComponent (use as dependency)
- ModManagerController (receives callbacks from it)
- CSS files (MODMANIMP-005 provides styles)
- Search/filter logic (controller handles that)
- Individual mod state management

---

## Implementation Details

### View Class

```javascript
// src/modManager/views/ModListView.js
/**
 * @file View component for rendering the mod list
 * @see src/domUI/components/SpeechBubbleContainer.js
 */

/**
 * @typedef {Object} ModListViewOptions
 * @property {HTMLElement} container - Container element
 * @property {Object} logger - Logger instance
 * @property {(modId: string) => void} onModToggle - Callback for mod toggle
 * @property {{createCard: Function, updateCardState: Function}} modCardComponent - Card renderer (see MODMANIMP-014)
 */

/**
 * View for displaying the scrollable mod list
 */
export class ModListView {
  #container;
  #logger;
  #onModToggle;
  #modCardComponent;
  #listElement;
  #loadingElement;
  #emptyElement;
  #currentMods;

  /**
   * @param {ModListViewOptions} options
   */
  constructor({ container, logger, onModToggle, modCardComponent }) {
    this.#container = container;
    this.#logger = logger;
    this.#onModToggle = onModToggle;
    this.#modCardComponent = modCardComponent;
    this.#currentMods = [];

    this.#createStructure();
    this.#bindEvents();
  }

  /**
   * Create the list structure
   */
  #createStructure() {
    this.#container.innerHTML = '';

    // Loading indicator
    this.#loadingElement = document.createElement('div');
    this.#loadingElement.className = 'mod-list__loading';
    this.#loadingElement.setAttribute('role', 'status');
    this.#loadingElement.setAttribute('aria-live', 'polite');
    this.#loadingElement.innerHTML = `
      <span class="spinner" aria-hidden="true"></span>
      <span>Loading mods...</span>
    `;
    this.#loadingElement.hidden = true;

    // Empty state
    this.#emptyElement = document.createElement('div');
    this.#emptyElement.className = 'mod-list__empty';
    this.#emptyElement.setAttribute('role', 'status');
    this.#emptyElement.innerHTML = `
      <p>No mods found matching your criteria.</p>
    `;
    this.#emptyElement.hidden = true;

    // Main list container
    this.#listElement = document.createElement('div');
    this.#listElement.className = 'mod-list';
    this.#listElement.setAttribute('role', 'list');
    this.#listElement.setAttribute('aria-label', 'Available mods');

    this.#container.appendChild(this.#loadingElement);
    this.#container.appendChild(this.#emptyElement);
    this.#container.appendChild(this.#listElement);
  }

  /**
   * Bind event delegation for mod cards
   */
  #bindEvents() {
    this.#listElement.addEventListener('click', (event) => {
      const card = event.target.closest('[data-mod-id]');
      if (!card) return;

      const modId = card.dataset.modId;
      const checkbox = event.target.closest('.mod-card__checkbox');
      const isCheckbox = Boolean(checkbox);
      const isLocked = card.classList.contains('mod-card--locked');

      // Respect disabled states (core/locked and dependency-locked cards).
      if (isCheckbox && !isLocked && !checkbox.disabled) {
        this.#onModToggle(modId);
      }
    });

    // Keyboard support
    this.#listElement.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;

      const card = event.target.closest('[data-mod-id]');
      if (!card) return;

      const isLocked = card.classList.contains('mod-card--locked');
      const checkbox = card.querySelector('.mod-card__checkbox');
      if (!isLocked && checkbox && !checkbox.disabled) {
        event.preventDefault();
        this.#onModToggle(card.dataset.modId);
      }
    });
  }

  /**
   * Render the mod list
   * @param {Object} options
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} options.mods
   * @param {(modId: string) => {status: string, isExplicit: boolean, isDependency: boolean}} options.getModDisplayInfo
   * @param {boolean} options.isLoading
   */
  render({ mods, getModDisplayInfo, isLoading }) {
    // Handle loading state
    this.#loadingElement.hidden = !isLoading;
    this.#listElement.hidden = isLoading;
    this.#emptyElement.hidden = true;

    if (isLoading) {
      return;
    }

    // Handle empty state
    if (mods.length === 0) {
      this.#emptyElement.hidden = false;
      this.#listElement.hidden = true;
      return;
    }

    this.#emptyElement.hidden = true;
    this.#listElement.hidden = false;

    // Optimize: only re-render if mods changed
    const modsChanged = this.#hasModsChanged(mods);
    if (!modsChanged) {
      // Just update card states without full re-render
      this.#updateCardStates(getModDisplayInfo);
      return;
    }

    this.#currentMods = mods.map((m) => m.id);
    this.#renderMods(mods, getModDisplayInfo);
  }

  /**
   * Check if mod list has changed
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods
   * @returns {boolean}
   */
  #hasModsChanged(mods) {
    if (mods.length !== this.#currentMods.length) return true;
    return !mods.every((m, i) => m.id === this.#currentMods[i]);
  }

  /**
   * Update card states without re-rendering
   * @param {(modId: string) => {status: string, isExplicit: boolean, isDependency: boolean}} getModDisplayInfo
   */
  #updateCardStates(getModDisplayInfo) {
    const cards = this.#listElement.querySelectorAll('[data-mod-id]');
    for (const card of cards) {
      const modId = card.dataset.modId;
      const displayInfo = getModDisplayInfo(modId);
      this.#modCardComponent.updateCardState(card, displayInfo);
    }
  }

  /**
   * Render all mod cards
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods
   * @param {(modId: string) => {status: string, isExplicit: boolean, isDependency: boolean}} getModDisplayInfo
   */
  #renderMods(mods, getModDisplayInfo) {
    // Use DocumentFragment for performance
    const fragment = document.createDocumentFragment();

    for (const mod of mods) {
      const displayInfo = getModDisplayInfo(mod.id);
      const card = this.#modCardComponent.createCard(mod, displayInfo);
      fragment.appendChild(card);
    }

    this.#listElement.innerHTML = '';
    this.#listElement.appendChild(fragment);

    this.#logger.debug(`Rendered ${mods.length} mod cards`);
  }

  /**
   * Highlight a specific mod card (for cascade animation)
   * @param {string} modId
   * @param {'activating'|'deactivating'} type
   */
  highlightMod(modId, type) {
    const card = this.#listElement.querySelector(`[data-mod-id="${modId}"]`);
    if (!card) return;

    card.classList.add(`mod-card--${type}`);
    // Animation cleanup handled by CSS animationend
    card.addEventListener(
      'animationend',
      () => {
        card.classList.remove(`mod-card--${type}`);
      },
      { once: true }
    );
  }

  /**
   * Scroll a mod card into view
   * @param {string} modId
   */
  scrollToMod(modId) {
    const card = this.#listElement.querySelector(`[data-mod-id="${modId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /**
   * Set empty state message
   * @param {string} message
   */
  setEmptyMessage(message) {
    this.#emptyElement.innerHTML = `<p>${message}</p>`;
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.#container.innerHTML = '';
    this.#currentMods = [];
  }
}

export default ModListView;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`ModListView.test.js`):
   - `render displays loading state when isLoading is true`
   - `render displays empty state when no mods`
   - `render creates cards for all mods`
   - `render uses DocumentFragment for performance`
   - `render updates card states without full re-render when only states change`
   - `click on checkbox triggers onModToggle callback`
   - `click on locked card does not trigger callback`
   - `click on disabled checkbox does not trigger callback`
   - `keyboard Enter triggers mod toggle`
   - `keyboard Enter does not toggle when checkbox is disabled`
   - `highlightMod adds animation class`
   - `scrollToMod scrolls card into view`
   - `destroy cleans up container`

   Recommended focused run:
   ```bash
   npm run test:single -- tests/unit/modManager/views/ModListView.test.js
   ```

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/views/ModListView.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

   **Repo Note (as of current baseline):** `npm run typecheck` currently fails due to pre-existing TypeScript/JSDoc issues outside `src/modManager/` (primarily under `cli/` and `src/validation/`). This ticket does not attempt to fix repo-wide typecheck; instead, it gates on the unit tests listed here plus scoped ESLint on the touched files.

4. **Event delegation pattern:**
   ```bash
   grep -q "addEventListener.*click" src/modManager/views/ModListView.js && \
   grep -q "closest.*data-mod-id" src/modManager/views/ModListView.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. Uses event delegation (single listener on container)
2. DocumentFragment used for batch DOM insertion
3. Card state updates optimized (no re-render if only states change)
4. Proper ARIA attributes for accessibility
5. Loading and empty states are mutually exclusive
6. Locked cards cannot be toggled
7. Disabled cards (core/dependency) cannot be toggled via keyboard
8. Keyboard navigation supported

---

## Reference Files

- Component pattern: `src/domUI/components/SpeechBubbleContainer.js`
- Event delegation: `src/domUI/ActionButtonsRenderer.js`
- DOM optimization: `src/domUI/HistoryRenderer.js`

---

## Outcome

- Implemented `src/modManager/views/ModListView.js` and unit tests in `tests/unit/modManager/views/ModListView.test.js`.
- Tightened the interaction contract vs the original plan: click toggling only fires for enabled checkboxes, and keyboard toggling is prevented when the card’s checkbox is disabled (dependency/core behavior).
- Adjusted scope/assumptions: no true virtual scrolling in this MVP ticket; repo-wide `npm run typecheck` currently fails due to pre-existing issues outside `src/modManager/`, so this ticket gates on focused unit tests + scoped ESLint instead.
