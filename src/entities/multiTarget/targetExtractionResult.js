/**
 * @file Result class for target extraction operations
 */

import { assertPresent } from '../../utils/dependencyUtils.js';
import TargetManager from './targetManager.js';

/** @typedef {import('../../types/multiTargetTypes.js').TargetsObject} TargetsObject */
/** @typedef {import('../../types/multiTargetTypes.js').EntityId} EntityId */
/** @typedef {import('../../types/multiTargetTypes.js').TargetExtractionResult} TargetExtractionResult */

/**
 * Result of target extraction operations with metadata and validation
 */
export class TargetExtractionResult {
  #targetManager;
  #hasMultipleTargets;
  #extractionMetadata;
  #validationResult;

  /**
   * Creates a new TargetExtractionResult
   *
   * @param {object} options - Configuration options
   * @param {TargetManager} options.targetManager - Target manager instance
   * @param {object} [options.extractionMetadata] - Metadata about extraction process
   * @param {object} [options.validationResult] - Validation result
   */
  constructor({ targetManager, extractionMetadata = {}, validationResult }) {
    assertPresent(targetManager, 'TargetManager is required', Error);

    if (!(targetManager instanceof TargetManager)) {
      throw new Error('targetManager must be a TargetManager instance');
    }

    this.#targetManager = targetManager;
    this.#hasMultipleTargets = targetManager.isMultiTarget();
    this.#extractionMetadata = { ...extractionMetadata };
    this.#validationResult = validationResult || targetManager.validate();
  }

  /**
   * Gets the target manager
   *
   * @returns {TargetManager} Target manager instance
   */
  getTargetManager() {
    return this.#targetManager;
  }

  /**
   * Gets all targets as an object
   *
   * @returns {TargetsObject} Targets object
   */
  getTargets() {
    return this.#targetManager.getTargetsObject();
  }

  /**
   * Gets the primary target
   *
   * @returns {EntityId|null} Primary target entity ID
   */
  getPrimaryTarget() {
    return this.#targetManager.getPrimaryTarget();
  }

  /**
   * Checks if multiple targets exist
   *
   * @returns {boolean} True if multiple targets exist
   */
  hasMultipleTargets() {
    return this.#hasMultipleTargets;
  }

  /**
   * Gets the number of targets
   *
   * @returns {number} Target count
   */
  getTargetCount() {
    return this.#targetManager.getTargetCount();
  }

  /**
   * Gets a specific target by name
   *
   * @param {string} name - Target name
   * @returns {EntityId|null} Entity ID or null if not found
   */
  getTarget(name) {
    return this.#targetManager.getTarget(name);
  }

  /**
   * Gets all target names
   *
   * @returns {string[]} Array of target names
   */
  getTargetNames() {
    return this.#targetManager.getTargetNames();
  }

  /**
   * Gets all entity IDs
   *
   * @returns {EntityId[]} Array of entity IDs
   */
  getEntityIds() {
    return this.#targetManager.getEntityIds();
  }

