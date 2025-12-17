# MODMANIMP-017: Search/Filter UI

**Status:** Completed
**Priority:** Phase 6 (Features)
**Estimated Effort:** S (2-3 hours)
**Dependencies:** MODMANIMP-012 (Controller), MODMANIMP-013 (ModListView)

---

## Objective

Create the search input and filter controls for filtering the mod list. This includes a text search box, category filter buttons, and debounced input handling for performance.

---

## Files to Touch

### New Files

- `src/modManager/views/SearchFilterView.js`
- `tests/unit/modManager/views/SearchFilterView.test.js`

---

## Out of Scope

**DO NOT modify:**

- ModManagerController (it handles filter logic)
- ModListView (it receives filtered results)
- CSS files (styles from MODMANIMP-005)
- Filter logic implementation (controller handles that)
- Mod discovery or fetching logic

---

## Implementation Details

### View Class

```javascript
// src/modManager/views/SearchFilterView.js
/**
 * @file View component for search and filter controls
 * @see src/domUI/components/SearchInputComponent.js
 */

/**
 * @typedef {Object} SearchFilterViewOptions
 * @property {HTMLElement} container - Container element
 * @property {Object} logger - Logger instance
 * @property {(query: string) => void} onSearchChange - Search callback
 * @property {(category: 'all'|'active'|'inactive') => void} onFilterChange - Filter callback
 * @property {number} [debounceMs=300] - Debounce delay for search input
 */

/**
 * View for search and filter controls
 */
export class SearchFilterView {
  #container;
  #logger;
  #onSearchChange;
  #onFilterChange;
  #debounceMs;
  #searchInput;
  #filterButtons;
  #clearButton;
  #debounceTimer;

  /**
   * @param {SearchFilterViewOptions} options
   */
  constructor({ container, logger, onSearchChange, onFilterChange, debounceMs = 300 }) {
    this.#container = container;
    this.#logger = logger;
    this.#onSearchChange = onSearchChange;
    this.#onFilterChange = onFilterChange;
    this.#debounceMs = debounceMs;
    this.#filterButtons = new Map();
    this.#debounceTimer = null;

    this.#createStructure();
    this.#bindEvents();
  }

  /**
   * Create the control structure
   */
  #createStructure() {
    this.#container.innerHTML = '';

    // Search section
    const searchSection = document.createElement('div');
    searchSection.className = 'search-filter__search';

    const searchLabel = document.createElement('label');
    searchLabel.className = 'visually-hidden';
    searchLabel.setAttribute('for', 'mod-search');
    searchLabel.textContent = 'Search mods';

    this.#searchInput = document.createElement('input');
    this.#searchInput.type = 'search';
    this.#searchInput.id = 'mod-search';
    this.#searchInput.className = 'search-filter__input';
    this.#searchInput.placeholder = 'Search mods...';
    this.#searchInput.setAttribute('aria-label', 'Search mods by name or description');

    this.#clearButton = document.createElement('button');
    this.#clearButton.type = 'button';
    this.#clearButton.className = 'search-filter__clear';
    this.#clearButton.setAttribute('aria-label', 'Clear search');
    this.#clearButton.innerHTML = '<span aria-hidden="true">×</span>';
    this.#clearButton.hidden = true;

    searchSection.appendChild(searchLabel);
    searchSection.appendChild(this.#searchInput);
    searchSection.appendChild(this.#clearButton);

    // Filter section
    const filterSection = document.createElement('div');
    filterSection.className = 'search-filter__filters';
    filterSection.setAttribute('role', 'group');
    filterSection.setAttribute('aria-label', 'Filter mods by status');

    const filters = [
      { id: 'all', label: 'All', icon: '📋' },
      { id: 'active', label: 'Active', icon: '✅' },
      { id: 'inactive', label: 'Inactive', icon: '⬜' },
    ];

    for (const filter of filters) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-filter__filter-btn';
      button.dataset.filter = filter.id;
      button.setAttribute('aria-pressed', filter.id === 'all' ? 'true' : 'false');
      button.innerHTML = `
        <span class="filter-btn__icon" aria-hidden="true">${filter.icon}</span>
        <span class="filter-btn__label">${filter.label}</span>
      `;

      if (filter.id === 'all') {
        button.classList.add('search-filter__filter-btn--active');
      }

      this.#filterButtons.set(filter.id, button);
      filterSection.appendChild(button);
    }

    // Results count (updated externally)
    const resultsSection = document.createElement('div');
    resultsSection.className = 'search-filter__results';
    resultsSection.setAttribute('role', 'status');
    resultsSection.setAttribute('aria-live', 'polite');
    resultsSection.id = 'search-results-count';

    // Assemble
    this.#container.appendChild(searchSection);
    this.#container.appendChild(filterSection);
    this.#container.appendChild(resultsSection);
  }

  /**
   * Bind event listeners
   */
  #bindEvents() {
    // Search input with debounce
    this.#searchInput.addEventListener('input', (event) => {
      const value = event.target.value;
      this.#clearButton.hidden = value.length === 0;

      // Clear existing timer
      if (this.#debounceTimer) {
        clearTimeout(this.#debounceTimer);
      }

      // Set new timer
      this.#debounceTimer = setTimeout(() => {
        this.#onSearchChange(value);
      }, this.#debounceMs);
    });

    // Clear button
    this.#clearButton.addEventListener('click', () => {
      this.#searchInput.value = '';
      this.#clearButton.hidden = true;
      this.#onSearchChange('');
      this.#searchInput.focus();
    });

    // Search on Enter (immediate, no debounce)
    this.#searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        if (this.#debounceTimer) {
          clearTimeout(this.#debounceTimer);
        }
        this.#onSearchChange(this.#searchInput.value);
      }
      // Escape clears
      if (event.key === 'Escape') {
        this.#searchInput.value = '';
        this.#clearButton.hidden = true;
        this.#onSearchChange('');
      }
    });

    // Filter buttons
    for (const [filterId, button] of this.#filterButtons) {
      button.addEventListener('click', () => {
        this.#setActiveFilter(filterId);
        this.#onFilterChange(filterId);
      });
    }
  }

  /**
   * Set the active filter button
   * @param {string} filterId
   */
  #setActiveFilter(filterId) {
    for (const [id, button] of this.#filterButtons) {
      const isActive = id === filterId;
      button.classList.toggle('search-filter__filter-btn--active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  /**
   * Update results count display
   * @param {number} shown - Number of mods shown
   * @param {number} total - Total number of mods
   */
  updateResultsCount(shown, total) {
    const resultsElement = this.#container.querySelector('#search-results-count');
    if (!resultsElement) return;

    if (shown === total) {
      resultsElement.textContent = `${total} mods`;
    } else {
      resultsElement.textContent = `Showing ${shown} of ${total} mods`;
    }
  }

  /**
   * Set search query programmatically
   * @param {string} query
   */
  setSearchQuery(query) {
    this.#searchInput.value = query;
    this.#clearButton.hidden = query.length === 0;
  }

  /**
   * Set filter programmatically
   * @param {'all'|'active'|'inactive'} filterId
   */
  setFilter(filterId) {
    this.#setActiveFilter(filterId);
  }

  /**
   * Focus the search input
   */
  focus() {
    this.#searchInput.focus();
  }

  /**
   * Get current search query
   * @returns {string}
   */
  getSearchQuery() {
    return this.#searchInput.value;
  }

  /**
   * Get current filter
   * @returns {string}
   */
  getActiveFilter() {
    for (const [id, button] of this.#filterButtons) {
      if (button.classList.contains('search-filter__filter-btn--active')) {
        return id;
      }
    }
    return 'all';
  }

  /**
   * Cleanup resources
   */
  destroy() {
    if (this.#debounceTimer) {
      clearTimeout(this.#debounceTimer);
    }
    this.#container.innerHTML = '';
  }
}

export default SearchFilterView;
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Unit Tests** (`SearchFilterView.test.js`):
   - `constructor creates search input and filter buttons`
   - `search input triggers onSearchChange with debounce`
   - `Enter key triggers immediate search (no debounce)`
   - `Escape key clears search`
   - `clear button clears search and triggers callback`
   - `filter button click triggers onFilterChange`
   - `filter button click updates aria-pressed`
   - `setActiveFilter updates button classes`
   - `updateResultsCount shows correct text`
   - `setSearchQuery updates input value`
   - `setFilter updates active button`
   - `getSearchQuery returns current value`
   - `getActiveFilter returns active filter id`
   - `destroy clears debounce timer`

2. **ESLint passes:**
   ```bash
   npx eslint src/modManager/views/SearchFilterView.js
   ```

3. **TypeCheck passes:**
   ```bash
   npm run typecheck
   ```

4. **Debounce implementation:**
   ```bash
   grep -q "setTimeout" src/modManager/views/SearchFilterView.js && \
   grep -q "clearTimeout" src/modManager/views/SearchFilterView.js && \
   echo "OK"
   ```

### Invariants That Must Remain True

1. Search input debounced by default (300ms)
2. Enter key bypasses debounce for immediate search
3. Escape key clears search
4. Clear button only visible when search has content
5. Filter buttons use aria-pressed for accessibility
6. Results count uses aria-live for screen readers
7. Only one filter active at a time
8. Debounce timer cleaned up on destroy

---

## Notes

- Debounce is implemented inline using `setTimeout`/`clearTimeout`
- No external utility dependencies required
- Pattern follows existing modManager view components (ModListView, WorldListView)

---

## Outcome

**Completed:** 2025-12-17

### Changes vs. Originally Planned

1. **Ticket Corrections Made:**
   - Removed invalid "Reference Files" section that referenced non-existent files:
     - `src/domUI/components/SearchInputComponent.js` - does not exist
     - `src/domUI/filters/FilterToggleComponent.js` - does not exist
     - `src/utils/debounce.js` - does not exist
   - The ticket was self-contained with inline implementation, so no code references were needed.

2. **Implementation Enhancements:**
   - Added JSDoc type annotations for all private fields (TypeScript compatibility)
   - Added `@ts-ignore` comments for fields assigned in `#createStructure()` method
   - Added type casting for event targets and callback parameters
   - Added debug logging on initialization

3. **Test Coverage:**
   - Created 19 unit tests (exceeded the 14 required):
     - All 14 acceptance criteria tests
     - 5 additional tests:
       - `focus method focuses search input`
       - `clear button focuses search input after clearing`
       - `multiple rapid inputs only trigger one debounced callback`
       - `visually-hidden label exists for accessibility`
       - `filter section has proper ARIA group attributes`

### Files Created

| File | Purpose |
|------|---------|
| `src/modManager/views/SearchFilterView.js` | Search and filter UI component |
| `tests/unit/modManager/views/SearchFilterView.test.js` | Unit tests (19 cases, 100% pass) |

### Validation Results

- ✅ ESLint: Passes (0 errors, 0 warnings)
- ✅ TypeCheck: No errors for SearchFilterView
- ✅ Unit Tests: 19/19 passed
- ✅ Debounce implementation verified (`setTimeout`/`clearTimeout` present)
