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
 * Maps typeName to {@link ContentTypeCounts}.
 *
 * @typedef {Record<string, ContentTypeCounts>} ModResultsSummary
 */

/**
 * Structure to hold aggregated results across all mods.
 * Maps typeName to {@link ContentTypeCounts}.
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
    this.#totalCounts = totalCounts;
  }

  /**
   * Aggregates a loader result into the per-mod and total summaries.
   * Returns a new totals object to maintain immutability.
   *
   * @param {LoadItemsResult|null|undefined} result - Loader result to aggregate.
   * @param {string} typeName - Content type name.
   * @returns {TotalResultsSummary} A new totals object with updated counts.
   */
  aggregate(result, typeName) {
    const res =
      result && typeof result.count === 'number'
        ? {
            count: result.count || 0,
            overrides: result.overrides || 0,
            errors: result.errors || 0,
          }
        : { count: 0, overrides: 0, errors: 0 };

    this.modResults[typeName] = res;

    // Clone the current totals to maintain immutability
    const newTotals = { ...this.#totalCounts };
    
    if (!newTotals[typeName]) {
      newTotals[typeName] = { count: 0, overrides: 0, errors: 0 };
    }
    newTotals[typeName].count += res.count;
    newTotals[typeName].overrides += res.overrides;
    newTotals[typeName].errors += res.errors;
    
    // Update the internal totals reference
    this.#totalCounts = newTotals;
    
    return newTotals;
  }

  /**
   * Records a failure occurrence for a specific loader.
   * Returns a new totals object to maintain immutability.
   *
   * @param {string} typeName - Content type name for which a failure occurred.
   * @returns {TotalResultsSummary} A new totals object with updated error counts.
   */
  recordFailure(typeName) {
    if (!this.modResults[typeName]) {
      this.modResults[typeName] = { count: 0, overrides: 0, errors: 0 };
    }
    this.modResults[typeName].errors += 1;

    // Clone the current totals to maintain immutability
    const newTotals = { ...this.#totalCounts };
    
    if (!newTotals[typeName]) {
      newTotals[typeName] = { count: 0, overrides: 0, errors: 0 };
    }
    newTotals[typeName].errors += 1;
    
    // Update the internal totals reference
    this.#totalCounts = newTotals;
    
    return newTotals;
  }
}

export default LoadResultAggregator;
