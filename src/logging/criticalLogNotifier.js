/**
 * @file Visual notification system for critical logs
 * @see hybridLogger.js, rendererBase.js
 */

import { RendererBase } from '../domUI/rendererBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('./types.js').CriticalLogEntry} CriticalLogEntry */
/** @typedef {import('./types.js').NotifierConfig} NotifierConfig */
/** @typedef {import('./types.js').LogCounts} LogCounts */
/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../interfaces/IDocumentContext.js').IDocumentContext} IDocumentContext */
/** @typedef {import('../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

/**
 * Visual notification system for critical logs (warnings and errors).
 * Extends RendererBase for automatic dependency management and cleanup.
 * Integrates with HybridLogger's critical buffer for log data.
 */
class CriticalLogNotifier extends RendererBase {
  #config;
  #hybridLogger;
  #logCounts = { warnings: 0, errors: 0 };
  #recentLogs = [];
  #maxRecentLogs = 20;
  #isExpanded = false;
  #isDismissed = false;
  #position;
  #container = null;
  #badgeContainer = null;
  #panel = null;
  #updateTimer = null;
  
  /**
   * Creates a new CriticalLogNotifier instance.
   *
   * @param {object} dependencies - Dependencies object
   * @param {ILogger} dependencies.logger - Logger instance
   * @param {IDocumentContext} dependencies.documentContext - Document context abstraction
   * @param {IValidatedEventDispatcher} dependencies.validatedEventDispatcher - Event dispatcher
   * @param {*} dependencies.hybridLogger - HybridLogger instance with critical buffer
   * @param {NotifierConfig} [dependencies.config] - Configuration object
   */
  constructor({ logger, documentContext, validatedEventDispatcher, hybridLogger, config = {} }) {
    super({ logger, documentContext, validatedEventDispatcher });
    
    validateDependency(hybridLogger, 'HybridLogger', logger, {
      requiredMethods: ['getCriticalLogs', 'getCriticalBufferStats', 'clearCriticalBuffer']
    });
    
    this.#hybridLogger = hybridLogger;
    this.#config = this.#validateConfig(config);
    this.#maxRecentLogs = this.#config.maxRecentLogs || 20;
    this.#position = this.#loadPosition();
    
    this.#initialize();
    
    this.logger.debug(`${this._logPrefix} Initialized with position: ${this.#position}`);
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
      alwaysShowInConsole: true
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
    this.#attachEventListeners();
    this.#startUpdateTimer();
    
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
    
    // Header
    const header = this.documentContext.create('div');
    header.className = 'lne-log-header';
    
    const title = this.documentContext.create('span');
    title.textContent = 'Recent Critical Logs';
    
    const clearBtn = this.documentContext.create('button');
    clearBtn.className = 'lne-clear-btn';
    clearBtn.textContent = 'Clear';
    clearBtn.setAttribute('aria-label', 'Clear all logs');
    
    const closeBtn = this.documentContext.create('button');
    closeBtn.className = 'lne-close-btn';
    closeBtn.innerHTML = '&times;';
    closeBtn.setAttribute('aria-label', 'Close panel');
    
    header.appendChild(title);
    header.appendChild(clearBtn);
    header.appendChild(closeBtn);
    
    // Log list
    const logList = this.documentContext.create('div');
    logList.className = 'lne-log-list';
    
    panel.appendChild(header);
    panel.appendChild(logList);
    
    return panel;
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
    this._addDomListener(this.documentContext.query('body'), 'click', (event) => {
      if (!this.#container.contains(event.target) && this.#isExpanded) {
        this.#handleCollapse();
      }
    });
  }
  
