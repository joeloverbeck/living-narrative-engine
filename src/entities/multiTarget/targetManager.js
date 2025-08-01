/**
 * @file Target management for multi-target actions
 */

import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import {
  isValidTargetName,
  isValidEntityId,
  determinePrimaryTarget,
} from '../../utils/multiTargetValidationUtils.js';

/** @typedef {import('../../types/multiTargetTypes.js').TargetsObject} TargetsObject */
/** @typedef {import('../../types/multiTargetTypes.js').EntityId} EntityId */
/** @typedef {import('../../types/multiTargetTypes.js').TargetName} TargetName */

/**
 * Manages target collections for multi-target actions
 */
export class TargetManager {
  #targets;
  #primaryTarget;
  #logger;

  /**
   * Creates a new TargetManager
   *
   * @param {object} options - Configuration options
   * @param {TargetsObject} [options.targets] - Initial targets
   * @param {EntityId} [options.primaryTarget] - Explicit primary target
   * @param {object} options.logger - Logger instance
   */
  constructor({ targets = {}, primaryTarget, logger }) {
    this.#logger = ensureValidLogger(logger);
    this.#targets = new Map();
    this.#primaryTarget = null;

    // Initialize with provided targets
    if (targets && Object.keys(targets).length > 0) {
      this.setTargets(targets);
    }

    // Set explicit primary target if provided
    if (primaryTarget) {
      this.setPrimaryTarget(primaryTarget);
    }
  }

