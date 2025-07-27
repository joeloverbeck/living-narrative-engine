# Ticket 06: Create Multi-Target Data Structures

## Overview

Create comprehensive data structures and interfaces to support multi-target action processing. This includes creating classes for target management, data extraction results, and standardized interfaces that will be used throughout the multi-target system implementation.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)
- Ticket 05: Update Common Schema References (must be completed)

## Blocks

- Ticket 07: Implement Multi-Target Data Extraction
- Ticket 11: Create Multi-Target Rule Examples

## Priority: Medium

## Estimated Time: 6-8 hours

## Background

The multi-target action system requires robust data structures to handle target extraction, validation, and processing. These structures must be efficient, type-safe, and provide clear interfaces for the command processor and rules system to consume multi-target data.

## Implementation Details

### 1. Create Target Management Classes

**File**: `src/entities/multiTarget/targetManager.js`

```javascript
/**
 * @file Target management for multi-target actions
 */

import { assertPresent, assertNonBlankString } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { 
  isValidTargetName, 
  isValidEntityId, 
  determinePrimaryTarget 
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
   * @param {Object} options - Configuration options
   * @param {TargetsObject} [options.targets={}] - Initial targets
   * @param {EntityId} [options.primaryTarget] - Explicit primary target
   * @param {Object} options.logger - Logger instance
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
   * @param {TargetsObject} targets - Targets to set
   * @throws {Error} If targets are invalid
   */
  setTargets(targets) {
    assertPresent(targets, 'Targets object is required');
    
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
      targets: this.getTargetsObject()
    });
  }

  /**
   * Adds a single target
   * @param {TargetName} name - Target name
   * @param {EntityId} entityId - Entity ID
   * @throws {Error} If target data is invalid
   */
  addTarget(name, entityId) {
    assertNonBlankString(name, 'Target name');
    assertNonBlankString(entityId, 'Entity ID');

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

    this.#logger.debug('Target added', { name, entityId, isPrimary: this.#primaryTarget === entityId });
  }

  /**
   * Removes a target
   * @param {TargetName} name - Target name to remove
   * @returns {boolean} True if target was removed
   */
  removeTarget(name) {
    assertNonBlankString(name, 'Target name');

    const entityId = this.#targets.get(name);
    if (!entityId) {
      return false;
    }

    this.#targets.delete(name);

    // Update primary target if it was removed
    if (this.#primaryTarget === entityId) {
      this.#primaryTarget = this.#targets.size > 0 
        ? determinePrimaryTarget(this.getTargetsObject()) 
        : null;
    }

    this.#logger.debug('Target removed', { name, entityId });
    return true;
  }

  /**
   * Gets a target by name
   * @param {TargetName} name - Target name
   * @returns {EntityId|null} Entity ID or null if not found
   */
  getTarget(name) {
    assertNonBlankString(name, 'Target name');
    return this.#targets.get(name) || null;
  }

  /**
   * Gets the primary target
   * @returns {EntityId|null} Primary target entity ID
   */
  getPrimaryTarget() {
    return this.#primaryTarget;
  }

  /**
   * Sets the primary target explicitly
   * @param {EntityId} entityId - Entity ID to set as primary
   * @throws {Error} If entity ID is not in targets
   */
  setPrimaryTarget(entityId) {
    assertNonBlankString(entityId, 'Entity ID');

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
   * @returns {TargetName[]} Array of target names
   */
  getTargetNames() {
    return Array.from(this.#targets.keys());
  }

  /**
   * Gets all entity IDs
   * @returns {EntityId[]} Array of entity IDs
   */
  getEntityIds() {
    return Array.from(this.#targets.values());
  }

  /**
   * Gets targets as a plain object
   * @returns {TargetsObject} Targets object
   */
  getTargetsObject() {
    return Object.fromEntries(this.#targets);
  }

  /**
   * Checks if target exists
   * @param {TargetName} name - Target name
   * @returns {boolean} True if target exists
   */
  hasTarget(name) {
    return this.#targets.has(name);
  }

  /**
   * Checks if entity ID exists as a target
   * @param {EntityId} entityId - Entity ID to check
   * @returns {boolean} True if entity ID exists
   */
  hasEntityId(entityId) {
    return Array.from(this.#targets.values()).includes(entityId);
  }

  /**
   * Gets the number of targets
   * @returns {number} Target count
   */
  getTargetCount() {
    return this.#targets.size;
  }

  /**
   * Checks if this is a multi-target collection
   * @returns {boolean} True if multiple targets exist
   */
  isMultiTarget() {
    return this.#targets.size > 1;
  }

  /**
   * Validates all targets
   * @returns {Object} Validation result
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
      errors.push(`Primary target "${this.#primaryTarget}" not found in targets`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Creates a copy of this TargetManager
   * @returns {TargetManager} New TargetManager instance
   */
  clone() {
    return new TargetManager({
      targets: this.getTargetsObject(),
      primaryTarget: this.#primaryTarget,
      logger: this.#logger
    });
  }

  /**
   * Merges targets from another TargetManager
   * @param {TargetManager} other - Other TargetManager to merge
   * @param {Object} options - Merge options
   * @param {boolean} [options.overwrite=false] - Whether to overwrite existing targets
   * @param {boolean} [options.updatePrimary=false] - Whether to update primary target
   */
  merge(other, { overwrite = false, updatePrimary = false } = {}) {
    if (!(other instanceof TargetManager)) {
      throw new Error('Can only merge with another TargetManager instance');
    }

    const otherTargets = other.getTargetsObject();
    
    for (const [name, entityId] of Object.entries(otherTargets)) {
      if (!this.hasTarget(name) || overwrite) {
        this.#targets.set(name, entityId);
      }
    }

    if (updatePrimary && other.getPrimaryTarget()) {
      this.#primaryTarget = other.getPrimaryTarget();
    }

    this.#logger.debug('Targets merged', {
      mergedCount: Object.keys(otherTargets).length,
      totalCount: this.#targets.size
    });
  }

  /**
   * Converts to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      targets: this.getTargetsObject(),
      primaryTarget: this.#primaryTarget,
      targetCount: this.#targets.size,
      isMultiTarget: this.isMultiTarget()
    };
  }

  /**
   * Creates TargetManager from JSON representation
   * @param {Object} json - JSON representation
   * @param {Object} logger - Logger instance
   * @returns {TargetManager} New TargetManager instance
   */
  static fromJSON(json, logger) {
    return new TargetManager({
      targets: json.targets || {},
      primaryTarget: json.primaryTarget,
      logger
    });
  }
}

export default TargetManager;
```