  /**
   * Gets extraction metadata
   *
   * @returns {object} Extraction metadata
   */
  getExtractionMetadata() {
    return { ...this.#extractionMetadata };
  }

  /**
   * Gets validation result
   *
   * @returns {object} Validation result
   */
  getValidationResult() {
    return { ...this.#validationResult };
  }

  /**
   * Checks if extraction was successful
   *
   * @returns {boolean} True if extraction was successful
   */
  isValid() {
    return this.#validationResult.isValid;
  }

  /**
   * Gets validation errors
   *
   * @returns {string[]} Array of error messages
   */
  getErrors() {
    return [...(this.#validationResult.errors || [])];
  }

  /**
   * Gets validation warnings
   *
   * @returns {string[]} Array of warning messages
   */
  getWarnings() {
    return [...(this.#validationResult.warnings || [])];
  }

  /**
   * Adds extraction metadata
   *
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  addMetadata(key, value) {
    this.#extractionMetadata[key] = value;
  }

  /**
   * Gets specific metadata value
   *
   * @param {string} key - Metadata key
   * @returns {*} Metadata value
   */
  getMetadata(key) {
    return this.#extractionMetadata[key];
  }

  /**
   * Creates legacy-compatible result for backward compatibility
   *
   * @returns {object} Legacy-compatible result
   */
  toLegacyFormat() {
    const primaryTarget = this.getPrimaryTarget();

    return {
      hasMultipleTargets: this.hasMultipleTargets(),
      targets: this.getTargets(),
      primaryTarget,
      // Legacy field for backward compatibility
      targetId: primaryTarget,
    };
  }

  /**
   * Converts to JSON representation
   *
   * @returns {object} JSON representation
   */
  toJSON() {
    return {
      targets: this.getTargets(),
      primaryTarget: this.getPrimaryTarget(),
      hasMultipleTargets: this.hasMultipleTargets(),
      targetCount: this.getTargetCount(),
      extractionMetadata: this.getExtractionMetadata(),
      validationResult: this.getValidationResult(),
      timestamp: Date.now(),
    };
  }

  /**
   * Creates a summary for logging and debugging
   *
   * @returns {object} Summary object
   */
  createSummary() {
    return {
      targetCount: this.getTargetCount(),
      hasMultipleTargets: this.hasMultipleTargets(),
      primaryTarget: this.getPrimaryTarget(),
      targetNames: this.getTargetNames(),
      isValid: this.isValid(),
      errorCount: this.getErrors().length,
      warningCount: this.getWarnings().length,
      extractionSource: this.getMetadata('source') || 'unknown',
    };
  }

  /**
   * Creates TargetExtractionResult from legacy data
   *
   * @param {object} legacyData - Legacy target data
   * @param {object} logger - Logger instance
   * @returns {TargetExtractionResult} New instance
   */
  static fromLegacyData(legacyData, logger) {
    const targetManager = new TargetManager({ logger });

    if (legacyData.targetId) {
      // Convert single target to targets object
      targetManager.addTarget('primary', legacyData.targetId);
    }

    if (legacyData.targets && typeof legacyData.targets === 'object') {
      targetManager.setTargets(legacyData.targets);
    }

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata: {
        source: 'legacy_conversion',
        originalData: legacyData,
      },
    });
  }

  /**
   * Creates TargetExtractionResult from resolved parameters
   *
   * @param {object} resolvedParameters - Resolved parameters from action processing
   * @param {object} logger - Logger instance
   * @returns {TargetExtractionResult} New instance
   */
  static fromResolvedParameters(resolvedParameters, logger) {
    const targetManager = new TargetManager({ logger });
    const metadata = {
      source: 'resolved_parameters',
      isMultiTarget: false,
      extractionTime: Date.now(),
    };

    // Handle multi-target data from formatting stage
    if (resolvedParameters.isMultiTarget && resolvedParameters.targetIds) {
      metadata.isMultiTarget = true;
      metadata.originalTargetIds = resolvedParameters.targetIds;

      // Convert targetIds object to flat targets
      const targets = {};
      for (const [key, targetList] of Object.entries(
        resolvedParameters.targetIds
      )) {
        if (Array.isArray(targetList) && targetList.length > 0) {
          targets[key] = targetList[0]; // Take first target from each category
        } else if (typeof targetList === 'string') {
          targets[key] = targetList;
        }
      }

      targetManager.setTargets(targets);
    }
    // Handle legacy single target
    else if (resolvedParameters.targetId) {
      targetManager.addTarget('primary', resolvedParameters.targetId);
    }

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata: metadata,
    });
  }

  /**
   * Creates empty TargetExtractionResult for actions without targets
   *
   * @param {object} logger - Logger instance
   * @returns {TargetExtractionResult} New instance
   */
  static createEmpty(logger) {
    const targetManager = new TargetManager({ logger });

    return new TargetExtractionResult({
      targetManager,
      extractionMetadata: {
        source: 'empty',
        reason: 'no_targets_required',
      },
    });
  }
}

export default TargetExtractionResult;