/**
 * @file Log filtering functionality for critical notifications
 * @see criticalLogNotifier.js
 */

import { validateDependency } from '../utils/dependencyUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';

class LogFilter {
  #logs = [];
  #filteredLogs = [];
  #filterCriteria = {
    level: 'all', // 'all', 'warn', 'error'
    searchText: '',
    category: 'all',
    timeRange: 'all', // 'all', 'last5min', 'last15min', 'last30min', 'lasthour'
  };
  #callbacks;
  #logger;
  #categories = new Set(['all']);

  constructor({ callbacks, logger }) {
    ensureValidLogger(logger, 'LogFilter constructor');
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug'],
    });

    this.#callbacks = callbacks || {};
    this.#logger = logger;
  }

  /**
   * Set the logs to filter
   *
   * @param {Array} logs - Array of log entries
   */
  setLogs(logs) {
    this.#logs = logs;
    this.#updateCategories();
    this.#applyFilters();
  }

  /**
   * Add a new log entry
   *
   * @param {object} log - Log entry to add
   */
  addLog(log) {
    this.#logs.push(log);
    if (log.category) {
      this.#categories.add(log.category);
    }
    this.#applyFilters();
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.#logs = [];
    this.#filteredLogs = [];
    this.#categories = new Set(['all']);
    this.#notifyChange();
  }

  /**
   * Set filter criteria
   *
   * @param {object} criteria - Filter criteria object
   */
  setFilter(criteria) {
    const changed = Object.keys(criteria).some(
      (key) => this.#filterCriteria[key] !== criteria[key]
    );

    if (changed) {
      Object.assign(this.#filterCriteria, criteria);
      this.#applyFilters();
      this.#logger.debug('Filter criteria updated', criteria);
    }
  }

  /**
   * Get current filter criteria
   *
   * @returns {object} Current filter criteria
   */
  getFilter() {
    return { ...this.#filterCriteria };
  }

  /**
   * Get filtered logs
   *
   * @returns {Array} Array of filtered log entries
   */
  getFilteredLogs() {
    return [...this.#filteredLogs];
  }

  /**
   * Get available categories
   *
   * @returns {Array} Array of available category names
   */
  getCategories() {
    return Array.from(this.#categories).sort();
  }

  /**
   * Get filter statistics
   *
   * @returns {object} Statistics about filtered logs
   */
  getStats() {
    const stats = {
      total: this.#logs.length,
      filtered: this.#filteredLogs.length,
      warnings: 0,
      errors: 0,
      byCategory: {},
    };

    this.#filteredLogs.forEach((log) => {
      if (log.level === 'warn') stats.warnings++;
      if (log.level === 'error') stats.errors++;

      const category = log.category || 'general';
      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
    });

    return stats;
  }

  #applyFilters() {
    let filtered = [...this.#logs];

    // Filter by level
    if (this.#filterCriteria.level !== 'all') {
      filtered = filtered.filter(
        (log) => log.level === this.#filterCriteria.level
      );
    }

    // Filter by search text
    if (this.#filterCriteria.searchText) {
      const searchLower = this.#filterCriteria.searchText.toLowerCase();
      filtered = filtered.filter((log) => {
        const message = (log.message || '').toLowerCase();
        const category = (log.category || '').toLowerCase();
        return message.includes(searchLower) || category.includes(searchLower);
      });
    }

    // Filter by category
    if (this.#filterCriteria.category !== 'all') {
      filtered = filtered.filter(
        (log) => log.category === this.#filterCriteria.category
      );
    }

    // Filter by time range
    if (this.#filterCriteria.timeRange !== 'all') {
      const now = Date.now();
      const ranges = {
        last5min: 5 * 60 * 1000,
        last15min: 15 * 60 * 1000,
        last30min: 30 * 60 * 1000,
        lasthour: 60 * 60 * 1000,
      };

      const maxAge = ranges[this.#filterCriteria.timeRange];
      if (maxAge) {
        filtered = filtered.filter((log) => {
          const logTime = new Date(log.timestamp).getTime();
          return now - logTime <= maxAge;
        });
      }
    }

    this.#filteredLogs = filtered;
    this.#notifyChange();
  }

  #updateCategories() {
    this.#categories = new Set(['all']);
    this.#logs.forEach((log) => {
      if (log.category) {
        this.#categories.add(log.category);
      }
    });
  }

  #notifyChange() {
    if (this.#callbacks.onFilterChange) {
      this.#callbacks.onFilterChange(this.#filteredLogs, this.getStats());
    }
  }

  /**
   * Export filtered logs as JSON
   *
   * @returns {string} JSON string of filtered logs
   */
  exportAsJSON() {
    return JSON.stringify(this.#filteredLogs, null, 2);
  }

  /**
   * Export filtered logs as CSV
   *
   * @returns {string} CSV string of filtered logs
   */
  exportAsCSV() {
    const headers = ['Timestamp', 'Level', 'Category', 'Message'];
    const rows = this.#filteredLogs.map((log) => [
      log.timestamp,
      log.level,
      log.category || '',
      `"${(log.message || '').replace(/"/g, '""')}"`,
    ]);

    return [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }
}

export default LogFilter;