### 2. Create Target Extraction Result Class

**File**: `src/entities/multiTarget/targetExtractionResult.js`

```javascript
/**
 * @file Result class for target extraction operations
 */

import { assertPresent } from '../../utils/validationUtils.js';
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
   * @param {Object} options - Configuration options
   * @param {TargetManager} options.targetManager - Target manager instance
   * @param {Object} [options.extractionMetadata={}] - Metadata about extraction process
   * @param {Object} [options.validationResult] - Validation result
   */
  constructor({ targetManager, extractionMetadata = {}, validationResult }) {
    assertPresent(targetManager, 'TargetManager is required');
    
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
   * @returns {TargetManager} Target manager instance
   */
  getTargetManager() {
    return this.#targetManager;
  }

  /**
   * Gets all targets as an object
   * @returns {TargetsObject} Targets object
   */
  getTargets() {
    return this.#targetManager.getTargetsObject();
  }

  /**
   * Gets the primary target
   * @returns {EntityId|null} Primary target entity ID
   */
  getPrimaryTarget() {
    return this.#targetManager.getPrimaryTarget();
  }

  /**
   * Checks if multiple targets exist
   * @returns {boolean} True if multiple targets exist
   */
  hasMultipleTargets() {
    return this.#hasMultipleTargets;
  }

  /**
   * Gets the number of targets
   * @returns {number} Target count
   */
  getTargetCount() {
    return this.#targetManager.getTargetCount();
  }

  /**
   * Gets a specific target by name
   * @param {string} name - Target name
   * @returns {EntityId|null} Entity ID or null if not found
   */
  getTarget(name) {
    return this.#targetManager.getTarget(name);
  }

  /**
   * Gets all target names
   * @returns {string[]} Array of target names
   */
  getTargetNames() {
    return this.#targetManager.getTargetNames();
  }

  /**
   * Gets all entity IDs
   * @returns {EntityId[]} Array of entity IDs
   */
  getEntityIds() {
    return this.#targetManager.getEntityIds();
  }

  /**
   * Gets extraction metadata
   * @returns {Object} Extraction metadata
   */
  getExtractionMetadata() {
    return { ...this.#extractionMetadata };
  }

  /**
   * Gets validation result
   * @returns {Object} Validation result
   */
  getValidationResult() {
    return { ...this.#validationResult };
  }

  /**
   * Checks if extraction was successful
   * @returns {boolean} True if extraction was successful
   */
  isValid() {
    return this.#validationResult.isValid;
  }

  /**
   * Gets validation errors
   * @returns {string[]} Array of error messages
   */
  getErrors() {
    return [...(this.#validationResult.errors || [])];
  }

  /**
   * Gets validation warnings
   * @returns {string[]} Array of warning messages
   */
  getWarnings() {
    return [...(this.#validationResult.warnings || [])];
  }

  /**
   * Adds extraction metadata
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   */
  addMetadata(key, value) {
    this.#extractionMetadata[key] = value;
  }

  /**
   * Gets specific metadata value
   * @param {string} key - Metadata key
   * @returns {*} Metadata value
   */
  getMetadata(key) {
    return this.#extractionMetadata[key];
  }

  /**
   * Creates legacy-compatible result for backward compatibility
   * @returns {Object} Legacy-compatible result
   */
  toLegacyFormat() {
    const primaryTarget = this.getPrimaryTarget();
    
    return {
      hasMultipleTargets: this.hasMultipleTargets(),
      targets: this.getTargets(),
      primaryTarget,
      // Legacy field for backward compatibility
      targetId: primaryTarget
    };
  }

  /**
   * Converts to JSON representation
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      targets: this.getTargets(),
      primaryTarget: this.getPrimaryTarget(),
      hasMultipleTargets: this.hasMultipleTargets(),
      targetCount: this.getTargetCount(),
      extractionMetadata: this.getExtractionMetadata(),
      validationResult: this.getValidationResult(),
      timestamp: Date.now()
    };
  }

  /**
   * Creates a summary for logging and debugging
   * @returns {Object} Summary object
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
      extractionSource: this.getMetadata('source') || 'unknown'
    };
  }

  /**
   * Creates TargetExtractionResult from legacy data
   * @param {Object} legacyData - Legacy target data
   * @param {Object} logger - Logger instance
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
        originalData: legacyData
      }
    });
  }

  /**
   * Creates TargetExtractionResult from resolved parameters
   * @param {Object} resolvedParameters - Resolved parameters from action processing
   * @param {Object} logger - Logger instance
   * @returns {TargetExtractionResult} New instance
   */
  static fromResolvedParameters(resolvedParameters, logger) {
    const targetManager = new TargetManager({ logger });
    const metadata = {
      source: 'resolved_parameters',
      isMultiTarget: false,
      extractionTime: Date.now()
    };

    // Handle multi-target data from formatting stage
    if (resolvedParameters.isMultiTarget && resolvedParameters.targetIds) {
      metadata.isMultiTarget = true;
      metadata.originalTargetIds = resolvedParameters.targetIds;

      // Convert targetIds object to flat targets
      const targets = {};
      for (const [key, targetList] of Object.entries(resolvedParameters.targetIds)) {
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
      extractionMetadata: metadata
    });
  }

  /**
   * Creates empty TargetExtractionResult for actions without targets
   * @param {Object} logger - Logger instance
   * @returns {TargetExtractionResult} New instance
   */
  static createEmpty(logger) {
    const targetManager = new TargetManager({ logger });
    
    return new TargetExtractionResult({
      targetManager,
      extractionMetadata: {
        source: 'empty',
        reason: 'no_targets_required'
      }
    });
  }
}

export default TargetExtractionResult;
```

