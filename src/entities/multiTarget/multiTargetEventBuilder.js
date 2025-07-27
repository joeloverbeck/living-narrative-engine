/**
 * @file Builder for creating multi-target event payloads
 */

import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';
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
   *
   * @param {object} options - Configuration options
   * @param {object} options.logger - Logger instance
   */
  constructor({ logger }) {
    this.#logger = ensureValidLogger(logger);
    this.reset();
  }

  /**
   * Resets the builder to initial state
   *
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  reset() {
    this.#eventData = {
      eventName: 'core:attempt_action',
      timestamp: Date.now(),
    };
    return this;
  }

  /**
   * Sets the actor ID
   *
   * @param {EntityId} actorId - Actor entity ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setActor(actorId) {
    assertNonBlankString(
      actorId,
      'actorId',
      'MultiTargetEventBuilder.setActor',
      this.#logger
    );
    this.#eventData.actorId = actorId;
    return this;
  }

  /**
   * Sets the action ID
   *
   * @param {NamespacedId} actionId - Action definition ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setAction(actionId) {
    assertNonBlankString(
      actionId,
      'actionId',
      'MultiTargetEventBuilder.setAction',
      this.#logger
    );
    this.#eventData.actionId = actionId;
    return this;
  }

  /**
   * Sets the original input command
   *
   * @param {string} originalInput - Original command string
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setOriginalInput(originalInput) {
    assertNonBlankString(
      originalInput,
      'originalInput',
      'MultiTargetEventBuilder.setOriginalInput',
      this.#logger
    );
    this.#eventData.originalInput = originalInput;
    return this;
  }

  /**
   * Sets targets from a TargetExtractionResult
   *
   * @param {TargetExtractionResult} extractionResult - Target extraction result
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setTargetsFromExtraction(extractionResult) {
    assertPresent(
      extractionResult,
      'Target extraction result is required',
      Error,
      this.#logger
    );

    if (!(extractionResult instanceof TargetExtractionResult)) {
      throw new Error(
        'extractionResult must be a TargetExtractionResult instance'
      );
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
      primaryTarget,
    });

    return this;
  }

  /**
   * Sets targets manually
   *
   * @param {object} targets - Targets object
   * @param {EntityId} [primaryTarget] - Primary target override
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setTargets(targets, primaryTarget) {
    assertPresent(targets, 'Targets object is required', Error, this.#logger);

    if (typeof targets !== 'object' || Array.isArray(targets)) {
      throw new Error('Targets must be an object');
    }

    const targetKeys = Object.keys(targets);

    // Set targets object if multiple targets exist
    if (targetKeys.length > 1) {
      this.#eventData.targets = { ...targets };
    }

    // Determine primary target
    const primary =
      primaryTarget ||
      targets.primary ||
      targets.target ||
      Object.values(targets)[0];

    this.#eventData.targetId = primary;

    this.#logger.debug('Targets set manually', {
      targetCount: targetKeys.length,
      hasMultipleTargets: targetKeys.length > 1,
      primaryTarget: primary,
    });

    return this;
  }

  /**
   * Sets a legacy single target
   *
   * @param {EntityId|null} targetId - Target entity ID
   * @returns {MultiTargetEventBuilder} This builder for chaining
   */
  setLegacyTarget(targetId) {
    if (targetId !== null) {
      assertNonBlankString(
        targetId,
        'targetId',
        'MultiTargetEventBuilder.setLegacyTarget',
        this.#logger
      );
    }

    this.#eventData.targetId = targetId;

    // Remove targets object for pure legacy format
    delete this.#eventData.targets;

    this.#logger.debug('Legacy target set', { targetId });
    return this;
  }

  /**
   * Sets the event timestamp
   *
   * @param {number} [timestamp] - Event timestamp
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
   *
   * @returns {object} Built and validated event payload
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
        payload,
      });
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (validationResult.warnings.length > 0) {
      this.#logger.warn('Event payload has warnings', {
        warnings: validationResult.warnings,
        payload,
      });
    }

    this.#logger.debug('Event payload built successfully', {
      hasMultipleTargets: validationResult.details.hasMultipleTargets,
      targetCount: validationResult.details.targetCount,
      primaryTarget: validationResult.details.primaryTarget,
    });

    return payload;
  }

  /**
   * Builds the payload without strict validation (for testing)
   *
   * @returns {object} Built event payload
   */
  buildUnsafe() {
    return { ...this.#eventData };
  }

  /**
   * Validates required fields
   *
   * @throws {Error} If required fields are missing
   */
  #validateRequiredFields() {
    const requiredFields = ['actorId', 'actionId', 'originalInput'];
    const missingFields = requiredFields.filter(
      (field) => !this.#eventData[field]
    );

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Must have either targets or targetId
    if (!this.#eventData.targets && this.#eventData.targetId === undefined) {
      throw new Error(
        'Event must have either targets object or targetId field'
      );
    }
  }

  /**
   * Gets the current state of the builder (for debugging)
   *
   * @returns {object} Current builder state
   */
  getState() {
    return {
      eventData: { ...this.#eventData },
      hasRequiredFields: this.#hasRequiredFields(),
      hasTargets: this.#hasTargets(),
    };
  }

  /**
   * Checks if required fields are present
   *
   * @returns {boolean} True if all required fields are present
   */
  #hasRequiredFields() {
    const requiredFields = ['actorId', 'actionId', 'originalInput'];
    return requiredFields.every((field) => this.#eventData[field]);
  }

  /**
   * Checks if targets are present
   *
   * @returns {boolean} True if targets are present
   */
  #hasTargets() {
    return this.#eventData.targets || this.#eventData.targetId !== undefined;
  }

  /**
   * Creates a builder from an existing payload (for modification)
   *
   * @param {AttemptActionPayload} payload - Existing payload
   * @param {object} logger - Logger instance
   * @returns {MultiTargetEventBuilder} New builder instance
   */
  static fromPayload(payload, logger) {
    assertPresent(payload, 'Payload is required', Error, logger);

    const builder = new MultiTargetEventBuilder({ logger });

    // Copy all fields from payload
    builder.#eventData = { ...payload };

    return builder;
  }

  /**
   * Creates a builder from turn action data
   *
   * @param {object} actor - Actor entity
   * @param {object} turnAction - Turn action data
   * @param {TargetExtractionResult} extractionResult - Target extraction result
   * @param {object} logger - Logger instance
   * @returns {MultiTargetEventBuilder} New builder instance
   */
  static fromTurnAction(actor, turnAction, extractionResult, logger) {
    assertPresent(actor, 'Actor is required', Error, logger);
    assertPresent(turnAction, 'Turn action is required', Error, logger);
    assertPresent(
      extractionResult,
      'Extraction result is required',
      Error,
      logger
    );

    const builder = new MultiTargetEventBuilder({ logger });

    return builder
      .setActor(actor.id)
      .setAction(turnAction.actionDefinitionId)
      .setOriginalInput(
        turnAction.commandString || turnAction.actionDefinitionId
      )
      .setTargetsFromExtraction(extractionResult);
  }
}

export default MultiTargetEventBuilder;
