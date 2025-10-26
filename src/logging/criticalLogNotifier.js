/**
 * @file Visual notification system for critical logs
 * @see consoleLogger.js, rendererBase.js
 */

import { RendererBase } from '../domUI/rendererBase.js';
import DragHandler from './dragHandler.js';
import LogFilter from './logFilter.js';
import KeyboardShortcutsManager from './keyboardShortcutsManager.js';
import LogExporter from './logExporter.js';

/** @typedef {import('./types.js').CriticalLogEntry} CriticalLogEntry */
/** @typedef {import('./types.js').NotifierConfig} NotifierConfig */
/** @typedef {import('./types.js').LogCounts} LogCounts */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * Visual notification system for critical logs (warnings and errors).
 * Extends RendererBase for automatic dependency management and cleanup.
 * Manages its own internal buffer for critical log data.
 */
class CriticalLogNotifier extends RendererBase {
  #config;
  #logger;
  #logCounts = { warnings: 0, errors: 0 };
  #recentLogs = [];
  #criticalBuffer = [];
  #maxBufferSize = 100;
  #maxRecentLogs = 20;
  #isExpanded = false;
  #isDismissed = false;
  #position;
  #container = null;
  #badgeContainer = null;
  #panel = null;
  #updateTimer = null;
  #animationTimer = null;
  #dragHandler = null;
  #logFilter = null;
  #keyboardManager = null;
  #exporter = null;
  #processingCriticalLog = false;

