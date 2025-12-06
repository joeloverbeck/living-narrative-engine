// src/scopeDsl/core/contextMerger.js

/**
 * @file Context Merger for Scope-DSL
 * @description Handles safe merging of context objects with validation
 */

import ContextValidator from './contextValidator.js';

/**
 * Handles safe merging of context objects preserving critical properties
 *
 * Extracted from engine.js to improve maintainability and testability.
 * Provides centralized context merging logic with proper validation.
 */
class ContextMerger {
  /**
   * Creates a new ContextMerger instance
   *
   * @param {string[]} criticalProperties - Array of property names that must be preserved
   * @param {ContextValidator} validator - Optional validator instance
   */
  constructor(
    criticalProperties = [
      'actorEntity',
      'runtimeCtx',
      'dispatcher',
      'cycleDetector',
      'depthGuard',
    ],
    validator = null
  ) {
    this.criticalProperties = criticalProperties;
    this.validator = validator || new ContextValidator(criticalProperties);
  }

  /**
   * Safely merges context objects preserving critical properties
   *
   * @param {object} baseCtx - Base context with critical properties
   * @param {object} overlayCtx - Context to overlay on base
   * @returns {object} Merged context with validation
   * @throws {Error} If critical properties are missing after merge
   */
  merge(baseCtx, overlayCtx) {
    // Validate inputs before merging
    this.validator.validateForMerging(baseCtx, overlayCtx);

    if (!overlayCtx) {
      return { ...baseCtx };
    }

    // Create merged context with explicit property handling
    const mergedCtx = {
      // Start with all base properties
      ...baseCtx,

      // Overlay non-critical properties from overlayCtx
      ...this._mergeNonCriticalProperties(overlayCtx),

      // Critical properties - ensure they're never undefined
      ...this._mergeCriticalProperties(baseCtx, overlayCtx),

      // Handle depth specially
      depth: this._mergeDepth(baseCtx, overlayCtx),

      // Preserve trace if available - use nullish coalescing to handle null/undefined
      // If overlay has explicit non-null trace, use it; otherwise use base trace
      trace:
        overlayCtx.trace !== null && overlayCtx.trace !== undefined
          ? overlayCtx.trace
          : baseCtx.trace,
    };

    // Validate final merged context
    this.validator.validate(mergedCtx);

    return mergedCtx;
  }

  /**
   * Merges non-critical properties from overlay context
   *
   * @param {object} overlayCtx - Context to overlay
   * @returns {object} Non-critical properties from overlay
   * @private
   */
  _mergeNonCriticalProperties(overlayCtx) {
    return Object.keys(overlayCtx).reduce((acc, key) => {
      // Skip critical properties that we'll handle explicitly
      if (this.criticalProperties.includes(key)) {
        return acc;
      }
      // Skip 'trace' - it has special handling to preserve from base when null/undefined
      if (key === 'trace') {
        return acc;
      }
      acc[key] = overlayCtx[key];
      return acc;
    }, {});
  }

  /**
   * Merges critical properties with proper fallback handling
   *
   * @param {object} baseCtx - Base context
   * @param {object} overlayCtx - Overlay context
   * @returns {object} Merged critical properties
   * @private
   */
  _mergeCriticalProperties(baseCtx, overlayCtx) {
    const critical = {};

    this.criticalProperties.forEach((prop) => {
      critical[prop] = overlayCtx[prop] || baseCtx[prop];
    });

    return critical;
  }

  /**
   * Handles depth merging with special logic
   *
   * @param {object} baseCtx - Base context
   * @param {object} overlayCtx - Overlay context
   * @returns {number} Merged depth value
   * @private
   */
  _mergeDepth(baseCtx, overlayCtx) {
    return Math.max(
      overlayCtx.depth !== undefined ? overlayCtx.depth : 0,
      baseCtx.depth !== undefined ? baseCtx.depth + 1 : 1
    );
  }

  /**
   * Gets the list of critical properties this merger handles
   *
   * @returns {string[]} Array of critical property names
   */
  getCriticalProperties() {
    return [...this.criticalProperties];
  }

  /**
   * Gets the validator instance used by this merger
   *
   * @returns {ContextValidator} The validator instance
   */
  getValidator() {
    return this.validator;
  }
}

export default ContextMerger;
