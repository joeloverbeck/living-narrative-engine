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
  #depthSection;
  #footprintSection;
  #profileSection;
  #fragilitySection;
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

    // Depth section (placeholder - content rendered dynamically)
    this.#depthSection = document.createElement('section');
    this.#depthSection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#depthSection.setAttribute('aria-label', 'Dependency depth analysis');

    // Footprint section (placeholder - content rendered dynamically)
    this.#footprintSection = document.createElement('section');
    this.#footprintSection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#footprintSection.setAttribute(
      'aria-label',
      'Dependency footprint analysis'
    );

    // Profile section (placeholder - content rendered dynamically)
    this.#profileSection = document.createElement('section');
    this.#profileSection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#profileSection.setAttribute('aria-label', 'Configuration profile');

    // Fragility section (placeholder - content rendered dynamically)
    this.#fragilitySection = document.createElement('section');
    this.#fragilitySection.className =
      'summary-panel__section summary-panel__section--collapsible';
    this.#fragilitySection.setAttribute('aria-label', 'Fragility warnings');

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
    this.#container.appendChild(this.#depthSection);
    this.#container.appendChild(this.#footprintSection);
    this.#container.appendChild(this.#profileSection);
    this.#container.appendChild(this.#fragilitySection);
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
   * @param {object|null} [options.depthAnalysis] - Dependency depth analysis from ModStatisticsService
   * @param {number} [options.depthAnalysis.maxDepth] - Maximum dependency chain depth
   * @param {string[]} [options.depthAnalysis.deepestChain] - Mod IDs in the deepest chain
   * @param {number} [options.depthAnalysis.averageDepth] - Average depth across all mods
   * @param {object|null} [options.footprintAnalysis] - Transitive dependency footprint from ModStatisticsService
   * @param {Array<{modId: string, dependencies: string[], count: number}>} [options.footprintAnalysis.footprints] - Per-mod footprints
   * @param {number} [options.footprintAnalysis.totalUniqueDeps] - Total unique dependencies
   * @param {number} [options.footprintAnalysis.sharedDepsCount] - Number of shared dependencies
   * @param {number} [options.footprintAnalysis.overlapPercentage] - Percentage of dependencies shared
   * @param {object|null} [options.profileRatio] - Core vs optional ratio from ModStatisticsService
   * @param {number} [options.profileRatio.foundationCount] - Number of foundation mods
   * @param {number} [options.profileRatio.optionalCount] - Number of optional mods
   * @param {number} [options.profileRatio.totalActive] - Total active mods
   * @param {number} [options.profileRatio.foundationPercentage] - Foundation percentage (0-100)
   * @param {number} [options.profileRatio.optionalPercentage] - Optional percentage (0-100)
   * @param {string} [options.profileRatio.profile] - Profile classification ('foundation-heavy' | 'balanced' | 'content-heavy')
   * @param {object|null} [options.fragilityAnalysis] - Orphan risk analysis from ModStatisticsService
   * @param {Array<{modId: string, singleDependent: string, status: string}>} [options.fragilityAnalysis.atRiskMods] - At-risk mods
   * @param {number} [options.fragilityAnalysis.totalAtRisk] - Total count of at-risk mods
   * @param {number} [options.fragilityAnalysis.percentageOfDeps] - Percentage of all dependencies at risk
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
    depthAnalysis = null,
    footprintAnalysis = null,
    profileRatio = null,
    fragilityAnalysis = null,
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

    // Update depth section
    this.#renderDepthSection(depthAnalysis);

    // Update footprint section
    this.#renderFootprintSection(footprintAnalysis);

    // Update profile section
    this.#renderProfileSection(profileRatio);

    // Update fragility section
    this.#renderFragilitySection(fragilityAnalysis);

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
   * Render dependency depth section
   *
   * @param {object|null} depthAnalysis - Depth analysis from ModStatisticsService
   * @param {number} depthAnalysis.maxDepth - Maximum dependency chain depth
   * @param {string[]} depthAnalysis.deepestChain - Mod IDs in deepest chain
   * @param {number} depthAnalysis.averageDepth - Average depth across all mods
   */
  #renderDepthSection(depthAnalysis) {
    this.#depthSection.innerHTML = '';

    // Hide section if no depth analysis data
    if (!depthAnalysis) {
      this.#depthSection.hidden = true;
      return;
    }
    this.#depthSection.hidden = false;

    // Section header (collapsible button) - starts collapsed
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
      <span class="summary-panel__section-title">Dependency Depth</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▶</span>
    `;

    // Section content - starts collapsed
    const content = document.createElement('div');
    content.className =
      'summary-panel__section-content summary-panel__section-content--collapsed';

    if (!depthAnalysis || depthAnalysis.maxDepth === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'summary-panel__empty';
      emptyMessage.textContent = 'No active mods';
      content.appendChild(emptyMessage);
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
      header.setAttribute('aria-expanded', String(!isExpanded));
      content.classList.toggle('summary-panel__section-content--collapsed');
      const toggle = header.querySelector('.summary-panel__section-toggle');
      if (toggle) {
        toggle.textContent = isExpanded ? '▶' : '▼';
      }
    });

    this.#depthSection.appendChild(header);
    this.#depthSection.appendChild(content);
  }

  /**
   * Render dependency footprint section
   *
   * @param {object|null} footprintAnalysis - Footprint analysis from ModStatisticsService
   * @param {Array<{modId: string, dependencies: string[], count: number}>} [footprintAnalysis.footprints] - Per-mod footprints
   * @param {number} [footprintAnalysis.totalUniqueDeps] - Total unique dependencies
   * @param {number} [footprintAnalysis.sharedDepsCount] - Number of shared dependencies
   * @param {number} [footprintAnalysis.overlapPercentage] - Percentage of dependencies shared
   */
  #renderFootprintSection(footprintAnalysis) {
    this.#footprintSection.innerHTML = '';

    // Hide section if no footprint data
    if (!footprintAnalysis) {
      this.#footprintSection.hidden = true;
      return;
    }
    this.#footprintSection.hidden = false;

    // Section header (collapsible button) - starts collapsed
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
      <span class="summary-panel__section-title">Dependency Footprint</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▶</span>
    `;

    // Section content - starts collapsed
    const content = document.createElement('div');
    content.className =
      'summary-panel__section-content summary-panel__section-content--collapsed';

    if (!footprintAnalysis.footprints || footprintAnalysis.footprints.length === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'summary-panel__empty';
      emptyMessage.textContent = 'No explicit mods';
      content.appendChild(emptyMessage);
    } else {
      // Overlap summary
      const overlapSummary = document.createElement('div');
      overlapSummary.className = 'summary-panel__footprint-overlap';
      overlapSummary.innerHTML = `
        <span class="summary-panel__footprint-overlap-value">${footprintAnalysis.overlapPercentage}%</span>
        <span class="summary-panel__footprint-overlap-label">dependencies shared</span>
      `;
      content.appendChild(overlapSummary);

      // Per-mod footprint list
      const list = document.createElement('ul');
      list.className = 'summary-panel__footprint-list';

      for (const footprint of footprintAnalysis.footprints) {
        const item = document.createElement('li');
        item.className = 'summary-panel__footprint-item';

        // Create deps preview (first 3)
        const depsPreview = footprint.dependencies.slice(0, 3).join(', ');
        const hasMore = footprint.dependencies.length > 3;

        item.innerHTML = `
          <div class="summary-panel__footprint-header">
            <span class="summary-panel__footprint-mod">${this.#escapeHtml(footprint.modId)}</span>
            <span class="summary-panel__footprint-count">+${footprint.count} deps</span>
          </div>
          <div class="summary-panel__footprint-deps">
            ${this.#escapeHtml(depsPreview)}${hasMore ? ', ...' : ''}
          </div>
        `;

        list.appendChild(item);
      }

      content.appendChild(list);

      // Summary footer
      const footer = document.createElement('div');
      footer.className = 'summary-panel__footprint-footer';
      footer.innerHTML = `
        <span>Total unique: ${footprintAnalysis.totalUniqueDeps}</span>
        <span>Shared: ${footprintAnalysis.sharedDepsCount}</span>
      `;
      content.appendChild(footer);
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

    this.#footprintSection.appendChild(header);
    this.#footprintSection.appendChild(content);
  }

  /**
   * Render configuration profile section
   *
   * @param {object|null} profileRatio - Profile ratio from ModStatisticsService
   * @param {number} profileRatio.foundationCount - Foundation mod count
   * @param {number} profileRatio.optionalCount - Optional mod count
   * @param {number} profileRatio.totalActive - Total active mods
   * @param {number} profileRatio.foundationPercentage - 0-100
   * @param {number} profileRatio.optionalPercentage - 0-100
   * @param {string} profileRatio.profile - 'foundation-heavy' | 'balanced' | 'content-heavy'
   */
  #renderProfileSection(profileRatio) {
    this.#profileSection.innerHTML = '';

    // Hide section if no profile data
    if (!profileRatio) {
      this.#profileSection.hidden = true;
      return;
    }
    this.#profileSection.hidden = false;

    // Section header (collapsible button) - starts collapsed
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'false');
    header.innerHTML = `
      <span class="summary-panel__section-title">Configuration Profile</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▶</span>
    `;

    // Section content - starts collapsed
    const content = document.createElement('div');
    content.className =
      'summary-panel__section-content summary-panel__section-content--collapsed';

    if (profileRatio.totalActive === 0) {
      const emptyMessage = document.createElement('p');
      emptyMessage.className = 'summary-panel__empty';
      emptyMessage.textContent = 'No active mods';
      content.appendChild(emptyMessage);
    } else {
      // Profile badge
      const badge = document.createElement('div');
      badge.className = `summary-panel__profile-badge summary-panel__profile-badge--${profileRatio.profile}`;
      badge.textContent = this.#formatProfileLabel(profileRatio.profile);
      content.appendChild(badge);

      // Ratio bar visualization
      const barContainer = document.createElement('div');
      barContainer.className = 'summary-panel__profile-bar-container';

      const foundationBar = document.createElement('div');
      foundationBar.className =
        'summary-panel__profile-bar summary-panel__profile-bar--foundation';
      foundationBar.style.width = `${profileRatio.foundationPercentage}%`;
      foundationBar.setAttribute(
        'aria-label',
        `Foundation: ${profileRatio.foundationPercentage}%`
      );

      const optionalBar = document.createElement('div');
      optionalBar.className =
        'summary-panel__profile-bar summary-panel__profile-bar--optional';
      optionalBar.style.width = `${profileRatio.optionalPercentage}%`;
      optionalBar.setAttribute(
        'aria-label',
        `Optional: ${profileRatio.optionalPercentage}%`
      );

      barContainer.appendChild(foundationBar);
      barContainer.appendChild(optionalBar);
      content.appendChild(barContainer);

      // Legend
      const legend = document.createElement('div');
      legend.className = 'summary-panel__profile-legend';
      legend.innerHTML = `
        <div class="summary-panel__profile-legend-item">
          <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--foundation"></span>
          <span>Foundation: ${profileRatio.foundationCount} (${profileRatio.foundationPercentage}%)</span>
        </div>
        <div class="summary-panel__profile-legend-item">
          <span class="summary-panel__profile-legend-color summary-panel__profile-legend-color--optional"></span>
          <span>Optional: ${profileRatio.optionalCount} (${profileRatio.optionalPercentage}%)</span>
        </div>
      `;
      content.appendChild(legend);

      // Total count
      const total = document.createElement('div');
      total.className = 'summary-panel__profile-total';
      total.textContent = `Total Active: ${profileRatio.totalActive}`;
      content.appendChild(total);
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

    this.#profileSection.appendChild(header);
    this.#profileSection.appendChild(content);
  }


  /**
   * Render fragility warnings section
   * @param {object|null} fragilityAnalysis - From ModStatisticsService.getSingleParentDependencies()
   * @param {Array<{modId: string, singleDependent: string, status: string}>} [fragilityAnalysis.atRiskMods]
   * @param {number} [fragilityAnalysis.totalAtRisk]
   * @param {number} [fragilityAnalysis.percentageOfDeps]
   */
  #renderFragilitySection(fragilityAnalysis) {
    this.#fragilitySection.innerHTML = '';

    // Hide section if no data
    if (!fragilityAnalysis) {
      this.#fragilitySection.hidden = true;
      return;
    }
    this.#fragilitySection.hidden = false;

    // Section header (collapsible button) - starts collapsed
    const header = document.createElement('button');
    header.className = 'summary-panel__section-header';
    header.type = 'button';
    header.setAttribute('aria-expanded', 'false');

    // Add warning indicator if there are at-risk mods
    const warningIcon = fragilityAnalysis.totalAtRisk > 0 ? '⚠️ ' : '';
    header.innerHTML = `
      <span class="summary-panel__section-title">${warningIcon}Fragility Warnings</span>
      <span class="summary-panel__section-toggle" aria-hidden="true">▶</span>
    `;

    // Section content - starts collapsed
    const content = document.createElement('div');
    content.className =
      'summary-panel__section-content summary-panel__section-content--collapsed';

    if (fragilityAnalysis.totalAtRisk === 0) {
      const successMessage = document.createElement('p');
      successMessage.className = 'summary-panel__success';
      successMessage.textContent = 'No fragile dependencies detected';
      content.appendChild(successMessage);
    } else {
      // Summary stats
      const stats = document.createElement('div');
      stats.className = 'summary-panel__fragility-stats';
      stats.innerHTML = `
        <span class="summary-panel__fragility-count">${fragilityAnalysis.totalAtRisk}</span>
        <span class="summary-panel__fragility-label">at-risk dependencies (${fragilityAnalysis.percentageOfDeps}% of all deps)</span>
      `;
      content.appendChild(stats);

      // Explanation
      const explanation = document.createElement('p');
      explanation.className = 'summary-panel__fragility-explanation';
      explanation.textContent =
        'These mods have only one dependent. If that dependent is disabled, these become orphaned.';
      content.appendChild(explanation);

      // At-risk list
      const list = document.createElement('ul');
      list.className = 'summary-panel__fragility-list';

      for (const risk of fragilityAnalysis.atRiskMods) {
        const item = document.createElement('li');
        item.className = 'summary-panel__fragility-item';

        const statusBadge = risk.status === 'core' ? 'core' : 'dep';
        const badgeClass =
          risk.status === 'core' ? 'core' : 'dependency';

        item.innerHTML = `
          <div class="summary-panel__fragility-row">
            <span class="summary-panel__fragility-badge summary-panel__fragility-badge--${badgeClass}">${statusBadge}</span>
            <span class="summary-panel__fragility-mod">${this.#escapeHtml(risk.modId)}</span>
          </div>
          <div class="summary-panel__fragility-dependent">
            ← only used by <strong>${this.#escapeHtml(risk.singleDependent)}</strong>
          </div>
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

    this.#fragilitySection.appendChild(header);
    this.#fragilitySection.appendChild(content);
  }

  /**
   * Format profile label for display
   *
   * @param {string} profile - Profile classification
   * @returns {string} Human-readable label
   */
  #formatProfileLabel(profile) {
    const labels = {
      'foundation-heavy': 'Foundation Heavy',
      'content-heavy': 'Content Heavy',
      balanced: 'Balanced',
    };
    return labels[profile] || profile;
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
