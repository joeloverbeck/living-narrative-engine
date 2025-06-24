// src/loaders/LoadResultAggregator.js

/**
 * @file Provides LoadResultAggregator, a utility for collecting loader results
 * per mod and across all mods.
 */

import { cloneTotals } from '../utils/cloneTotals.js';

/**
 * Structure to hold aggregated results per content type.
 *
 * @typedef {object} ContentTypeCounts
 * @property {number} count - Number of items successfully loaded.
 * @property {number} overrides - Number of items that replaced existing items.
 * @property {number} errors - Number of errors encountered.
 */

/**
 * Structure to hold aggregated results for a single mod.
 * Maps registryKey to {@link ContentTypeCounts}.
 *
 * @typedef {Record<string, ContentTypeCounts>} ModResultsSummary
 */

/**
 * Structure to hold aggregated results across all mods.
 * Maps registryKey to {@link ContentTypeCounts}.
 *
 * @typedef {Record<string, ContentTypeCounts>} TotalResultsSummary
 */

/**
 * @description Utility class used during content loading to aggregate loader
 * results for a single mod and update overall totals.
 * @class
 */
export class LoadResultAggregator {
  /** @type {TotalResultsSummary} */
  #totalCounts;
  /** @type {ModResultsSummary} */
  modResults = {};

  /**
   * @param {TotalResultsSummary} totalCounts - Object storing totals across all mods.
   */
  constructor(totalCounts) {
    // Clone the totals object to ensure immutability
    this.#totalCounts = cloneTotals(totalCounts);
  }

  /**
   * Gets a copy of the current total counts.
   *
   * @returns {TotalResultsSummary} A copy of the current total counts.
   */
  getTotalCounts() {
    return cloneTotals(this.#totalCounts);
  }

  /**
   * Aggregates a loader result into the per-mod and total summaries.
   *
   * @param {LoadItemsResult|null|undefined} result - Loader result to aggregate.
   * @param {string} registryKey - Content type registry key.
   * @returns {void}
   */
  aggregate(result, registryKey) {
    const res =
      result && typeof result.count === 'number'
        ? {
            count: result.count || 0,
            overrides: result.overrides || 0,
            errors: result.errors || 0,
          }
        : { count: 0, overrides: 0, errors: 0 };

    this.modResults[registryKey] = res;

    if (!this.#totalCounts[registryKey]) {
      this.#totalCounts[registryKey] = { count: 0, overrides: 0, errors: 0 };
    }
    this.#totalCounts[registryKey].count += res.count;
    this.#totalCounts[registryKey].overrides += res.overrides;
    this.#totalCounts[registryKey].errors += res.errors;
  }

  /**
   * Records a failure occurrence for a specific loader.
   *
   * @param {string} registryKey - Content type registry key for which a failure occurred.
   * @returns {void}
   */
  recordFailure(registryKey) {
    if (!this.modResults[registryKey]) {
      this.modResults[registryKey] = { count: 0, overrides: 0, errors: 0 };
    }
    this.modResults[registryKey].errors += 1;

    if (!this.#totalCounts[registryKey]) {
      this.#totalCounts[registryKey] = { count: 0, overrides: 0, errors: 0 };
    }
    this.#totalCounts[registryKey].errors += 1;
  }
}

export default LoadResultAggregator;
