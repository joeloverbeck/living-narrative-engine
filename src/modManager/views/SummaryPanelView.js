/**
 * @file View component for the summary panel
 * @see src/modManager/views/ModListView.js
 */

/**
 * @typedef {object} SummaryPanelViewOptions
 * @property {HTMLElement} container - Container element
 * @property {object} logger - Logger instance
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
  #explicitCountElement;
  #dependencyCountElement;
  #loadOrderElement;
  #hotspotsSection;
  #healthSection;
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

    // Quick Stats section with row layout
    const quickStatsSection = document.createElement('section');
    quickStatsSection.className = 'summary-panel__quick-stats';
    quickStatsSection.setAttribute('aria-label', 'Mod statistics');

    const statsRow = document.createElement('div');
    statsRow.className = 'summary-panel__stats-row';

    // Active mods stat
    this.#countElement = document.createElement('div');
    this.#countElement.className = 'summary-panel__stat';
    this.#countElement.innerHTML = `
      <span class="summary-panel__stat-value" id="active-mod-count">0</span>
      <span class="summary-panel__stat-label">Active</span>
    `;

    // Divider
    const divider1 = document.createElement('span');
    divider1.className = 'summary-panel__stat-divider';
    divider1.setAttribute('aria-hidden', 'true');
    divider1.textContent = '|';

    // Explicit mods stat
    this.#explicitCountElement = document.createElement('div');
    this.#explicitCountElement.className = 'summary-panel__stat';
    this.#explicitCountElement.innerHTML = `
      <span class="summary-panel__stat-value" id="explicit-mod-count">0</span>
      <span class="summary-panel__stat-label">Explicit</span>
    `;

    // Divider
    const divider2 = document.createElement('span');
    divider2.className = 'summary-panel__stat-divider';
    divider2.setAttribute('aria-hidden', 'true');
    divider2.textContent = '|';

    // Dependency mods stat
    this.#dependencyCountElement = document.createElement('div');
    this.#dependencyCountElement.className = 'summary-panel__stat';
    this.#dependencyCountElement.innerHTML = `
      <span class="summary-panel__stat-value" id="dependency-mod-count">0</span>
      <span class="summary-panel__stat-label">Deps</span>
    `;

    statsRow.appendChild(this.#countElement);
    statsRow.appendChild(divider1);
    statsRow.appendChild(this.#explicitCountElement);
    statsRow.appendChild(divider2);
    statsRow.appendChild(this.#dependencyCountElement);
    quickStatsSection.appendChild(statsRow);

    // Hotspots section (placeholder - content rendered dynamically)
    this.#hotspotsSection = document.createElement('section');
    this.#hotspotsSection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#hotspotsSection.setAttribute('aria-label', 'Dependency hotspots');

    // Health section (placeholder - content rendered dynamically)
    this.#healthSection = document.createElement('section');
    this.#healthSection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#healthSection.setAttribute('aria-label', 'Dependency health');

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
    this.#container.appendChild(quickStatsSection);
    this.#container.appendChild(this.#hotspotsSection);
    this.#container.appendChild(this.#healthSection);
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
   *
   * @param {object} options
   * @param {string[]} options.loadOrder - Ordered list of mod IDs
   * @param {number} options.activeCount - Number of active mods
   * @param {number} [options.explicitCount] - Number of explicitly enabled mods
   * @param {number} [options.dependencyCount] - Number of auto-enabled dependency mods
   * @param {Array<{modId: string, dependentCount: number}>} [options.hotspots] - Top dependency hotspots
   * @param {object|null} [options.healthStatus] - Dependency health status from ModStatisticsService
   * @param {boolean} [options.healthStatus.hasCircularDeps] - Whether circular dependencies exist
   * @param {string[]} [options.healthStatus.missingDeps] - List of missing dependencies
   * @param {boolean} [options.healthStatus.loadOrderValid] - Whether load order is valid
   * @param {string[]} [options.healthStatus.warnings] - Warning messages
   * @param {string[]} [options.healthStatus.errors] - Error messages
   * @param {boolean} options.hasUnsavedChanges
   * @param {boolean} options.isSaving
   * @param {boolean} options.isLoading
   */
  render({
    loadOrder,
    activeCount,
    explicitCount = 0,
    dependencyCount = 0,
    hotspots = [],
    healthStatus = null,
    hasUnsavedChanges,
    isSaving,
    isLoading,
  }) {
    // Update active count
    const countValue = this.#countElement.querySelector(
      '.summary-panel__stat-value'
    );
    if (countValue) {
      countValue.textContent = String(activeCount);
    }

    // Update explicit count
    const explicitValue = this.#explicitCountElement.querySelector(
      '.summary-panel__stat-value'
    );
    if (explicitValue) {
      explicitValue.textContent = String(explicitCount);
    }

    // Update dependency count
    const dependencyValue = this.#dependencyCountElement.querySelector(
      '.summary-panel__stat-value'
    );
    if (dependencyValue) {
      dependencyValue.textContent = String(dependencyCount);
    }

    // Update hotspots section
    this.#renderHotspotsSection(hotspots);

    // Update health section
    this.#renderHealthSection(healthStatus);

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
   *
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
   * Render the dependency hotspots section
   *
   * @param {Array<{modId: string, dependentCount: number}>} hotspots
   */
  #renderHotspotsSection(hotspots) {
    this.#hotspotsSection.innerHTML = '';

    // Section header (collapsible button)
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'true');
    header.innerHTML = `
      <span class="summary-panel__section-title">Dependency Hotspots</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▼</span>
    `;

    // Section content
    const content = document.createElement('div');
    content.className = 'summary-panel__section-content';

    if (hotspots.length === 0) {
      content.innerHTML =
        '<p class="summary-panel__hotspots-empty">No dependency hotspots</p>';
    } else {
      const list = document.createElement('ol');
      list.className = 'summary-panel__hotspots-list';

      for (const { modId, dependentCount } of hotspots) {
        const item = document.createElement('li');
        item.className = 'summary-panel__hotspot-item';
        item.innerHTML = `
          <span class="summary-panel__hotspot-name">${this.#escapeHtml(modId)}</span>
          <span class="summary-panel__hotspot-count">${dependentCount} dependents</span>
        `;
        list.appendChild(item);
      }

      content.appendChild(list);
    }

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

    this.#hotspotsSection.appendChild(header);
    this.#hotspotsSection.appendChild(content);
  }

  /**
   * Render the dependency health section
   *
   * @param {object|null} healthStatus
   */
  #renderHealthSection(healthStatus) {
    this.#healthSection.innerHTML = '';

    // Hide section if no health status
    if (!healthStatus) {
      this.#healthSection.hidden = true;
      return;
    }
    this.#healthSection.hidden = false;

    // Determine overall health state for styling
    const hasErrors = healthStatus.errors && healthStatus.errors.length > 0;
    const hasWarnings =
      healthStatus.warnings && healthStatus.warnings.length > 0;

    // Section header (collapsible button)
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    if (hasErrors) {
      header.classList.add('summary-panel__section-header--error');
    } else if (hasWarnings) {
      header.classList.add('summary-panel__section-header--warning');
    }
    header.type = 'button';
    header.setAttribute('aria-expanded', 'true');
    header.innerHTML = `
      <span class="summary-panel__section-title">Dependency Health</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▼</span>
    `;

    // Section content
    const content = document.createElement('div');
    content.className = 'summary-panel__section-content';

    // Health check list
    const healthList = document.createElement('ul');
    healthList.className = 'summary-panel__health-list';

    // Circular dependencies check
    healthList.appendChild(
      this.#createHealthItem(
        !healthStatus.hasCircularDeps,
        healthStatus.hasCircularDeps
          ? 'Circular dependencies detected'
          : 'No circular dependencies'
      )
    );

    // Missing dependencies check
    const hasMissing =
      healthStatus.missingDeps && healthStatus.missingDeps.length > 0;
    healthList.appendChild(
      this.#createHealthItem(
        !hasMissing,
        hasMissing
          ? `Missing dependencies: ${healthStatus.missingDeps.length}`
          : 'All dependencies resolved'
      )
    );

    // Load order validity check
    healthList.appendChild(
      this.#createHealthItem(
        healthStatus.loadOrderValid,
        healthStatus.loadOrderValid
          ? 'Load order is valid'
          : 'Load order has issues'
      )
    );

    content.appendChild(healthList);

    // Error messages
    if (hasErrors) {
      const errorContainer = document.createElement('div');
      errorContainer.className = 'summary-panel__health-messages';
      for (const error of healthStatus.errors) {
        const errorEl = document.createElement('p');
        errorEl.className = 'summary-panel__health-error';
        errorEl.textContent = error; // textContent is XSS-safe
        errorContainer.appendChild(errorEl);
      }
      content.appendChild(errorContainer);
    }

    // Warning messages
    if (hasWarnings) {
      const warningContainer = document.createElement('div');
      warningContainer.className = 'summary-panel__health-messages';
      for (const warning of healthStatus.warnings) {
        const warningEl = document.createElement('p');
        warningEl.className = 'summary-panel__health-warning';
        warningEl.textContent = warning; // textContent is XSS-safe
        warningContainer.appendChild(warningEl);
      }
      content.appendChild(warningContainer);
    }

    // Summary counts
    const summary = document.createElement('div');
    summary.className = 'summary-panel__health-summary';
    const errorCount = healthStatus.errors?.length || 0;
    const warningCount = healthStatus.warnings?.length || 0;
    summary.innerHTML = `
      <span class="summary-panel__health-summary-item">
        <span class="summary-panel__health-summary-count">${errorCount}</span> errors
      </span>
      <span class="summary-panel__health-summary-item">
        <span class="summary-panel__health-summary-count">${warningCount}</span> warnings
      </span>
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
   * Create a health check list item
   *
   * @param {boolean} isHealthy - Whether this check passed
   * @param {string} message - Description of the check
   * @returns {HTMLElement}
   */
  #createHealthItem(isHealthy, message) {
    const item = document.createElement('li');
    item.className = `summary-panel__health-item summary-panel__health-item--${isHealthy ? 'ok' : 'fail'}`;
    item.innerHTML = `
      <span class="summary-panel__health-icon" aria-hidden="true">${isHealthy ? '✓' : '✗'}</span>
      <span class="summary-panel__health-text">${this.#escapeHtml(message)}</span>
    `;
    return item;
  }

  /**
   * Set saving state for button
   *
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
   *
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
   *
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
