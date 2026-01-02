/**
 * @file DamageHistoryTracker.js
 * @description Maintains a session log of damage applications with table display and statistics.
 * @see DamageExecutionService.js - Source of damage results
 * @see DamageSimulatorUI.js - Parent UI controller
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

/**
 * @typedef {object} DamageResult
 * @property {boolean} success - Whether damage was applied successfully
 * @property {string} [targetPartId] - Which part was hit
 * @property {string} [targetPartName] - Human-readable part name
 * @property {number} [damageDealt] - Amount of damage dealt
 * @property {string} [damageType] - Type of damage dealt
 * @property {string} [severity] - Severity classification
 * @property {string|null} [error] - Error message if failed
 */

/**
 * @typedef {object} HistoryEntry
 * @property {number} id - Unique entry ID
 * @property {Date} timestamp - When damage was applied
 * @property {string} targetPartId - Part entity ID
 * @property {string} targetPartName - Human-readable part name
 * @property {number} damageDealt - Amount of damage
 * @property {string} damageType - Type of damage
 * @property {string} severity - Severity classification
 */

/**
 * @typedef {object} HistoryStatistics
 * @property {number} totalDamage - Sum of all damage dealt
 * @property {number} hitCount - Number of successful hits
 */

/**
 * Event types for history tracker.
 *
 * @readonly
 */
const EVENTS = Object.freeze({
  EXECUTION_COMPLETE: 'damage-simulator:execution-complete',
  ENTITY_LOADING: 'damage-simulator:entity-loading',
});

/**
 * Default maximum number of history entries.
 *
 * @readonly
 */
const MAX_ENTRIES_DEFAULT = 50;

/**
 * Component for tracking and displaying damage history.
 */
class DamageHistoryTracker {
  /** @type {HTMLElement} */
  #containerElement;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {number} */
  #maxEntries;

  /** @type {HistoryEntry[]} */
  #entries = [];

  /** @type {number} */
  #nextId = 1;

  /** @type {Array<() => void>} */
  #unsubscribers = [];

  /**
   * Expose constants for testing and external use
   */
  static EVENTS = EVENTS;
  static MAX_ENTRIES_DEFAULT = MAX_ENTRIES_DEFAULT;

  /**
   * Creates a new DamageHistoryTracker instance.
   *
   * @param {object} dependencies - The dependencies object.
   * @param {HTMLElement} dependencies.containerElement - DOM element to render into.
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher.
   * @param {ILogger} dependencies.logger - Logger instance.
   * @param {number} [dependencies.maxEntries] - Maximum entries to keep (default: 50).
   */
  constructor({ containerElement, eventBus, logger, maxEntries = MAX_ENTRIES_DEFAULT }) {
    validateDependency(containerElement, 'HTMLElement', console, {
      requiredMethods: ['appendChild', 'querySelector'],
    });
    validateDependency(eventBus, 'IEventBus', console, {
      requiredMethods: ['dispatch', 'subscribe'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#containerElement = containerElement;
    this.#eventBus = eventBus;
    this.#logger = logger;
    this.#maxEntries = maxEntries;

    this.#subscribeToEvents();
    this.#logger.debug('[DamageHistoryTracker] Initialized');
  }

  /**
   * Subscribe to relevant events.
   *
   * @private
   */
  #subscribeToEvents() {
    // Subscribe to execution complete events
    const unsubExecutionComplete = this.#eventBus.subscribe(
      EVENTS.EXECUTION_COMPLETE,
      (event) => {
        const { results } = event.payload || {};
        if (Array.isArray(results)) {
          for (const result of results) {
            this.record(result);
          }
          this.render();
        }
      }
    );
    this.#unsubscribers.push(unsubExecutionComplete);

    // Subscribe to entity loading to clear history
    const unsubEntityLoading = this.#eventBus.subscribe(
      EVENTS.ENTITY_LOADING,
      () => {
        this.clearHistory();
      }
    );
    this.#unsubscribers.push(unsubEntityLoading);
  }

  /**
   * Record a damage result.
   *
   * @param {DamageResult} result - Damage result to record.
   */
  record(result) {
    if (!result || !result.success) {
      this.#logger.debug('[DamageHistoryTracker] Skipping unsuccessful result');
      return;
    }

    /** @type {HistoryEntry} */
    const entry = {
      id: this.#nextId++,
      timestamp: new Date(),
      targetPartId: result.targetPartId || 'unknown',
      targetPartName: result.targetPartName || result.targetPartId || 'Unknown',
      damageDealt: result.damageDealt || 0,
      damageType: result.damageType || 'unknown',
      severity: result.severity || 'unknown',
    };