### 3. Create Multi-Target Event Builder

**File**: `src/entities/multiTarget/multiTargetEventBuilder.js`

```javascript
/**
 * @file Builder for creating multi-target event payloads
 */

import { assertPresent, assertNonBlankString } from '../../utils/validationUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { validateAttemptActionPayload } from '../../utils/multiTargetValidationUtils.js';
import TargetExtractionResult from './targetExtractionResult.js';

/** @typedef {import('../../types/multiTargetTypes.js').AttemptActionPayload} AttemptActionPayload */
/** @typedef {import('../../types/multiTargetTypes.js').EntityId} EntityId */
/** @typedef {import('../../types/multiTargetTypes.js').NamespacedId} NamespacedId */

/**
 * Builder for creating standardized multi-target event payloads
 */
export class MultiTargetEventBuilder {
  #eventData;
  #logger;

  /**
   * Creates a new MultiTargetEventBuilder
   * @param {Object} options - Configuration options
   * @param {Object} options.logger - Logger instance
   */
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.reset();
  }

  /**
   * Resets the builder to initial state
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  reset() {
    this.#eventData = {
      eventName: 'core:attempt_action',
      timestamp: Date.now()
    };
    return this;
  }

  /**
   * Sets the actor ID
   * @param {EntityId} actorId - Actor entity ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setActor(actorId) {
    assertNonBlankString(actorId, 'Actor ID');
    this.#eventData.actorId = actorId;
    return this;
  }

  /**
   * Sets the action ID
   * @param {NamespacedId} actionId - Action definition ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setAction(actionId) {
    assertNonBlankString(actionId, 'Action ID');
    this.#eventData.actionId = actionId;
    return this;
  }

  /**
   * Sets the original input command
   * @param {string} originalInput - Original command string
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setOriginalInput(originalInput) {
    assertNonBlankString(originalInput, 'Original input');
    this.#eventData.originalInput = originalInput;
    return this;
  }

  /**
   * Sets targets from a TargetExtractionResult
   * @param {TargetExtractionResult} extractionResult - Target extraction result
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setTargetsFromExtraction(extractionResult) {
    assertPresent(extractionResult, 'Target extraction result is required');
    
    if (!(extractionResult instanceof TargetExtractionResult)) {
      throw new Error('extractionResult must be a TargetExtractionResult instance');
    }

    const targets = extractionResult.getTargets();
    const primaryTarget = extractionResult.getPrimaryTarget();

    // Set targets object if multiple targets exist
    if (extractionResult.hasMultipleTargets()) {
      this.#eventData.targets = targets;
    }

    // Always set targetId for backward compatibility
    this.#eventData.targetId = primaryTarget;

    this.#logger.debug('Targets set from extraction result', {
      hasMultipleTargets: extractionResult.hasMultipleTargets(),
      targetCount: extractionResult.getTargetCount(),
      primaryTarget
    });

    return this;
  }

  /**
   * Sets targets manually
   * @param {Object} targets - Targets object
   * @param {EntityId} [primaryTarget] - Primary target override
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setTargets(targets, primaryTarget) {
    assertPresent(targets, 'Targets object is required');

    if (typeof targets !== 'object' || Array.isArray(targets)) {
      throw new Error('Targets must be an object');
    }

    const targetKeys = Object.keys(targets);
    
    // Set targets object if multiple targets exist
    if (targetKeys.length > 1) {
      this.#eventData.targets = { ...targets };
    }

    // Determine primary target
    const primary = primaryTarget || 
                   targets.primary || 
                   targets.target || 
                   Object.values(targets)[0];

    this.#eventData.targetId = primary;

    this.#logger.debug('Targets set manually', {
      targetCount: targetKeys.length,
      hasMultipleTargets: targetKeys.length > 1,
      primaryTarget: primary
    });

    return this;
  }

  /**
   * Sets a legacy single target
   * @param {EntityId|null} targetId - Target entity ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setLegacyTarget(targetId) {
    if (targetId !== null) {
      assertNonBlankString(targetId, 'Target ID');
    }
    
    this.#eventData.targetId = targetId;
    
    // Remove targets object for pure legacy format
    delete this.#eventData.targets;

    this.#logger.debug('Legacy target set', { targetId });
    return this;
  }

  /**
   * Sets the event timestamp
   * @param {number} [timestamp=Date.now()] - Event timestamp
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setTimestamp(timestamp = Date.now()) {
    if (typeof timestamp !== 'number' || timestamp < 0) {
      throw new Error('Timestamp must be a non-negative number');
    }
    
    this.#eventData.timestamp = timestamp;
    return this;
  }

  /**
   * Builds and validates the event payload
   * @returns {Object} Built and validated event payload
   * @throws {Error} If the payload is invalid
   */
  build() {
    // Validate required fields
    this.#validateRequiredFields();

    // Create the payload
    const payload = { ...this.#eventData };

    // Validate the complete payload
    const validationResult = validateAttemptActionPayload(payload);
    
    if (!validationResult.isValid) {
      const errorMessage = `Invalid event payload: ${validationResult.errors.join(', ')}`;
      this.#logger.error('Event payload validation failed', {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
        payload
      });
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      this.#logger.warn('Event payload has warnings', {
        warnings: validationResult.warnings,
        payload
      });
    }

    this.#logger.debug('Event payload built successfully', {
      hasMultipleTargets: validationResult.details.hasMultipleTargets,
      targetCount: validationResult.details.targetCount,
      primaryTarget: validationResult.details.primaryTarget
    });

    return payload;
  }

  /**
   * Builds the payload without strict validation (for testing)
   * @returns {Object} Built event payload
   */
  buildUnsafe() {
    return { ...this.#eventData };
  }

  /**
   * Validates required fields
   * @throws {Error} If required fields are missing
   */
  #validateRequiredFields() {
    const requiredFields = ['actorId', 'actionId', 'originalInput'];
    const missingFields = requiredFields.filter(field => !this.#eventData[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Must have either targets or targetId
    if (!this.#eventData.targets && this.#eventData.targetId === undefined) {
      throw new Error('Event must have either targets object or targetId field');
    }
  }

  /**
   * Gets the current state of the builder (for debugging)
   * @returns {Object} Current builder state
   */
  getState() {
    return {
      eventData: { ...this.#eventData },
      hasRequiredFields: this.#hasRequiredFields(),
      hasTargets: this.#hasTargets()
    };
  }

  /**
   * Checks if required fields are present
   * @returns {boolean} True if all required fields are present
   */
  #hasRequiredFields() {
    const requiredFields = ['actorId', 'actionId', 'originalInput'];
    return requiredFields.every(field => this.#eventData[field]);
  }

  /**
   * Checks if targets are present
   * @returns {boolean} True if targets are present
   */
  #hasTargets() {
    return this.#eventData.targets || this.#eventData.targetId !== undefined;
  }

  /**
   * Creates a builder from an existing payload (for modification)
   * @param {AttemptActionPayload} payload - Existing payload
   * @param {Object} logger - Logger instance
   * @returns {MultiTargetEventBuilder} New builder instance
   */
  static fromPayload(payload, logger) {
    assertPresent(payload, 'Payload is required');
    
    const builder = new MultiTargetEventBuilder({ logger });
    
    // Copy all fields from payload
    builder.#eventData = { ...payload };
    
    return builder;
  }

  /**
   * Creates a builder from turn action data
   * @param {Object} actor - Actor entity
   * @param {Object} turnAction - Turn action data
   * @param {TargetExtractionResult} extractionResult - Target extraction result
   * @param {Object} logger - Logger instance
   * @returns {MultiTargetEventBuilder} New builder instance
   */
  static fromTurnAction(actor, turnAction, extractionResult, logger) {
    assertPresent(actor, 'Actor is required');
    assertPresent(turnAction, 'Turn action is required');
    assertPresent(extractionResult, 'Extraction result is required');

    const builder = new MultiTargetEventBuilder({ logger });
    
    return builder
      .setActor(actor.id)
      .setAction(turnAction.actionDefinitionId)
      .setOriginalInput(turnAction.commandString || turnAction.actionDefinitionId)
      .setTargetsFromExtraction(extractionResult);
  }
}

export default MultiTargetEventBuilder;
```