  /**
   * Sets multiple targets at once
   *
   * @param {TargetsObject} targets - Targets to set
   * @throws {Error} If targets are invalid
   */
  setTargets(targets) {
    assertPresent(targets, 'Targets object is required', Error, this.#logger);

    if (typeof targets !== 'object' || Array.isArray(targets)) {
      throw new Error('Targets must be an object');
    }

    // Clear existing targets
    this.#targets.clear();
    this.#primaryTarget = null;

    // Add each target
    for (const [name, entityId] of Object.entries(targets)) {
      this.addTarget(name, entityId);
    }

    // Determine primary target if not explicitly set
    if (!this.#primaryTarget && this.#targets.size > 0) {
      this.#primaryTarget = determinePrimaryTarget(this.getTargetsObject());
    }

    this.#logger.debug('Targets set', {
      targetCount: this.#targets.size,
      primaryTarget: this.#primaryTarget,
      targets: this.getTargetsObject(),
    });
  }

  /**
   * Adds a single target
   *
   * @param {TargetName} name - Target name
   * @param {EntityId} entityId - Entity ID
   * @throws {Error} If target data is invalid
   */
  addTarget(name, entityId) {
    assertNonBlankString(name, 'name', 'TargetManager.addTarget', this.#logger);
    assertNonBlankString(
      entityId,
      'entityId',
      'TargetManager.addTarget',
      this.#logger
    );

    if (!isValidTargetName(name)) {
      this.#logger.warn('Target name does not follow conventions', { name });
    }

    if (!isValidEntityId(entityId)) {
      this.#logger.warn('Entity ID does not follow conventions', { entityId });
    }

    this.#targets.set(name, entityId);

    // Set as primary if it's the first target or has a primary-like name
    if (this.#targets.size === 1 || name === 'primary' || name === 'target') {
      this.#primaryTarget = entityId;
    }

    this.#logger.debug('Target added', {
      name,
      entityId,
      isPrimary: this.#primaryTarget === entityId,
    });
  }


  /**
   * Gets a target by name
   *
   * @param {TargetName} name - Target name
   * @returns {EntityId|null} Entity ID or null if not found
   */
  getTarget(name) {
    assertNonBlankString(name, 'name', 'TargetManager.getTarget', this.#logger);
    return this.#targets.get(name) || null;
  }

  /**
   * Gets the primary target
   *
   * @returns {EntityId|null} Primary target entity ID
   */
  getPrimaryTarget() {
    return this.#primaryTarget;
  }

  /**
   * Sets the primary target explicitly
   *
   * @param {EntityId} entityId - Entity ID to set as primary
   * @throws {Error} If entity ID is not in targets
   */
  setPrimaryTarget(entityId) {
    assertNonBlankString(
      entityId,
      'entityId',
      'TargetManager.setPrimaryTarget',
      this.#logger
    );

    // Check if entity ID exists in targets
    const targetNames = Array.from(this.#targets.entries())
      .filter(([, id]) => id === entityId)
      .map(([name]) => name);

    if (targetNames.length === 0) {
      throw new Error(`Entity ID "${entityId}" not found in targets`);
    }

    this.#primaryTarget = entityId;
    this.#logger.debug('Primary target set', { entityId, targetNames });
  }

  /**
   * Gets all target names
   *
   * @returns {TargetName[]} Array of target names
   */
  getTargetNames() {
    return Array.from(this.#targets.keys());
  }

  /**
   * Gets all entity IDs
   *
   * @returns {EntityId[]} Array of entity IDs
   */
  getEntityIds() {
    return Array.from(this.#targets.values());
  }

  /**
   * Gets targets as a plain object
   *
   * @returns {TargetsObject} Targets object
   */
  getTargetsObject() {
    return Object.fromEntries(this.#targets);
  }

  /**
   * Checks if target exists
   *
   * @param {TargetName} name - Target name
   * @returns {boolean} True if target exists
   */
  hasTarget(name) {
    return this.#targets.has(name);
  }

  /**
   * Checks if entity ID exists as a target
   *
   * @param {EntityId} entityId - Entity ID to check
   * @returns {boolean} True if entity ID exists
   */
  hasEntityId(entityId) {
    return Array.from(this.#targets.values()).includes(entityId);
  }

  /**
   * Gets the number of targets
   *
   * @returns {number} Target count
   */
  getTargetCount() {
    return this.#targets.size;
  }

  /**
   * Checks if this is a multi-target collection
   *
   * @returns {boolean} True if multiple targets exist
   */
  isMultiTarget() {
    return this.#targets.size > 1;
  }

  /**
   * Validates all targets
   *
   * @returns {object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (this.#targets.size === 0) {
      errors.push('No targets defined');
      return { isValid: false, errors, warnings };
    }

    // Validate each target
    for (const [name, entityId] of this.#targets.entries()) {
      if (!isValidTargetName(name)) {
        warnings.push(`Target name "${name}" does not follow conventions`);
      }

      if (!isValidEntityId(entityId)) {
        warnings.push(`Entity ID "${entityId}" does not follow conventions`);
      }
    }

    // Check for duplicate entity IDs
    const entityIds = this.getEntityIds();
    const uniqueIds = new Set(entityIds);
    if (uniqueIds.size !== entityIds.length) {
      warnings.push('Duplicate entity IDs found in targets');
    }

    // Validate primary target
    if (this.#primaryTarget && !this.hasEntityId(this.#primaryTarget)) {
      errors.push(
        `Primary target "${this.#primaryTarget}" not found in targets`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Converts to JSON representation
   *
   * @returns {object} JSON representation
   */
  toJSON() {
    return {
      targets: this.getTargetsObject(),
      primaryTarget: this.#primaryTarget,
      targetCount: this.#targets.size,
      isMultiTarget: this.isMultiTarget(),
    };
  }

  /**
   * Get entity ID by placeholder name
   * Enhanced API for ActionFormattingStage integration
   *
   * @param {TargetName} placeholderName - Placeholder name (e.g., "primary", "secondary")
   * @returns {EntityId|null} - Entity ID or null if not found
   */
  getEntityIdByPlaceholder(placeholderName) {
    assertNonBlankString(
      placeholderName,
      'placeholderName',
      'TargetManager.getEntityIdByPlaceholder',
      this.#logger
    );
    return this.#targets.get(placeholderName) || null;
  }

}

export default TargetManager;
