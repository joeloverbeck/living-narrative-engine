/**
 * @file Service for enhancing cliché display with interactive features
 */

import { DomUtils } from '../../utils/domUtils.js';
import { ClicheFilterService } from './ClicheFilterService.js';
import { ClicheExporter } from './ClicheExporter.js';

/**
 * @typedef {import('../../interfaces/ILogger.js').ILogger} ILogger
 */

/**
 * Manages interactive enhancements for cliché display
 */
export class ClicheDisplayEnhancer {
  #logger;
  #container;
  #filterService;
  #exporter;
  #collapsedCategories;
  #searchInput;
  #categoryFilters;
  #currentData;
  #onDeleteItem;
  #onDeleteTrope;

  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {HTMLElement} params.container
   * @param {Function} [params.onDeleteItem] - Callback for item deletion
   * @param {Function} [params.onDeleteTrope] - Callback for trope deletion
   */
  constructor({ logger, container, onDeleteItem, onDeleteTrope }) {
    if (!logger) throw new Error('Logger is required');
    if (!container) throw new Error('Container element is required');

    this.#logger = logger;
    this.#container = container;
    this.#filterService = new ClicheFilterService();
    this.#exporter = new ClicheExporter();
    this.#collapsedCategories = this.#loadCollapsedState();
    this.#currentData = null;
    this.#onDeleteItem = onDeleteItem;
    this.#onDeleteTrope = onDeleteTrope;
  }

  /**
   * Enhance the display with interactive features
   *
   * @param {object} displayData - The cliché display data
   */
  enhance(displayData) {
    if (!displayData) return;

    this.#currentData = displayData;
    this.#addSearchControls();
    this.#enhanceCategories();
    this.#addExportControls();
    this.#setupEventHandlers();
    this.#applyCollapsedStates();
  }

  /**
   * Add search and filter controls
   *
   * @private
   */
  #addSearchControls() {
    const existingControls = this.#container.querySelector('.cliche-controls');
    if (existingControls) return;

    const controlsHtml = `
      <div class="cliche-controls">
        <div class="search-section">
          <input 
            type="text" 
            id="cliche-search" 
            class="cliche-search-input" 
            placeholder="Search clichés..."
            aria-label="Search clichés"
          />
          <span class="search-results-count" aria-live="polite"></span>
        </div>
        
        <div class="filter-section">
          <button type="button" class="filter-toggle-btn" aria-expanded="false">
            <span>Filter Categories</span>
            <span class="chevron">▼</span>
          </button>
          <div class="category-filters" hidden>
            ${this.#generateCategoryFilters()}
          </div>
        </div>
        
        <div class="action-buttons">
          <button type="button" class="expand-all-btn" title="Expand all categories">
            Expand All
          </button>
          <button type="button" class="collapse-all-btn" title="Collapse all categories">
            Collapse All
          </button>
        </div>
      </div>
    `;