  /**
   * Starts the update timer to refresh log data periodically.
   *
   * @private
   */
  #startUpdateTimer() {
    this.#updateTimer = setInterval(() => {
      this.#updateFromHybridLogger();
    }, 1000); // Update every second
  }
  
  /**
   * Updates log data from HybridLogger's critical buffer.
   *
   * @private
   */
  #updateFromHybridLogger() {
    if (this.#isDismissed) {
      return;
    }
    
    try {
      const logs = this.#hybridLogger.getCriticalLogs({ limit: this.#maxRecentLogs });
      
      // Update counts from logs
      this.#logCounts.warnings = logs.filter(log => log.level === 'warn').length;
      this.#logCounts.errors = logs.filter(log => log.level === 'error').length;
      
      // Update recent logs with display time
      this.#recentLogs = logs.map(log => ({
        ...log,
        displayTime: new Date(log.timestamp).toLocaleTimeString()
      }));
      
      this.#updateDisplay();
    } catch (error) {
      this.logger.error(`${this._logPrefix} Failed to update from HybridLogger`, error);
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
    this.validatedEventDispatcher.dispatch({
      type: 'CRITICAL_NOTIFICATION_SHOWN',
      payload: { level: logEntry.level, count: this.#logCounts[logEntry.level + 's'] }
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
    
    // Show container if there are critical logs
    const hasLogs = this.#logCounts.warnings > 0 || this.#logCounts.errors > 0;
    this.#container.hidden = !hasLogs;
  }
  
  /**
   * Updates badge counts and visibility.
   *
   * @private
   * @param {LogCounts} counts - Current log counts
   */
  #updateBadges(counts) {
    const warningBadge = this.#badgeContainer.querySelector('.lne-warning-badge');
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
    [...logs].reverse().forEach(log => {
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
    
    const time = this.documentContext.create('span');
    time.className = 'lne-log-time';
    time.textContent = log.displayTime;
    
    const level = this.documentContext.create('span');
    level.className = 'lne-log-level';
    level.textContent = log.level.toUpperCase();
    
    const message = this.documentContext.create('span');
    message.className = 'lne-log-message';
    message.textContent = this.#sanitizeMessage(log.message);
    
    entry.appendChild(time);
    entry.appendChild(level);
    entry.appendChild(message);
    
    return entry;
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
    
    this.logger.debug(`${this._logPrefix} Panel expanded`);
    
    this.validatedEventDispatcher.dispatch({
      type: 'CRITICAL_LOG_PANEL_EXPANDED',
      payload: { logCount: this.#recentLogs.length }
    });
  }
  
  /**
   * Handles collapsing the log panel.
   *
   * @private
   */
  #handleCollapse() {
    this.#isExpanded = false;
    this.#panel.hidden = true;
    
    this.logger.debug(`${this._logPrefix} Panel collapsed`);
    
    this.validatedEventDispatcher.dispatch({
      type: 'CRITICAL_LOG_PANEL_COLLAPSED',
      payload: {}
    });
  }
  
  /**
   * Handles clearing all logs and resetting counts.
   *
   * @private
   */
  #handleClear() {
    // Clear HybridLogger's critical buffer
    this.#hybridLogger.clearCriticalBuffer();
    
    // Reset local state
    this.#logCounts = { warnings: 0, errors: 0 };
    this.#recentLogs = [];
    this.#updateDisplay();
    
    this.logger.debug(`${this._logPrefix} Logs cleared`);
    
    this.validatedEventDispatcher.dispatch({
      type: 'CRITICAL_LOGS_CLEARED',
      payload: {}
    });
  }
  
  /**
   * Loads position preference from storage.
   *
   * @private
   * @returns {string} Position preference
   */
  #loadPosition() {
    try {
      const saved = localStorage.getItem('lne-critical-notifier-position');
      return saved || this.#config.notificationPosition;
    } catch {
      return this.#config.notificationPosition;
    }
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
      this.logger.warn(`${this._logPrefix} Failed to save position preference`, e);
    }
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
    this.#container.hidden = true;
    
    this.logger.debug(`${this._logPrefix} Notifications dismissed`);
    
    // Reset dismissed state after delay
    setTimeout(() => {
      this.#isDismissed = false;
    }, 30000); // 30 seconds
    
    this.validatedEventDispatcher.dispatch({
      type: 'CRITICAL_NOTIFICATIONS_DISMISSED',
      payload: {}
    });
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
    this.logger.debug(`${this._logPrefix} Sound notification for ${type} (not implemented)`);
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
    return !this.#isDismissed && (this.#logCounts.warnings > 0 || this.#logCounts.errors > 0);
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
  dispose() {
    if (this.#updateTimer) {
      clearInterval(this.#updateTimer);
      this.#updateTimer = null;
    }
    
    this.logger.debug(`${this._logPrefix} Disposing with cleanup`);
    
    // Call parent dispose for automatic VED and DOM cleanup
    super.dispose();
  }
}

export default CriticalLogNotifier;