/**
 * @file View component for the summary panel
 * @see src/modManager/views/ModListView.js
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
    if (!container) {
      throw new Error('SummaryPanelView: container is required');
    }
    if (!logger) {
      throw new Error('SummaryPanelView: logger is required');
    }
    if (!onSave) {
      throw new Error('SummaryPanelView: onSave is required');
    }

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
    this.#loadOrderElement.setAttribute(
      'aria-label',
      'Mods will load in this order'
    );

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
    // Inline display guard so the warning stays hidden even if CSS overrides [hidden]
    this.#unsavedIndicator.style.display = 'none';

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
    const countValue = this.#countElement.querySelector(
      '.summary-panel__stat-value'
    );
    if (countValue) {
      countValue.textContent = String(activeCount);
    }

    // Update load order list
    this.#renderLoadOrder(loadOrder, isLoading);

    // Update unsaved indicator
    const shouldShowUnsaved = hasUnsavedChanges && !isSaving && !isLoading;
    this.#unsavedIndicator.hidden = !shouldShowUnsaved;
    this.#unsavedIndicator.style.display = shouldShowUnsaved ? 'flex' : 'none';

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
      this.#loadOrderElement.innerHTML =
        '<li class="summary-panel__loading">Loading...</li>';
      return;
    }

    if (loadOrder.length === 0) {
      this.#loadOrderElement.innerHTML =
        '<li class="summary-panel__empty">No mods active</li>';
      return;
    }

    this.#loadOrderElement.innerHTML = loadOrder
      .map((modId, index) => {
        const isCore = modId === 'core';
        const itemClass = isCore
          ? 'summary-panel__load-order-item summary-panel__load-order-item--core'
          : 'summary-panel__load-order-item';
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