### 4. Create Tests for Data Structures

**File**: `tests/unit/entities/multiTarget/targetManager.test.js`

```javascript
/**
 * @file Tests for TargetManager class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { TestBedClass } from '../../../common/testbed.js';
import TargetManager from '../../../../src/entities/multiTarget/targetManager.js';

describe('TargetManager', () => {
  let testBed;
  let logger;

  beforeEach(() => {
    testBed = new TestBedClass();
    logger = testBed.createMockLogger();
  });

  describe('Construction and Basic Operations', () => {
    it('should create empty target manager', () => {
      const manager = new TargetManager({ logger });

      expect(manager.getTargetCount()).toBe(0);
      expect(manager.isMultiTarget()).toBe(false);
      expect(manager.getPrimaryTarget()).toBe(null);
    });

    it('should create target manager with initial targets', () => {
      const targets = {
        item: 'knife_123',
        target: 'goblin_456'
      };

      const manager = new TargetManager({ targets, logger });

      expect(manager.getTargetCount()).toBe(2);
      expect(manager.isMultiTarget()).toBe(true);
      expect(manager.getTarget('item')).toBe('knife_123');
      expect(manager.getTarget('target')).toBe('goblin_456');
    });

    it('should add targets individually', () => {
      const manager = new TargetManager({ logger });

      manager.addTarget('primary', 'entity_123');
      manager.addTarget('secondary', 'entity_456');

      expect(manager.getTargetCount()).toBe(2);
      expect(manager.getPrimaryTarget()).toBe('entity_123');
      expect(manager.getTarget('secondary')).toBe('entity_456');
    });

    it('should remove targets', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      const removed = manager.removeTarget('item');

      expect(removed).toBe(true);
      expect(manager.getTargetCount()).toBe(1);
      expect(manager.hasTarget('item')).toBe(false);
      expect(manager.hasTarget('target')).toBe(true);
    });
  });

  describe('Primary Target Management', () => {
    it('should determine primary target automatically', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      // Should prefer 'target' over 'item' based on patterns
      expect(manager.getPrimaryTarget()).toBe('goblin_456');
    });

    it('should use explicit primary target', () => {
      const manager = new TargetManager({ 
        targets: { primary: 'primary_123', secondary: 'secondary_456' },
        logger 
      });

      expect(manager.getPrimaryTarget()).toBe('primary_123');
    });

    it('should allow setting primary target explicitly', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      manager.setPrimaryTarget('knife_123');

      expect(manager.getPrimaryTarget()).toBe('knife_123');
    });

    it('should throw error when setting invalid primary target', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123' },
        logger 
      });

      expect(() => {
        manager.setPrimaryTarget('nonexistent_entity');
      }).toThrow('Entity ID "nonexistent_entity" not found in targets');
    });
  });

  describe('Validation', () => {
    it('should validate correct targets', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect empty targets', () => {
      const manager = new TargetManager({ logger });

      const result = manager.validate();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('No targets defined');
    });

    it('should warn about duplicate entity IDs', () => {
      const manager = new TargetManager({ logger });
      manager.addTarget('item', 'same_entity');
      manager.addTarget('target', 'same_entity');

      const result = manager.validate();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Duplicate entity IDs found in targets');
    });
  });

  describe('Utility Methods', () => {
    it('should check target existence', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      expect(manager.hasTarget('item')).toBe(true);
      expect(manager.hasTarget('nonexistent')).toBe(false);
      expect(manager.hasEntityId('knife_123')).toBe(true);
      expect(manager.hasEntityId('nonexistent')).toBe(false);
    });

    it('should get target names and entity IDs', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      expect(manager.getTargetNames()).toEqual(['item', 'target']);
      expect(manager.getEntityIds()).toEqual(['knife_123', 'goblin_456']);
    });

    it('should clone target manager', () => {
      const original = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        logger 
      });

      const clone = original.clone();

      expect(clone.getTargetsObject()).toEqual(original.getTargetsObject());
      expect(clone.getPrimaryTarget()).toBe(original.getPrimaryTarget());
      expect(clone).not.toBe(original); // Different instances
    });

    it('should merge with another target manager', () => {
      const manager1 = new TargetManager({ 
        targets: { item: 'knife_123' },
        logger 
      });

      const manager2 = new TargetManager({ 
        targets: { target: 'goblin_456', tool: 'sword_789' },
        logger 
      });

      manager1.merge(manager2);

      expect(manager1.getTargetCount()).toBe(3);
      expect(manager1.hasTarget('target')).toBe(true);
      expect(manager1.hasTarget('tool')).toBe(true);
    });
  });

  describe('JSON Serialization', () => {
    it('should convert to JSON', () => {
      const manager = new TargetManager({ 
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123',
        logger 
      });

      const json = manager.toJSON();

      expect(json).toEqual({
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123',
        targetCount: 2,
        isMultiTarget: true
      });
    });

    it('should create from JSON', () => {
      const json = {
        targets: { item: 'knife_123', target: 'goblin_456' },
        primaryTarget: 'knife_123'
      };

      const manager = TargetManager.fromJSON(json, logger);

      expect(manager.getTargetsObject()).toEqual(json.targets);
      expect(manager.getPrimaryTarget()).toBe(json.primaryTarget);
    });
  });
});
```

