/**
 * @file View component for search and filter controls
 * @see src/modManager/views/ModListView.js
 */

/**
 * Configuration options for SearchFilterView.
 *
 * @typedef {object} SearchFilterViewOptions
 * @property {HTMLElement} container - Container element for the view
 * @property {{debug: (message: string, ...args: unknown[]) => void}} logger - Logger instance for debug output
 * @property {(query: string) => void} onSearchChange - Callback when search query changes
 * @property {(category: 'all'|'active'|'inactive') => void} onFilterChange - Callback when filter changes
 * @property {number} [debounceMs=300] - Debounce delay in milliseconds for search input
 */

/**
 * View for search and filter controls
 */
export class SearchFilterView {
  /** @type {HTMLElement} */
  #container;
  /** @type {{debug: (message: string, ...args: unknown[]) => void}} */
  #logger;
  /** @type {(query: string) => void} */
  #onSearchChange;
  /** @type {(category: 'all'|'active'|'inactive') => void} */
  #onFilterChange;
  /** @type {number} */
  #debounceMs;
  /** @type {HTMLInputElement} */
  // @ts-ignore - assigned in #createStructure() called from constructor
  #searchInput;
  /** @type {Map<string, HTMLButtonElement>} */
  #filterButtons;
  /** @type {HTMLButtonElement} */
  // @ts-ignore - assigned in #createStructure() called from constructor
  #clearButton;
  /** @type {ReturnType<typeof setTimeout> | null} */
  #debounceTimer;

  /**
   * Creates a new SearchFilterView instance.
   *
   * @param {SearchFilterViewOptions} options - The configuration options
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
    this.#logger.debug('SearchFilterView initialized');
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
    this.#clearButton.innerHTML = '<span aria-hidden="true">\u00d7</span>';
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
      { id: 'all', label: 'All', icon: '\ud83d\udccb' },
      { id: 'active', label: 'Active', icon: '\u2705' },
      { id: 'inactive', label: 'Inactive', icon: '\u2b1c' },
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
      const target = /** @type {HTMLInputElement} */ (event.target);
      const value = target.value;
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
        this.#onFilterChange(/** @type {'all'|'active'|'inactive'} */ (filterId));
      });
    }
  }

  /**
   * Set the active filter button.
   *
   * @param {string} filterId - The filter ID to activate
   */
  #setActiveFilter(filterId) {
    for (const [id, button] of this.#filterButtons) {
      const isActive = id === filterId;
      button.classList.toggle('search-filter__filter-btn--active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    }
  }

  /**
   * Update results count display.
   *
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
   * Set search query programmatically.
   *
   * @param {string} query - The search query to set
   */
  setSearchQuery(query) {
    this.#searchInput.value = query;
    this.#clearButton.hidden = query.length === 0;
  }

  /**
   * Set filter programmatically.
   *
   * @param {'all'|'active'|'inactive'} filterId - The filter ID to set
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
   * Get current search query.
   *
   * @returns {string} The current search query value
   */
  getSearchQuery() {
    return this.#searchInput.value;
  }

  /**
   * Get current filter.
   *
   * @returns {string} The active filter ID ('all', 'active', or 'inactive')
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
