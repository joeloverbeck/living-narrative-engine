/**
 * @file Reusable dropdown component for character-builder pages
 * @description Provides consistent dropdown functionality for selecting previous items
 */

/**
 * Reusable dropdown component for character-builder pages
 */
export class PreviousItemsDropdown {
  #element;
  #onSelectionChange;
  #labelText;
  #items = [];

  /**
   * @param {object} config - Configuration object
   * @param {HTMLSelectElement} config.element - Select element
   * @param {Function} config.onSelectionChange - Selection change handler
   * @param {string} config.labelText - Label text for the dropdown
   */
  constructor({ element, onSelectionChange, labelText = 'Select Item:' }) {
    if (!element) {
      throw new Error('PreviousItemsDropdown: element is required');
    }
    if (element.tagName !== 'SELECT') {
      throw new Error(
        'PreviousItemsDropdown: element must be a SELECT element'
      );
    }
    if (!onSelectionChange) {
      throw new Error(
        'PreviousItemsDropdown: onSelectionChange callback is required'
      );
    }
    if (typeof onSelectionChange !== 'function') {
      throw new Error(
        'PreviousItemsDropdown: onSelectionChange must be a function'
      );
    }

    this.#element = element;
    this.#onSelectionChange = onSelectionChange;
    this.#labelText = labelText;

    this.#setupEventListeners();
  }

  /**
   * Load items into the dropdown
   *
   * @param {Array} items - Array of items to load
   * @param {object} [options] - Loading options
   * @param {string} [options.emptyText] - Text for empty option
   * @param {string} [options.valueProperty] - Property to use as value
   * @param {string} [options.labelProperty] - Property to use as label
   */
  async loadItems(items, options = {}) {
    const {
      emptyText = '-- All Items --',
      valueProperty = 'id',
      labelProperty = 'concept',
    } = options;

    if (items === null || items === undefined) {
      return Promise.reject(
        new Error('PreviousItemsDropdown: items must be an array')
      );
    }

    if (!Array.isArray(items)) {
      return Promise.reject(
        new Error('PreviousItemsDropdown: items must be an array')
      );
    }

    this.#items = items || [];

    // Clear existing options
    this.#element.innerHTML = '';

    // Add label if it exists
    if (this.#labelText) {
      this.#element.innerHTML = this.#labelText;
    }

    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = emptyText;
    this.#element.appendChild(emptyOption);

    // Add special orphaned option if needed
    if (this.#shouldShowOrphanedOption()) {
      const orphanedOption = document.createElement('option');
      orphanedOption.value = 'orphaned';
      orphanedOption.textContent = '🚨 Orphaned Items';
      this.#element.appendChild(orphanedOption);
    }

    // Add items
    this.#items.forEach((item) => {
      const option = document.createElement('option');
      option.value = this.#getItemValue(item, valueProperty);
      option.textContent = this.#getItemLabel(item, labelProperty);
      this.#element.appendChild(option);
    });

    // Update accessibility
    this.#updateAccessibility();
  }

  /**
   * Select an item by ID
   *
   * @param {string} itemId - Item ID to select
   */
  selectItem(itemId) {
    this.#element.value = itemId || '';
    // Trigger change event
    this.#element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Get selected item ID
   *
   * @returns {string} Selected item ID
   */
  getSelectedItemId() {
    return this.#element.value;
  }

  /**
   * Get selected item object
   *
   * @returns {object|null} Selected item object
   */
  getSelectedItem() {
    const selectedId = this.getSelectedItemId();
    if (!selectedId) return null;

    return (
      this.#items.find(
        (item) => item.id === selectedId || item.conceptId === selectedId
      ) || null
    );
  }

  /**
   * Enable or disable the dropdown
   *
   * @param {boolean} enabled - Whether dropdown should be enabled
   */
  setEnabled(enabled) {
    this.#element.disabled = !enabled;
  }

  /**
   * Get selected value (alias for getSelectedItemId)
   *
   * @returns {string} Selected value
   */
  getSelectedValue() {
    const selectElement = this.#element.querySelector('select');
    if (!selectElement) return '';
    return selectElement.value || '';
  }

  /**
   * Set selected value (alias for selectItem)
   *
   * @param {string} value - Value to select
   */
  setSelectedValue(value) {
    const selectElement = this.#element.querySelector('select');
    if (!selectElement) return;
    selectElement.value = value;
    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Clear the dropdown
   */
  clear() {
    this.#element.innerHTML = '';
    this.#items = [];
  }

  /**
   * Disable the dropdown
   */
  disable() {
    const selectElement = this.#element.querySelector('select');
    if (selectElement) {
      selectElement.disabled = true;
    } else {
      this.#element.disabled = true;
    }
  }

  /**
   * Enable the dropdown
   */
  enable() {
    const selectElement = this.#element.querySelector('select');
    if (selectElement) {
      selectElement.disabled = false;
    } else {
      this.#element.disabled = false;
    }
  }

  /**
   * Get the number of items in the dropdown
   *
   * @returns {number} Number of items
   */
  getItemCount() {
    return this.#items.length;
  }

  /**
   * Setup event listeners
   *
   * @private
   */
  #setupEventListeners() {
    this.#element.addEventListener('change', (event) => {
      const selectedId = event.target.value;
      this.#onSelectionChange(selectedId);
    });
  }

  /**
   * Determine if orphaned option should be shown
   *
   * @private
   * @returns {boolean} Whether to show orphaned option
   */
  #shouldShowOrphanedOption() {
    // For thematic directions manager, we want to show orphaned option
    // This can be extended for other pages as needed
    return true;
  }

  /**
   * Get value from item object
   *
   * @private
   * @param {object} item - Item object
   * @param {string} valueProperty - Property to use as value
   * @returns {string} Item value
   */
  #getItemValue(item, valueProperty) {
    if (typeof item === 'string') return item;
    return item[valueProperty] || item.id || '';
  }

  /**
   * Get label from item object
   *
   * @private
   * @param {object} item - Item object
   * @param {string} labelProperty - Property to use as label
   * @returns {string} Item label
   */
  #getItemLabel(item, labelProperty) {
    if (typeof item === 'string') return item;

    const label =
      item[labelProperty] || item.title || item.name || item.id || '';

    // Truncate long labels
    if (label.length > 60) {
      return label.substring(0, 57) + '...';
    }

    return label;
  }

  /**
   * Update accessibility attributes
   *
   * @private
   */
  #updateAccessibility() {
    this.#element.setAttribute('aria-label', this.#labelText);
    this.#element.setAttribute('aria-describedby', this.#element.id + '-help');
  }
}

export default PreviousItemsDropdown;