## Testing Requirements

### 1. Unit Test Coverage

- **TargetManager**: All methods and edge cases
- **TargetExtractionResult**: Construction and data access
- **MultiTargetEventBuilder**: Build process and validation
- **Error handling**: Invalid inputs and edge cases

### 2. Integration Testing

- Data structures work together seamlessly
- Serialization/deserialization maintains data integrity
- Performance requirements met

### 3. Performance Requirements

- Target operations < 1ms for typical use cases
- Memory usage < 10KB per target manager instance
- JSON serialization < 5ms for complex target structures

## Success Criteria

1. **Functionality**: All data structures work correctly and efficiently
2. **Type Safety**: Proper JSDoc types and validation
3. **Performance**: Meet all performance targets
4. **Integration**: Seamless integration with existing systems
5. **Testing**: >95% code coverage with comprehensive test cases

## Files Created

- `src/entities/multiTarget/targetManager.js`
- `src/entities/multiTarget/targetExtractionResult.js`
- `src/entities/multiTarget/multiTargetEventBuilder.js`
- `tests/unit/entities/multiTarget/targetManager.test.js`

## Files Modified

- None (new data structures)

## Validation Steps

1. Run all unit tests for data structures
2. Test serialization and deserialization
3. Validate performance with realistic data sets
4. Test integration with existing validation utilities
5. Verify type definitions work correctly in IDE

## Notes

- Data structures are designed for efficiency and type safety
- All classes include comprehensive validation and error handling
- JSON serialization enables persistence and debugging
- Builder pattern provides flexible event creation

## Risk Assessment

**Low Risk**: New data structures that don't modify existing functionality. Comprehensive testing ensures reliability and performance.

## Next Steps

After this ticket completion:
1. Complete Phase 1 with established data structures
2. Move to Phase 2: Command Processor Enhancement  
3. Use these data structures in command processor implementation