    const resultsContainer = this.#container.querySelector('.cliches-results');
    if (resultsContainer) {
      resultsContainer.insertAdjacentHTML('afterbegin', controlsHtml);
    }
  }

  /**
   * Generate category filter checkboxes
   *
   * @private
   */
  #generateCategoryFilters() {
    if (!this.#currentData?.categories) return '';

    return this.#currentData.categories
      .map(
        (category) => `
        <label class="category-filter-label">
          <input 
            type="checkbox" 
            class="category-filter" 
            data-category="${category.id}" 
            checked
          />
          <span>${DomUtils.escapeHtml(category.title)} (${category.count})</span>
        </label>
      `
      )
      .join('');
  }

  /**
   * Enhance category elements with interactive features
   *
   * @private
   */
  #enhanceCategories() {
    const categories = this.#container.querySelectorAll('.cliche-category');

    categories.forEach((categoryEl) => {
      const categoryId = categoryEl.dataset.category;
      const header = categoryEl.querySelector('.category-title');

      if (!header || header.querySelector('.category-controls')) return;

      // Add expand/collapse control
      const controlsHtml = `
        <button 
          class="category-toggle" 
          aria-expanded="true" 
          aria-controls="list-${categoryId}"
          title="Toggle category"
        >
          <span class="chevron" aria-hidden="true">▼</span>
        </button>
      `;

      header.insertAdjacentHTML('afterbegin', controlsHtml);

      // Add copy button for category
      const copyBtnHtml = `
        <button 
          class="copy-category-btn" 
          data-category="${categoryId}"
          title="Copy all items in this category"
          aria-label="Copy all items in ${header.textContent.trim()}"
        >
          📋
        </button>
      `;

      header.insertAdjacentHTML('beforeend', copyBtnHtml);

      // Add ID to list for ARIA
      const list = categoryEl.querySelector('.cliche-list');
      if (list) {
        list.id = `list-${categoryId}`;
      }

      // Enhance individual items
      this.#enhanceItems(categoryEl);
    });
  }

  /**
   * Enhance individual cliché items
   *
   * @param categoryEl
   * @private
   */
  #enhanceItems(categoryEl) {
    const items = categoryEl.querySelectorAll('.cliche-item');

    items.forEach((item, index) => {
      if (item.querySelector('.item-controls')) return;

      const itemText = item.textContent.trim();
      const categoryId = categoryEl.dataset.category;
      const controlsHtml = `
        <span class="item-controls">
          <button 
            class="copy-item-btn" 
            title="Copy this item"
            aria-label="Copy: ${DomUtils.escapeHtml(itemText)}"
          >
            📋
          </button>
          <button 
            class="delete-item-btn" 
            data-category="${categoryId}"
            data-text="${DomUtils.escapeHtml(itemText)}"
            title="Delete this item"
            aria-label="Delete: ${DomUtils.escapeHtml(itemText)}"
          >
            🗑️
          </button>
        </span>
      `;

      item.insertAdjacentHTML('beforeend', controlsHtml);
      item.setAttribute('tabindex', '0');
      item.setAttribute('role', 'listitem');
    });
  }

  /**
   * Add export controls
   *
   * @private
   */
  #addExportControls() {
    const existingExport = this.#container.querySelector('.export-controls');
    if (existingExport) return;

    const exportHtml = `
      <div class="export-controls">
        <button type="button" class="export-btn" data-format="markdown">
          Export as Markdown
        </button>
        <button type="button" class="export-btn" data-format="json">
          Export as JSON
        </button>
        <button type="button" class="export-btn" data-format="text">
          Export as Text
        </button>
        <button type="button" class="copy-all-btn">
          Copy All Clichés
        </button>
      </div>
    `;

    const metadata = this.#container.querySelector('.cliche-metadata');
    if (metadata) {
      metadata.insertAdjacentHTML('beforebegin', exportHtml);
    }
  }

  /**
   * Setup event handlers for interactive features
   *
   * @private
   */
  #setupEventHandlers() {
    // Search functionality
    const searchInput = this.#container.querySelector('#cliche-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) =>
        this.#handleSearch(e.target.value)
      );
    }

    // Filter toggle
    const filterToggle = this.#container.querySelector('.filter-toggle-btn');
    if (filterToggle) {
      filterToggle.addEventListener('click', () => this.#toggleFilterPanel());
    }

    // Category filters
    const categoryFilters =
      this.#container.querySelectorAll('.category-filter');
    categoryFilters.forEach((filter) => {
      filter.addEventListener('change', () => this.#handleCategoryFilter());
    });

    // Expand/Collapse all
    const expandAllBtn = this.#container.querySelector('.expand-all-btn');
    const collapseAllBtn = this.#container.querySelector('.collapse-all-btn');

    if (expandAllBtn) {
      expandAllBtn.addEventListener('click', () => this.#expandAll());
    }

    if (collapseAllBtn) {
      collapseAllBtn.addEventListener('click', () => this.#collapseAll());
    }

    // Category toggles
    const categoryToggles =
      this.#container.querySelectorAll('.category-toggle');
    categoryToggles.forEach((toggle) => {
      toggle.addEventListener('click', (e) => this.#toggleCategory(e));
    });

    // Copy and delete buttons
    this.#container.addEventListener('click', (e) => {
      if (e.target.classList.contains('copy-item-btn')) {
        this.#copyItem(e.target);
      } else if (e.target.classList.contains('copy-category-btn')) {
        this.#copyCategory(e.target);
      } else if (e.target.classList.contains('copy-all-btn')) {
        this.#copyAll();
      } else if (e.target.classList.contains('delete-item-btn')) {
        this.#deleteItem(e.target);
      } else if (e.target.classList.contains('delete-trope-btn')) {
        this.#deleteTrope(e.target);
      }
    });

    // Export buttons
    const exportBtns = this.#container.querySelectorAll('.export-btn');
    exportBtns.forEach((btn) => {
      btn.addEventListener('click', () =>
        this.#handleExport(btn.dataset.format)
      );
    });

    // Keyboard navigation
    this.#setupKeyboardNavigation();
  }

  /**
   * Handle search input
   *
   * @param searchTerm
   * @private
   */
  #handleSearch(searchTerm) {
    const results = this.#filterService.search(this.#currentData, searchTerm);
    this.#updateDisplay(results, searchTerm);
  }

  /**
   * Handle category filter changes
   *
   * @private
   */
  #handleCategoryFilter() {
    const filters = this.#container.querySelectorAll('.category-filter');
    const activeCategories = Array.from(filters)
      .filter((f) => f.checked)
      .map((f) => f.dataset.category);

    const results = this.#filterService.filterByCategories(
      this.#currentData,
      activeCategories
    );
    this.#updateDisplay(results);
  }

  /**
   * Update display based on filters
   *
   * @param filteredData
   * @param searchTerm
   * @private
   */
  #updateDisplay(filteredData, searchTerm = '') {
    const categories = this.#container.querySelectorAll('.cliche-category');
    let visibleCount = 0;
    let totalVisible = 0;

    categories.forEach((categoryEl) => {
      const categoryId = categoryEl.dataset.category;
      const categoryData = filteredData.categories.find(
        (c) => c.id === categoryId
      );

      if (!categoryData || categoryData.items.length === 0) {
        categoryEl.style.display = 'none';
      } else {
        categoryEl.style.display = '';
        visibleCount++;
        totalVisible += categoryData.items.length;

        // Update items visibility
        const items = categoryEl.querySelectorAll('.cliche-item');
        items.forEach((item) => {
          const itemText = item.textContent.toLowerCase();
          const searchLower = searchTerm.toLowerCase();

          if (searchTerm && !itemText.includes(searchLower)) {
            item.style.display = 'none';
          } else {
            item.style.display = '';

            // Highlight search term
            if (searchTerm) {
              this.#highlightSearchTerm(item, searchTerm);
            }
          }
        });
      }
    });

    // Update results count
    const countEl = this.#container.querySelector('.search-results-count');
    if (countEl) {
      countEl.textContent = `${totalVisible} items in ${visibleCount} categories`;
    }
  }

  /**
   * Highlight search term in item
   *
   * @param item
   * @param term
   * @private
   */
  #highlightSearchTerm(item, term) {
    const text = item.childNodes[0];
    if (text && text.nodeType === Node.TEXT_NODE) {
      const highlighted = text.textContent.replace(
        new RegExp(`(${term})`, 'gi'),
        '<mark>$1</mark>'
      );

      const span = document.createElement('span');
      span.innerHTML = highlighted;
      text.replaceWith(span);
    }
  }

  /**
   * Toggle filter panel
   *
   * @private
   */
  #toggleFilterPanel() {
    const panel = this.#container.querySelector('.category-filters');
    const toggle = this.#container.querySelector('.filter-toggle-btn');

    if (panel && toggle) {
      const isHidden = panel.hidden;
      panel.hidden = !isHidden;
      toggle.setAttribute('aria-expanded', isHidden);

      const chevron = toggle.querySelector('.chevron');
      if (chevron) {
        chevron.textContent = isHidden ? '▲' : '▼';
      }
    }
  }

  /**
   * Toggle category expand/collapse
   *
   * @param event
   * @private
   */
  #toggleCategory(event) {
    const toggle = event.currentTarget;
    const category = toggle.closest('.cliche-category');
    const categoryId = category.dataset.category;
    const list = category.querySelector('.cliche-list');

    if (!list) return;

    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    const newState = !isExpanded;

    toggle.setAttribute('aria-expanded', newState);
    list.style.display = newState ? '' : 'none';

    const chevron = toggle.querySelector('.chevron');
    if (chevron) {
      chevron.textContent = newState ? '▼' : '▶';
    }

    // Save state
    if (newState) {
      this.#collapsedCategories.delete(categoryId);
    } else {
      this.#collapsedCategories.add(categoryId);
    }

    this.#saveCollapsedState();
  }

  /**
   * Expand all categories
   *
   * @private
   */
  #expandAll() {
    const toggles = this.#container.querySelectorAll('.category-toggle');
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-expanded', 'true');
      const chevron = toggle.querySelector('.chevron');
      if (chevron) chevron.textContent = '▼';

      const category = toggle.closest('.cliche-category');
      const list = category.querySelector('.cliche-list');
      if (list) list.style.display = '';
    });

    this.#collapsedCategories.clear();
    this.#saveCollapsedState();
  }

  /**
   * Collapse all categories
   *
   * @private
   */
  #collapseAll() {
    const toggles = this.#container.querySelectorAll('.category-toggle');
    toggles.forEach((toggle) => {
      toggle.setAttribute('aria-expanded', 'false');
      const chevron = toggle.querySelector('.chevron');
      if (chevron) chevron.textContent = '▶';

      const category = toggle.closest('.cliche-category');
      const categoryId = category.dataset.category;
      const list = category.querySelector('.cliche-list');
      if (list) list.style.display = 'none';

      this.#collapsedCategories.add(categoryId);
    });

    this.#saveCollapsedState();
  }

  /**
   * Copy individual item
   *
   * @param button
   * @private
   */
  async #copyItem(button) {
    const item =
      button.closest('.cliche-item') || button.closest('.trope-item');
    if (!item) {
      this.#logger.error('Could not find parent item element');
      return;
    }

    // Clone the item and remove buttons to get clean text
    const clone = item.cloneNode(true);
    const controls = clone.querySelector('.item-controls');
    if (controls) {
      controls.remove();
    }
    const text = clone.textContent.trim();

    try {
      await navigator.clipboard.writeText(text);
      this.#showCopyFeedback(button, 'Copied!');
    } catch (err) {
      this.#logger.error('Failed to copy item', err);
      this.#showCopyFeedback(button, 'Failed');
    }
  }

  /**
   * Delete individual item
   *
   * @param button
   * @private
   */
  async #deleteItem(button) {
    const categoryId = button.dataset.category;
    const itemText = button.dataset.text;

    if (!this.#onDeleteItem) {
      this.#logger.warn('Delete handler not configured');
      return;
    }

    try {
      // Disable button to prevent double-clicks
      button.disabled = true;
      button.textContent = '⏳';

      // Call the deletion handler
      await this.#onDeleteItem(categoryId, itemText);

      // Remove the item from DOM (optimistic update)
      const item = button.closest('.cliche-item');
      if (item) {
        item.style.opacity = '0.5';
        item.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          item.remove();
          // Update category count
          this.#updateCategoryCount(categoryId);
        }, 300);
      }
    } catch (err) {
      this.#logger.error('Failed to delete item', err);
      // Re-enable button on error
      button.disabled = false;
      button.textContent = '🗑️';
      this.#showCopyFeedback(button, 'Failed');
    }
  }

  /**
   * Delete trope
   *
   * @param button
   * @private
   */
  async #deleteTrope(button) {
    const tropeText = button.dataset.text;

    if (!this.#onDeleteTrope) {
      this.#logger.warn('Delete trope handler not configured');
      return;
    }

    try {
      // Disable button to prevent double-clicks
      button.disabled = true;
      button.textContent = '⏳';

      // Call the deletion handler
      await this.#onDeleteTrope(tropeText);

      // Remove the trope from DOM (optimistic update)
      const tropeItem = button.closest('li');
      if (tropeItem) {
        tropeItem.style.opacity = '0.5';
        tropeItem.style.transition = 'opacity 0.3s';
        setTimeout(() => {
          tropeItem.remove();
        }, 300);
      }
    } catch (err) {
      this.#logger.error('Failed to delete trope', err);
      // Re-enable button on error
      button.disabled = false;
      button.textContent = '🗑️';
      this.#showCopyFeedback(button, 'Failed');
    }
  }

  /**
   * Update category count after deletion
   *
   * @param categoryId
   * @private
   */
  #updateCategoryCount(categoryId) {
    const category = this.#container.querySelector(
      `.cliche-category[data-category="${categoryId}"]`
    );
    if (category) {
      const items = category.querySelectorAll('.cliche-item');
      const countEl = category.querySelector('.category-count');
      if (countEl) {
        countEl.textContent = `(${items.length})`;
      }
    }
  }

  /**
   * Copy category items
   *
   * @param button
   * @private
   */
  async #copyCategory(button) {
    const category = button.closest('.cliche-category');
    const titleEl = category.querySelector('.category-title');

    // Clone title and remove buttons to get clean text
    const titleClone = titleEl.cloneNode(true);
    const titleButtons = titleClone.querySelectorAll('button');
    titleButtons.forEach((btn) => btn.remove());
    const title = titleClone.textContent.trim();

    // Get clean item texts
    const items = Array.from(category.querySelectorAll('.cliche-item'))
      .map((item) => {
        const clone = item.cloneNode(true);
        const controls = clone.querySelector('.item-controls');
        if (controls) controls.remove();
        return `• ${clone.textContent.trim()}`;
      })
      .join('\n');

    const text = `${title}\n${items}`;

    try {
      await navigator.clipboard.writeText(text);
      this.#showCopyFeedback(button, 'Copied!');
    } catch (err) {
      this.#logger.error('Failed to copy category', err);
      this.#showCopyFeedback(button, 'Failed');
    }
  }

  /**
   * Copy all clichés
   *
   * @private
   */
  async #copyAll() {
    const button = this.#container.querySelector('.copy-all-btn');
    const text = this.#exporter.exportAsText(this.#currentData);

    try {
      await navigator.clipboard.writeText(text);
      this.#showCopyFeedback(button, 'All clichés copied!');
    } catch (err) {
      this.#logger.error('Failed to copy all', err);
      this.#showCopyFeedback(button, 'Failed');
    }
  }

  /**
   * Show copy feedback
   *
   * @param button
   * @param message
   * @private
   */
  #showCopyFeedback(button, message) {
    const originalText = button.textContent;
    button.textContent = message;
    button.disabled = true;

    setTimeout(() => {
      button.textContent = originalText;
      button.disabled = false;
    }, 1500);
  }

  /**
   * Handle export
   *
   * @param format
   * @private
   */
  #handleExport(format) {
    if (!this.#currentData) return;

    try {
      this.#exporter.export(this.#currentData, format);
      this.#logger.info(`Exported clichés as ${format}`);
    } catch (err) {
      this.#logger.error(`Failed to export as ${format}`, err);
    }
  }

  /**
   * Setup keyboard navigation
   *
   * @private
   */
  #setupKeyboardNavigation() {
    // Focus management for items
    const items = this.#container.querySelectorAll('.cliche-item');
    items.forEach((item) => {
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const copyBtn = item.querySelector('.copy-item-btn');
          if (copyBtn) copyBtn.click();
        }
      });
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Only handle if clichés container is visible
      if (!this.#container.offsetParent) return;

      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        const searchInput = this.#container.querySelector('#cliche-search');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }

      // Escape to clear search
      if (e.key === 'Escape') {
        const searchInput = this.#container.querySelector('#cliche-search');
        if (searchInput && searchInput.value) {
          searchInput.value = '';
          this.#handleSearch('');
        }
      }
    });
  }

  /**
   * Load collapsed state from localStorage
   *
   * @private
   */
  #loadCollapsedState() {
    try {
      const saved = localStorage.getItem('cliche-collapsed-categories');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  }

  /**
   * Save collapsed state to localStorage
   *
   * @private
   */
  #saveCollapsedState() {
    try {
      localStorage.setItem(
        'cliche-collapsed-categories',
        JSON.stringify(Array.from(this.#collapsedCategories))
      );
    } catch (err) {
      this.#logger.warn('Failed to save collapsed state', err);
    }
  }

  /**
   * Apply saved collapsed states
   *
   * @private
   */
  #applyCollapsedStates() {
    this.#collapsedCategories.forEach((categoryId) => {
      const category = this.#container.querySelector(
        `.cliche-category[data-category="${categoryId}"]`
      );
      if (category) {
        const toggle = category.querySelector('.category-toggle');
        const list = category.querySelector('.cliche-list');

        if (toggle && list) {
          toggle.setAttribute('aria-expanded', 'false');
          const chevron = toggle.querySelector('.chevron');
          if (chevron) chevron.textContent = '▶';
          list.style.display = 'none';
        }
      }
    });
  }

  /**
   * Cleanup event handlers and state
   */
  cleanup() {
    // Remove event listeners if needed
    this.#currentData = null;
  }
}

export default ClicheDisplayEnhancer;