    this.#entries.push(entry);

    // Trim to max entries (keep newest)
    if (this.#entries.length > this.#maxEntries) {
      this.#entries = this.#entries.slice(-this.#maxEntries);
    }

    this.#logger.debug(`[DamageHistoryTracker] Recorded entry #${entry.id}`);
  }

  /**
   * Render the history display.
   */
  render() {
    this.#containerElement.innerHTML = this.#generateHTML();
    this.#attachEventListeners();
  }

  /**
   * Generate HTML for the history display.
   *
   * @private
   * @returns {string} HTML content.
   */
  #generateHTML() {
    const stats = this.getStatistics();
    const entriesHTML = this.#entries.length === 0
      ? '<tr><td colspan="5" class="ds-no-history">No damage applied yet.</td></tr>'
      : this.#entries.map((entry) => this.#renderEntry(entry)).join('');

    return `
      <div class="ds-history-header">
        <button id="clear-history-btn" class="ds-btn ds-btn-small" ${this.#entries.length === 0 ? 'disabled' : ''}>Clear</button>
      </div>
      <div class="ds-history-table-container">
        <table class="ds-history-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Time</th>
              <th>Part</th>
              <th>Damage</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody id="history-entries">
            ${entriesHTML}
          </tbody>
        </table>
      </div>
      <div class="ds-history-summary">
        <span>Total: <strong id="total-damage">${stats.totalDamage}</strong> damage</span>
        <span>Hits: <strong id="hit-count">${stats.hitCount}</strong></span>
      </div>
    `;
  }

  /**
   * Render a single history entry row.
   *
   * @private
   * @param {HistoryEntry} entry - Entry to render.
   * @returns {string} HTML for the row.
   */
  #renderEntry(entry) {
    // Note: entry.severity is always set to at least 'unknown' via record() defaults
    const severityClass = `ds-severity-${entry.severity}`;

    return `
      <tr class="${severityClass}">
        <td>${entry.id}</td>
        <td>${this.#formatTime(entry.timestamp)}</td>
        <td>${this.#escapeHtml(entry.targetPartName)}</td>
        <td>${entry.damageDealt} ${this.#escapeHtml(entry.damageType)}</td>
        <td>${this.#formatSeverity(entry.severity)}</td>
      </tr>
    `;
  }

  /**
   * Format severity as a badge.
   *
   * @private
   * @param {string} severity - Severity level.
   * @returns {string} HTML for severity badge.
   */
  #formatSeverity(severity) {
    if (!severity || severity === 'unknown') return '—';
    return `<span class="ds-severity-badge ds-severity-${severity}">${severity}</span>`;
  }

  /**
   * Format timestamp for display.
   *
   * @private
   * @param {Date} date - Timestamp.
   * @returns {string} Formatted time string.
   */
  #formatTime(date) {
    return date.toLocaleTimeString('en-US', { hour12: false });
  }

  /**
   * Escape HTML to prevent XSS.
   *
   * @private
   * @param {string} str - String to escape.
   * @returns {string} Escaped string.
   */
  #escapeHtml(str) {
    // Note: str is always a string via record() defaults (targetPartName, damageType)
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Attach event listeners to rendered elements.
   *
   * @private
   */
  #attachEventListeners() {
    const clearBtn = this.#containerElement.querySelector('#clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.clearHistory();
        this.render();
      });
    }
  }

  /**
   * Clear all history entries.
   */
  clearHistory() {
    this.#entries = [];
    this.#nextId = 1;
    this.#logger.debug('[DamageHistoryTracker] History cleared');
  }

  /**
   * Get summary statistics.
   *
   * @returns {HistoryStatistics} Statistics object.
   */
  getStatistics() {
    return {
      totalDamage: this.#entries.reduce((sum, entry) => sum + (entry.damageDealt || 0), 0),
      hitCount: this.#entries.length,
    };
  }

  /**
   * Get all entries.
   *
   * @returns {HistoryEntry[]} Copy of all entries.
   */
  getEntries() {
    return [...this.#entries];
  }

  /**
   * Clean up resources.
   */
  destroy() {
    for (const unsubscribe of this.#unsubscribers) {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    }
    this.#unsubscribers = [];
    this.#entries = [];
    this.#logger.debug('[DamageHistoryTracker] Destroyed');
  }
}

export default DamageHistoryTracker;