  /**
   * Creates a new CriticalLogNotifier instance.
   *
   * @param {object} dependencies - Dependencies object
   * @param {ILogger} dependencies.logger - Logger instance for internal logging and intercepting critical logs
   * @param {IDocumentContext} dependencies.documentContext - Document context abstraction
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Event dispatcher
   * @param {NotifierConfig} [dependencies.config] - Configuration object
   */
  constructor({
    logger,
    documentContext,
    validatedEventDispatcher,
    config = {},
  }) {
    super({ logger, documentContext, validatedEventDispatcher });

    this.#logger = logger;
    this.#config = this.#validateConfig(config);
    this.#maxRecentLogs = this.#config.maxRecentLogs || 20;
    this.#maxBufferSize = this.#config.maxBufferSize || 100;
    this.#position = this.#loadPosition();

    // Intercept critical logs from the logger
    this.#interceptCriticalLogs();

    // Initialize LogExporter
    this.#exporter = new LogExporter({
      logger: this.logger,
      appInfo: {
        name: 'Living Narrative Engine',
        version: '0.0.1',
      },
    });

    this.#initialize();

    this.logger.debug(
      `${this._logPrefix} Initialized with position: ${this.#position}`
    );
  }

  /**
   * Validates and applies default configuration values.
   *
   * @param {Partial<NotifierConfig>} config - User configuration
   * @returns {NotifierConfig} Complete configuration
   * @private
   */
  #validateConfig(config) {
    const defaults = {
      enableVisualNotifications: true,
      notificationPosition: 'top-right',
      autoDismissAfter: null,
      soundEnabled: false,
      maxRecentLogs: 20,
      alwaysShowInConsole: true,
    };

    return { ...defaults, ...config };
  }

  /**
   * Initialize the notifier if visual notifications are enabled.
   *
   * @private
   */
  #initialize() {
    if (!this.#config.enableVisualNotifications) {
      this.logger.debug(`${this._logPrefix} Visual notifications disabled`);
      return;
    }

    this.#createContainer();
    this.#initializeLogFilter();
    this.#initializeKeyboardManager();
    this.#attachEventListeners();
    this.#startUpdateTimer();

    // Add drag functionality
    this.#enableDragging();

    // Set up auto-dismiss if configured
    if (this.#config.autoDismissAfter) {
      this.#setupAutoDismiss();
    }

    // Subscribe to critical log events if available
    this._subscribe('CRITICAL_LOG_ADDED', (event) => {
      this.#handleNewCriticalLog(event.payload);
    });
  }

  /**
   * Creates the main container and UI elements.
   *
   * @private
   */
  #createContainer() {
    // Remove any existing notifier
    const existing = this.documentContext.query('.lne-critical-log-notifier');
    if (existing) {
      existing.remove();
    }

    this.#container = this.documentContext.create('div');
    this.#container.className = 'lne-critical-log-notifier';
    this.#container.setAttribute('data-position', this.#position);
    this.#container.hidden = true;

    // Add smooth transition styles
    this.#applyContainerStyles(this.#container);

    // Create badge container
    this.#badgeContainer = this.#createBadgeContainer();
    this.#container.appendChild(this.#badgeContainer);

    // Create expandable panel
    this.#panel = this.#createPanel();
    this.#container.appendChild(this.#panel);

    // Add to DOM
    this.documentContext.query('body').appendChild(this.#container);
  }

  /**
   * Applies animation styles to the main container.
   *
   * @private
   * @param {HTMLElement} container - Container element
   */
  #applyContainerStyles(container) {
    container.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    container.style.transformOrigin = 'top right';
  }

  /**
   * Creates the badge container with warning and error badges.
   *
   * @private
   * @returns {HTMLElement} Badge container element
   */
  #createBadgeContainer() {
    const container = this.documentContext.create('div');
    container.className = 'lne-badge-container';
    container.setAttribute('role', 'status');
    container.setAttribute('aria-label', 'Critical log notifications');

    // Create warning badge
    const warningBadge = this.documentContext.create('span');
    warningBadge.className = 'lne-warning-badge';
    warningBadge.hidden = true;
    warningBadge.setAttribute('aria-label', 'Warning count');

    // Create error badge
    const errorBadge = this.documentContext.create('span');
    errorBadge.className = 'lne-error-badge';
    errorBadge.hidden = true;
    errorBadge.setAttribute('aria-label', 'Error count');

    container.appendChild(warningBadge);
    container.appendChild(errorBadge);

    return container;
  }

  /**
   * Creates the expandable log panel.
   *
   * @private
   * @returns {HTMLElement} Panel element
   */
  #createPanel() {
    const panel = this.documentContext.create('div');
    panel.className = 'lne-log-panel';
    panel.hidden = true;
    panel.setAttribute('role', 'log');
    panel.setAttribute('aria-label', 'Critical logs panel');

    // Add animation styles
    panel.style.transition = 'opacity 0.2s ease, transform 0.2s ease-out';
    panel.style.transformOrigin = 'top right';
    panel.style.opacity = '0';
    panel.style.transform = 'scaleY(0)';

    // Header
    const header = this.documentContext.create('div');
    header.className = 'lne-log-header';

    const title = this.documentContext.create('span');
    title.textContent = 'Recent Critical Logs';

    const clearBtn = this.documentContext.create('button');
    clearBtn.className = 'lne-clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear all logs');

    const exportBtn = this.documentContext.create('button');
    exportBtn.className = 'lne-export-btn';
    exportBtn.innerHTML = '📥 Export';
    exportBtn.setAttribute('aria-label', 'Export logs');
    exportBtn.setAttribute('title', 'Export logs (Ctrl+Shift+E)');

    const closeBtn = this.documentContext.create('button');
    closeBtn.className = 'lne-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close panel');

    header.appendChild(title);
    header.appendChild(exportBtn);
    header.appendChild(clearBtn);
    header.appendChild(closeBtn);

    // Log list
    const logList = this.documentContext.create('div');
    logList.className = 'lne-log-list';

    // Export menu
    const exportMenu = this.#createExportMenu();
    header.appendChild(exportMenu);

    // Filter bar
    const filterBar = this.#createFilterBar();

    panel.appendChild(header);
    panel.appendChild(filterBar);
    panel.appendChild(logList);

    return panel;
  }

  /**
   * Creates the filter bar with search and filter controls.
   *
   * @private
   * @returns {HTMLElement} Filter bar element
   */
  #createFilterBar() {
    const filterBar = this.documentContext.create('div');
    filterBar.className = 'lne-filter-bar';

    // Search input
    const searchInput = this.documentContext.create('input');
    searchInput.className = 'lne-search-input';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search logs...';
    searchInput.setAttribute('aria-label', 'Search logs');

    // Level filter
    const levelFilter = this.documentContext.create('select');
    levelFilter.className = 'lne-level-filter';
    levelFilter.setAttribute('aria-label', 'Filter by level');

    const levelOptions = [
      { value: 'all', text: 'All Levels' },
      { value: 'warn', text: 'Warnings' },
      { value: 'error', text: 'Errors' },
    ];

    levelOptions.forEach((option) => {
      const optionElement = this.documentContext.create('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      levelFilter.appendChild(optionElement);
    });

    // Category filter
    const categoryFilter = this.documentContext.create('select');
    categoryFilter.className = 'lne-category-filter';
    categoryFilter.setAttribute('aria-label', 'Filter by category');

    // Time range filter
    const timeFilter = this.documentContext.create('select');
    timeFilter.className = 'lne-time-filter';
    timeFilter.setAttribute('aria-label', 'Filter by time range');

    const timeOptions = [
      { value: 'all', text: 'All Time' },
      { value: 'last5min', text: 'Last 5 min' },
      { value: 'last15min', text: 'Last 15 min' },
      { value: 'last30min', text: 'Last 30 min' },
      { value: 'lasthour', text: 'Last hour' },
    ];

    timeOptions.forEach((option) => {
      const optionElement = this.documentContext.create('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      timeFilter.appendChild(optionElement);
    });

    // Filter stats
    const filterStats = this.documentContext.create('div');
    filterStats.className = 'lne-filter-stats';

    filterBar.appendChild(searchInput);
    filterBar.appendChild(levelFilter);
    filterBar.appendChild(categoryFilter);
    filterBar.appendChild(timeFilter);
    filterBar.appendChild(filterStats);

    return filterBar;
  }

  /**
   * Creates the export menu with format options.
   *
   * @private
   * @returns {HTMLElement} Export menu element
   */
  #createExportMenu() {
    const menu = this.documentContext.create('div');
    menu.className = 'lne-export-menu';
    menu.hidden = true;

    const formats = [
      { value: 'json', label: 'JSON', icon: '📄' },
      { value: 'csv', label: 'CSV', icon: '📊' },
      { value: 'text', label: 'Text', icon: '📝' },
      { value: 'markdown', label: 'Markdown', icon: '📑' },
      { value: 'clipboard', label: 'Copy to Clipboard', icon: '📋' },
    ];

    formats.forEach((format) => {
      const button = this.documentContext.create('button');
      button.className = 'lne-export-option';
      button.setAttribute('data-format', format.value);
      button.innerHTML = `${format.icon} Export as ${format.label}`;
      menu.appendChild(button);
    });

    return menu;
  }

  /**
   * Initialize the log filter component.
   *
   * @private
   */
  #initializeLogFilter() {
    this.#logFilter = new LogFilter({
      logger: this.logger,
      callbacks: {
        onFilterChange: (filteredLogs, stats) => {
          this.#updateLogDisplay(filteredLogs);
          this.#updateFilterStats(stats);
        },
      },
    });
  }

  /**
   * Initialize the enhanced keyboard manager.
   *
   * @private
   */
  #initializeKeyboardManager() {
    this.#keyboardManager = new KeyboardShortcutsManager({
      logger: this.logger,
      documentContext: this.documentContext.document,
    });

    this.#keyboardManager.setActionCallback((action, event) => {
      this.#handleShortcutAction(action, event);
    });
  }

  /**
   * Attaches DOM event listeners using RendererBase's managed system.
   *
   * @private
   */
  #attachEventListeners() {
    // Badge click to expand/collapse
    this._addDomListener(this.#badgeContainer, 'click', () => {
      this.#handleToggle();
    });

    // Right-click dismiss on badge
    this._addDomListener(this.#badgeContainer, 'contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.#handleDismiss();
      this.logger.debug(`${this._logPrefix} Right-click dismiss triggered`);
    });

    // Clear button
    const clearBtn = this.#panel.querySelector('.lne-clear-btn');
    this._addDomListener(clearBtn, 'click', () => {
      this.#handleClear();
    });

    // Close button
    const closeBtn = this.#panel.querySelector('.lne-close-btn');
    this._addDomListener(closeBtn, 'click', () => {
      this.#handleCollapse();
    });

    // Dismiss on outside click
    this._addDomListener(
      this.documentContext.query('body'),
      'click',
      (event) => {
        if (!this.#container.contains(event.target) && this.#isExpanded) {
          this.#handleCollapse();
        }
      }
    );

    // Export button and menu event listeners
    this.#attachExportListeners();

    // Filter controls event listeners
    this.#attachFilterListeners();

    // Setup keyboard shortcuts
    this.#setupKeyboardShortcuts();
  }

  /**
   * Attach event listeners for filter controls.
   *
   * @private
   */
  #attachFilterListeners() {
    const searchInput = this.#panel.querySelector('.lne-search-input');
    const levelFilter = this.#panel.querySelector('.lne-level-filter');
    const categoryFilter = this.#panel.querySelector('.lne-category-filter');
    const timeFilter = this.#panel.querySelector('.lne-time-filter');

    // Search input with debouncing
    let searchTimeout;
    this._addDomListener(searchInput, 'input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        this.#logFilter.setFilter({ searchText: e.target.value });
      }, 300);
    });

    // Level filter
    this._addDomListener(levelFilter, 'change', (e) => {
      this.#logFilter.setFilter({ level: e.target.value });
    });

    // Category filter
    this._addDomListener(categoryFilter, 'change', (e) => {
      this.#logFilter.setFilter({ category: e.target.value });
    });

    // Time filter
    this._addDomListener(timeFilter, 'change', (e) => {
      this.#logFilter.setFilter({ timeRange: e.target.value });
    });
  }

  /**
   * Attach event listeners for export controls.
   *
   * @private
   */
  #attachExportListeners() {
    const exportBtn = this.#panel.querySelector('.lne-export-btn');
    const exportMenu = this.#panel.querySelector('.lne-export-menu');

    this._addDomListener(exportBtn, 'click', (e) => {
      e.stopPropagation();
      exportMenu.hidden = !exportMenu.hidden;
    });

    // Export format selection
    this._addDomListener(exportMenu, 'click', (e) => {
      if (e.target.classList.contains('lne-export-option')) {
        const format = e.target.getAttribute('data-format');
        this.exportLogs(format, { filtered: true });
        exportMenu.hidden = true;
      }
    });

    // Hide menu when clicking outside
    this._addDomListener(
      this.documentContext.query('body'),
      'click',
      (event) => {
        if (
          !exportBtn.contains(event.target) &&
          !exportMenu.contains(event.target)
        ) {
          exportMenu.hidden = true;
        }
      }
    );
  }

  /**
   * Sets up keyboard shortcuts for notification control.
   *
   * @private
   */
  #setupKeyboardShortcuts() {
    // Now handled by KeyboardShortcutsManager
    this.#keyboardManager.enable();
  }

  /**
   * Handle keyboard shortcut actions.
   *
   * @private
   * @param {string} action - The shortcut action to handle
   * @param {Event} _event - The keyboard event (unused)
   */
  #handleShortcutAction(action, _event) {
    switch (action) {
      case 'close-panel':
      case 'toggle-panel':
        // Use existing methods
        if (action === 'close-panel' && this.#isExpanded) {
          this.#handleCollapse();
        } else if (action === 'toggle-panel') {
          this.#handleToggle();
        }
        break;
      case 'clear-all':
        this.#handleClear();
        break;
      case 'dismiss':
        this.#handleDismiss();
        break;
      case 'focus-search':
        this.#focusSearchInput();
        break;
      case 'filter-warnings':
        this.#logFilter.setFilter({ level: 'warn' });
        this.#updateFilterUI();
        break;
      case 'filter-errors':
        this.#logFilter.setFilter({ level: 'error' });
        this.#updateFilterUI();
        break;
      case 'filter-all':
        this.#logFilter.setFilter({ level: 'all' });
        this.#updateFilterUI();
        break;
      case 'export': {
        if (!this.#isExpanded) {
          this.#handleExpand();
        }
        const exportBtn = this.#panel.querySelector('.lne-export-btn');
        if (exportBtn) {
          exportBtn.click();
        }
        break;
      }
      // Navigation handled in future iteration
    }
  }

  /**
   * Focus the search input field.
   *
   * @private
   */
  #focusSearchInput() {
    if (!this.#isExpanded) {
      this.#handleExpand();
    }

    const searchInput = this.#panel.querySelector('.lne-search-input');
    if (searchInput) {
      searchInput.focus();
    }
  }

  /**
   * Export logs in specified format
   *
   * @param {string} format - Export format ('json', 'csv', 'text', 'markdown', 'clipboard')
   * @param {object} options - Export options
   */
  async exportLogs(format = 'json', options = {}) {
    try {
      const logs =
        options.filtered && this.#logFilter
          ? this.#logFilter.getFilteredLogs()
          : this.#recentLogs;

      const exportOptions = {
        filters: this.#logFilter?.getFilter(),
        totalLogs: this.#recentLogs.length,
        format,
      };

      let content;
      let filename;
      let mimeType;

      switch (format) {
        case 'json':
          content = this.#exporter.exportAsJSON(logs, exportOptions);
          filename = this.#exporter.generateFilename('critical-logs', 'json');
          mimeType = 'application/json';
          break;

        case 'csv':
          content = this.#exporter.exportAsCSV(logs, exportOptions);
          filename = this.#exporter.generateFilename('critical-logs', 'csv');
          mimeType = 'text/csv';
          break;

        case 'text':
          content = this.#exporter.exportAsText(logs, exportOptions);
          filename = this.#exporter.generateFilename('critical-logs', 'txt');
          mimeType = 'text/plain';
          break;

        case 'markdown':
          content = this.#exporter.exportAsMarkdown(logs, exportOptions);
          filename = this.#exporter.generateFilename('critical-logs', 'md');
          mimeType = 'text/markdown';
          break;

        case 'clipboard': {
          // Default to JSON for clipboard
          content = this.#exporter.exportAsJSON(logs, exportOptions);
          const success = await this.#exporter.copyToClipboard(content);

          this.validatedEventDispatcher.dispatch('core:export_notification', {
            message: success
              ? 'Logs copied to clipboard'
              : 'Failed to copy to clipboard',
            type: success ? 'success' : 'error',
          });
          return;
        }

        default:
          this.logger.error(`Unknown export format: ${format}`);
          return;
      }

      // Download file
      this.#exporter.downloadAsFile(content, filename, mimeType);

      this.validatedEventDispatcher.dispatch('core:export_notification', {
        message: `Exported ${logs.length} logs as ${format.toUpperCase()}`,
        type: 'success',
      });

      this.logger.debug(`Export completed: ${format}, ${logs.length} logs`);
    } catch (error) {
      this.logger.error('Export failed', error);
      this.validatedEventDispatcher.dispatch('core:export_notification', {
        message: 'Export failed - see console for details',
        type: 'error',
      });
    }
  }

  /**
   * Update filter UI to reflect current filter state.
   *
   * @private
   */
  #updateFilterUI() {
    const filterCriteria = this.#logFilter.getFilter();

    const levelFilter = this.#panel.querySelector('.lne-level-filter');
    const categoryFilter = this.#panel.querySelector('.lne-category-filter');
    const timeFilter = this.#panel.querySelector('.lne-time-filter');

    if (levelFilter) levelFilter.value = filterCriteria.level;
    if (categoryFilter) categoryFilter.value = filterCriteria.category;
    if (timeFilter) timeFilter.value = filterCriteria.timeRange;
  }

  /**
   * Update the log display with filtered logs.
   *
   * @private
   * @param {Array} filteredLogs - Filtered log entries
   */
  #updateLogDisplay(filteredLogs) {
    if (this.#isExpanded) {
      this.#updateLogPanel(filteredLogs);
    }
  }

  /**
   * Update filter statistics display.
   *
   * @private
   * @param {object} stats - Filter statistics
   */
  #updateFilterStats(stats) {
    const filterStats = this.#panel.querySelector('.lne-filter-stats');
    if (filterStats) {
      filterStats.textContent = `${stats.filtered} of ${stats.total} logs (${stats.warnings} warnings, ${stats.errors} errors)`;
    }

    // Update category filter options
    this.#updateCategoryOptions(this.#logFilter.getCategories());
  }

  /**
   * Update category filter options dynamically.
   *
   * @private
   * @param {Array} categories - Available categories
   */
  #updateCategoryOptions(categories) {
    const categoryFilter = this.#panel.querySelector('.lne-category-filter');
    if (!categoryFilter) return;

    const currentValue = categoryFilter.value;
    categoryFilter.innerHTML = '';

    categories.forEach((category) => {
      const option = this.documentContext.create('option');
      option.value = category;
      option.textContent = category === 'all' ? 'All Categories' : category;
      categoryFilter.appendChild(option);
    });

    // Restore selection if still valid
    if (categories.includes(currentValue)) {
      categoryFilter.value = currentValue;
    }
  }

  /**
   * Starts the update timer to refresh log data periodically.
   *
   * @private
   */
  #startUpdateTimer() {
    this.#updateTimer = setInterval(() => {
      this.#updateFromLogger();
    }, 1000); // Update every second
  }

  /**
   * Updates log data from logger's critical buffer.
   *
   * @private
   */
  #updateFromLogger() {
    if (this.#isDismissed) {
      return;
    }

    try {
      // Get logs from internal buffer
      const logs = this.#getCriticalLogs({
        limit: this.#maxRecentLogs,
      });

      // Update counts from logs
      this.#logCounts.warnings = logs.filter(
        (log) => log.level === 'warn'
      ).length;
      this.#logCounts.errors = logs.filter(
        (log) => log.level === 'error'
      ).length;

      // Update recent logs with display time
      this.#recentLogs = logs.map((log) => ({
        ...log,
        displayTime: new Date(log.timestamp).toLocaleTimeString(),
      }));

      // Update the filter with new logs
      if (this.#logFilter) {
        this.#logFilter.setLogs(this.#recentLogs);
      }

      this.#updateDisplay();
    } catch (error) {
      this.logger.error(
        `${this._logPrefix} Failed to update from logger`,
        error
      );
    }
  }

  /**
   * Handles new critical log events.
   *
   * @private
   * @param {CriticalLogEntry} logEntry - New log entry
   */
  #handleNewCriticalLog(logEntry) {
    if (!this.#config.enableVisualNotifications || this.#isDismissed) {
      return;
    }

    if (this.#config.soundEnabled) {
      this.#playNotificationSound(logEntry.level);
    }

    // Dispatch notification event
    // Fix the count property: 'warn' -> 'warnings', 'error' -> 'errors'
    const countKey = logEntry.level === 'warn' ? 'warnings' : 'errors';
    this.validatedEventDispatcher.dispatch('core:critical_notification_shown', {
      level: logEntry.level === 'warn' ? 'warning' : logEntry.level,
      count: this.#logCounts[countKey] || 0,
    });
  }

  /**
   * Updates the visual display of badges and panel.
   *
   * @private
   */
  #updateDisplay() {
    if (!this.#container) return;

    this.#updateBadges(this.#logCounts);

    if (this.#isExpanded) {
      this.#updateLogPanel(this.#recentLogs);
    }

    // Show/hide container with animation if there are critical logs
    const hasLogs = this.#logCounts.warnings > 0 || this.#logCounts.errors > 0;

    if (hasLogs && this.#container.hidden) {
      // Show with animation
      this.#container.hidden = false;
      requestAnimationFrame(() => {
        this.#container.style.opacity = '1';
        this.#container.style.transform = 'scale(1)';
      });
    } else if (!hasLogs && !this.#container.hidden) {
      // Hide with animation
      this.#container.style.opacity = '0';
      this.#container.style.transform = 'scale(0.9)';

      setTimeout(() => {
        this.#container.hidden = true;
      }, 300); // Match animation duration
    }
  }

  /**
   * Updates badge counts and visibility.
   *
   * @private
   * @param {LogCounts} counts - Current log counts
   */
  #updateBadges(counts) {
    const warningBadge =
      this.#badgeContainer.querySelector('.lne-warning-badge');
    const errorBadge = this.#badgeContainer.querySelector('.lne-error-badge');

    // Update warning badge
    if (counts.warnings > 0) {
      warningBadge.textContent = counts.warnings > 99 ? '99+' : counts.warnings;
      warningBadge.hidden = false;
    } else {
      warningBadge.hidden = true;
    }

    // Update error badge
    if (counts.errors > 0) {
      errorBadge.textContent = counts.errors > 99 ? '99+' : counts.errors;
      errorBadge.hidden = false;
    } else {
      errorBadge.hidden = true;
    }
  }

  /**
   * Updates the log panel with recent entries.
   *
   * @private
   * @param {CriticalLogEntry[]} logs - Recent log entries
   */
  #updateLogPanel(logs) {
    const logList = this.#panel.querySelector('.lne-log-list');
    logList.innerHTML = '';

    // Add logs in reverse order (newest first)
    [...logs].reverse().forEach((log) => {
      const entry = this.#createLogEntry(log);
      logList.appendChild(entry);
    });
  }

  /**
   * Creates a DOM element for a log entry.
   *
   * @private
   * @param {CriticalLogEntry} log - Log entry data
   * @returns {HTMLElement} Log entry element
   */
  #createLogEntry(log) {
    const entry = this.documentContext.create('div');
    entry.className = `lne-log-entry lne-log-${log.level}`;

    // Add slide-in animation
    entry.style.animation = 'slideIn 0.3s ease';
    entry.style.opacity = '0';

    // Define animation keyframes inline
    if (!this.documentContext.query('#lne-log-animations')) {
      const style = this.documentContext.create('style');
      style.id = 'lne-log-animations';
      style.textContent = `
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `;
      this.documentContext.query('head').appendChild(style);
    }

    const time = this.documentContext.create('span');
    time.className = 'lne-log-time';
    time.textContent = this.#formatTimestamp(log.timestamp);

    const level = this.documentContext.create('span');
    level.className = 'lne-log-level';
    level.textContent = log.level.toUpperCase();

    const message = this.documentContext.create('span');
    message.className = 'lne-log-message';
    message.textContent = this.#formatLogMessage(log);

    entry.appendChild(time);
    entry.appendChild(level);
    entry.appendChild(message);

    // Trigger animation
    requestAnimationFrame(() => {
      entry.style.opacity = '1';
    });

    return entry;
  }

  /**
   * Formats a log message with truncation and category prefix.
   *
   * @private
   * @param {CriticalLogEntry} log - Log entry
   * @returns {string} Formatted message
   */
  #formatLogMessage(log) {
    const maxLength = 200;
    let message = this.#sanitizeMessage(log.message);

    // Add category prefix if present and not 'general'
    if (log.category && log.category !== 'general') {
      message = `[${log.category}] ${message}`;
    }

    // Truncate long messages
    if (message.length > maxLength) {
      message = message.substring(0, maxLength - 3) + '...';
    }

    return message;
  }

  /**
   * Formats timestamp with millisecond precision.
   *
   * @private
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted time string
   */
  #formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }

  /**
   * Sanitizes message text to prevent XSS.
   *
   * @private
   * @param {string} message - Raw message text
   * @returns {string} Sanitized message
   */
  #sanitizeMessage(message) {
    const div = this.documentContext.create('div');
    div.textContent = String(message);
    return div.innerHTML;
  }

  /**
   * Handles toggle between expanded and collapsed states.
   *
   * @private
   */
  #handleToggle() {
    if (this.#isExpanded) {
      this.#handleCollapse();
    } else {
      this.#handleExpand();
    }
  }

  /**
   * Handles expanding the log panel.
   *
   * @private
   */
  #handleExpand() {
    this.#isExpanded = true;
    this.#updateLogPanel(this.#recentLogs);
    this.#panel.hidden = false;

    // Animate panel expansion
    requestAnimationFrame(() => {
      this.#panel.style.opacity = '1';
      this.#panel.style.transform = 'scaleY(1)';
    });

    this.logger.debug(`${this._logPrefix} Panel expanded`);

    this.validatedEventDispatcher.dispatch('core:critical_log_panel_expanded', {
      logCount: this.#recentLogs.length,
    });
  }

  /**
   * Handles collapsing the log panel.
   *
   * @private
   */
  #handleCollapse() {
    this.#isExpanded = false;

    // Animate panel collapse
    this.#panel.style.opacity = '0';
    this.#panel.style.transform = 'scaleY(0)';

    // Hide after animation completes
    if (this.#animationTimer) {
      clearTimeout(this.#animationTimer);
    }

    this.#animationTimer = setTimeout(() => {
      this.#panel.hidden = true;
      this.#animationTimer = null;
    }, 200); // Match animation duration

    this.logger.debug(`${this._logPrefix} Panel collapsed`);

    this.validatedEventDispatcher.dispatch(
      'core:critical_log_panel_collapsed',
      {}
    );
  }

  /**
   * Handles clearing all logs and resetting counts.
   *
   * @private
   */
  #handleClear() {
    // Clear internal critical buffer
    this.#clearCriticalBuffer();

    // Reset local state
    this.#logCounts = { warnings: 0, errors: 0 };
    this.#recentLogs = [];
    this.#updateDisplay();

    this.logger.debug(`${this._logPrefix} Logs cleared`);

    this.validatedEventDispatcher.dispatch('core:critical_logs_cleared', {});
  }

  /**
   * Loads position preference from storage.
   *
   * @private
   * @returns {string} Position preference
   */
  #loadPosition() {
    try {
      const customPosition = localStorage.getItem(
        'lne-critical-notifier-position-custom'
      );
      if (customPosition === 'true') {
        const saved = localStorage.getItem('lne-critical-notifier-position');
        if (saved && this.#isValidPosition(saved)) {
          return saved;
        }
      }
    } catch {
      // Fallback to config
    }

    return this.#config.notificationPosition;
  }

  /**
   * Saves position preference to storage.
   *
   * @private
   * @param {string} position - New position
   */
  #savePosition(position) {
    try {
      localStorage.setItem('lne-critical-notifier-position', position);
    } catch (e) {
      this.logger.warn(
        `${this._logPrefix} Failed to save position preference`,
        e
      );
    }
  }

  /**
   * Saves position preference with custom flag.
   *
   * @private
   * @param {string} position - New position
   */
  #savePositionPreference(position) {
    try {
      localStorage.setItem('lne-critical-notifier-position', position);
      localStorage.setItem('lne-critical-notifier-position-custom', 'true');
      this.logger.debug(`${this._logPrefix} Position saved: ${position}`);
    } catch (e) {
      this.logger.warn(
        `${this._logPrefix} Failed to save position preference`,
        e
      );
    }
  }

  /**
   * Validates if a position string is valid.
   *
   * @private
   * @param {string} position - Position to validate
   * @returns {boolean} True if valid
   */
  #isValidPosition(position) {
    const validPositions = [
      'top-left',
      'top-right',
      'bottom-left',
      'bottom-right',
    ];
    return validPositions.includes(position);
  }

  /**
   * Enables drag functionality for the badge.
   *
   * @private
   */
  #enableDragging() {
    if (this.#dragHandler) return;

    const badgeContainer = this.#badgeContainer;
    if (!badgeContainer) return;

    this.#dragHandler = new DragHandler({
      element: badgeContainer,
      container: this.#container,
      callbacks: {
        onDragStart: () => {
          this.logger.debug(
            `${this._logPrefix} User started dragging notification`
          );
        },
        onDragEnd: (position) => {
          this.updatePosition(position);
          this.#savePositionPreference(position);
        },
      },
      logger: this.logger,
    });

    this.#dragHandler.enable();
  }

  /**
   * Sets up auto-dismiss functionality.
   *
   * @private
   */
  #setupAutoDismiss() {
    let dismissTimer;

    const resetTimer = () => {
      if (dismissTimer) clearTimeout(dismissTimer);

      dismissTimer = setTimeout(() => {
        this.#handleDismiss();
      }, this.#config.autoDismissAfter);
    };

    // Subscribe to critical log events to reset timer
    this._subscribe('CRITICAL_LOG_ADDED', resetTimer);
  }

  /**
   * Handles dismissing notifications temporarily.
   *
   * @private
   */
  #handleDismiss() {
    this.#isDismissed = true;

    // Animate dismissal
    this.#container.style.opacity = '0';
    this.#container.style.transform = 'scale(0.9)';

    setTimeout(() => {
      this.#container.hidden = true;
    }, 300); // Match animation duration

    this.logger.debug(`${this._logPrefix} Notifications dismissed`);

    // Reset dismissed state after delay
    setTimeout(() => {
      this.#isDismissed = false;
    }, 30000); // 30 seconds

    this.validatedEventDispatcher.dispatch(
      'core:critical_notifications_dismissed',
      {}
    );
  }

  /**
   * Plays notification sound (placeholder for future implementation).
   *
   * @private
   * @param {string} type - Log level type
   */
  #playNotificationSound(type) {
    // Future enhancement - not implemented in initial version
    // Could use Web Audio API or simple audio element
    this.logger.debug(
      `${this._logPrefix} Sound notification for ${type} (not implemented)`
    );
  }

  // Public API methods

  /**
   * Get current notification counts.
   *
   * @returns {LogCounts} Current warning and error counts
   */
  getCounts() {
    return { ...this.#logCounts };
  }

  /**
   * Check if notifier is currently showing.
   *
   * @returns {boolean} True if visible and not dismissed
   */
  isVisible() {
    return (
      !this.#isDismissed &&
      (this.#logCounts.warnings > 0 || this.#logCounts.errors > 0)
    );
  }

  /**
   * Update notification position.
   *
   * @param {string} newPosition - New position setting
   */
  updatePosition(newPosition) {
    this.#position = newPosition;
    this.#savePosition(newPosition);

    if (this.#container) {
      this.#container.setAttribute('data-position', newPosition);
    }

    this.logger.debug(`${this._logPrefix} Position updated to: ${newPosition}`);
  }

  /**
   * Override dispose to clean up timers and call parent cleanup.
   */
  /**
   * Reset position to default configuration.
   */
  resetPosition() {
    try {
      localStorage.removeItem('lne-critical-notifier-position');
      localStorage.removeItem('lne-critical-notifier-position-custom');
    } catch {
      // Ignore storage errors
    }

    this.#position = this.#config.notificationPosition;
    this.updatePosition(this.#position);

    this.logger.debug(
      `${this._logPrefix} Position reset to default: ${this.#position}`
    );
  }

  dispose() {
    // Clean up drag handler
    if (this.#dragHandler) {
      this.#dragHandler.destroy();
      this.#dragHandler = null;
    }

    // Clean up update timer
    if (this.#updateTimer) {
      clearInterval(this.#updateTimer);
      this.#updateTimer = null;
    }

    // Clean up animation timer
    if (this.#animationTimer) {
      clearTimeout(this.#animationTimer);
      this.#animationTimer = null;
    }

    // Clean up keyboard manager
    if (this.#keyboardManager) {
      this.#keyboardManager.destroy();
      this.#keyboardManager = null;
    }

    // Clean up log filter
    if (this.#logFilter) {
      this.#logFilter = null;
    }

    // Clean up exporter
    if (this.#exporter) {
      this.#exporter = null;
    }

    this.logger.debug(`${this._logPrefix} Disposing with cleanup`);

    // Call parent dispose for automatic VED and DOM cleanup
    super.dispose();
  }

  /**
   * Intercepts critical logs from the logger to build internal buffer.
   *
   * @private
   */
  #interceptCriticalLogs() {
    // Store original methods
    const originalWarn = this.#logger.warn.bind(this.#logger);
    const originalError = this.#logger.error.bind(this.#logger);

    // Override warn method to capture warnings
    this.#logger.warn = (message, ...args) => {
      // Prevent infinite recursion by checking if we're already processing a critical log
      if (!this.#processingCriticalLog) {
        this.#addToCriticalBuffer({
          level: 'warn',
          message,
          args,
          timestamp: Date.now(),
          stack: new Error().stack,
        });
      }
      // Call original method
      originalWarn(message, ...args);
    };

    // Override error method to capture errors
    this.#logger.error = (message, ...args) => {
      // Prevent infinite recursion by checking if we're already processing a critical log
      if (!this.#processingCriticalLog) {
        this.#addToCriticalBuffer({
          level: 'error',
          message,
          args,
          timestamp: Date.now(),
          stack: new Error().stack,
        });
      }
      // Call original method
      originalError(message, ...args);
    };
  }

  /**
   * Adds a log entry to the critical buffer.
   *
   * @private
   * @param {CriticalLogEntry} entry - Log entry to add
   */
  #addToCriticalBuffer(entry) {
    // Set flag to prevent recursion during event dispatching
    this.#processingCriticalLog = true;

    try {
      // Add to buffer with size limit
      this.#criticalBuffer.push(entry);

      // Trim buffer if it exceeds max size
      if (this.#criticalBuffer.length > this.#maxBufferSize) {
        this.#criticalBuffer.shift(); // Remove oldest entry
      }

      // Trigger new log handler
      this.#handleNewCriticalLog(entry);
    } finally {
      // Always clear the flag, even if an error occurs
      this.#processingCriticalLog = false;
    }
  }

  /**
   * Gets critical logs from the internal buffer.
   *
   * @private
   * @param {object} options - Options for retrieving logs
   * @param {number} [options.limit] - Maximum number of logs to return
   * @returns {Array<CriticalLogEntry>} Array of critical log entries
   */
  #getCriticalLogs(options = {}) {
    const limit = options.limit || this.#maxRecentLogs;

    // Return the most recent logs up to the limit
    const startIndex = Math.max(0, this.#criticalBuffer.length - limit);
    return this.#criticalBuffer.slice(startIndex);
  }

  /**
   * Clears the critical buffer.
   *
   * @private
   */
  #clearCriticalBuffer() {
    this.#criticalBuffer = [];
  }
}

export default CriticalLogNotifier;
