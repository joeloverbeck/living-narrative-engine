// src/loaders/LoadResultAggregator.js

/**
 * @file Provides LoadResultAggregator, a utility for collecting loader results
 * per mod and across all mods.
 */

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
 * results for a single mod and update overall totals. This class follows an
 * immutable pattern for updating totals; its methods return a new totals object
 * rather than modifying the original.
 * @class
 */
export class LoadResultAggregator {
  /** @type {TotalResultsSummary} */
  #totalCounts;
  /** @type {ModResultsSummary} */
  modResults = {};

  /**
   * @param {TotalResultsSummary} totalCounts - Object storing totals across all mods.
   * This object will be treated as immutable.
   */
  constructor(totalCounts) {
    this.#totalCounts = totalCounts;
  }

  /**
   * Aggregates a loader result into the per-mod summary and returns a new
   * object representing the updated total summaries.
   *
   * @param {LoadItemsResult|null|undefined} result - Loader result to aggregate.
   * @param {string} registryKey - Content type name.
   * @returns {TotalResultsSummary} A new object with the aggregated totals.
   */
  aggregate(result, registryKey) {
    const newTotals = JSON.parse(JSON.stringify(this.#totalCounts));

    const res =
      result && typeof result.count === 'number'
        ? {
          count: result.count || 0,
          overrides: result.overrides || 0,
          errors: result.errors || 0,
        }
        : { count: 0, overrides: 0, errors: 0 };

    this.modResults[registryKey] = res;

    // Only update totals if there are actual results to add.
    if (res.count > 0 || res.overrides > 0 || res.errors > 0) {
      if (!newTotals[registryKey]) {
        newTotals[registryKey] = { count: 0, overrides: 0, errors: 0 };
      }
      newTotals[registryKey].count += res.count;
      newTotals[registryKey].overrides += res.overrides;
      newTotals[registryKey].errors += res.errors;
    }

    return newTotals;
  }

  /**
   * Records a failure occurrence for a specific loader and returns a new
   * object representing the updated total summaries.
   *
   * @param {string} registryKey - Content type name for which a failure occurred.
   * @returns {TotalResultsSummary} A new object with the updated error total.
   */
  recordFailure(registryKey) {
    const newTotals = JSON.parse(JSON.stringify(this.#totalCounts));

    if (!this.modResults[registryKey]) {
      this.modResults[registryKey] = { count: 0, overrides: 0, errors: 0 };
    }
    this.modResults[registryKey].errors += 1;

    if (!newTotals[registryKey]) {
      newTotals[registryKey] = { count: 0, overrides: 0, errors: 0 };
    }
    newTotals[registryKey].errors += 1;

    return newTotals;
  }
}

export default LoadResultAggregator;