/**
 * @file Unified routing policy service for perception events
 *
 * Provides canonical validation logic for recipient/exclusion list handling
 * across all perception-related operation handlers. Enforces mutual exclusivity
 * between recipientIds and excludedActorIds with consistent 'error' mode behavior.
 *
 * @see specs/perception_event_logging_refactor.md - R1: Unified Routing Policy Service
 * @see src/logic/operationHandlers/dispatchPerceptibleEventHandler.js
 * @see src/logic/operationHandlers/addPerceptionLogEntryHandler.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

/**
 * Result of routing validation.
 *
 * @typedef {object} RoutingValidationResult
 * @property {boolean} valid - Whether routing configuration is valid.
 * @property {string|null} error - Error message if invalid, null otherwise.
 */

/**
 * Centralized service for validating perception event routing configuration.
 * Ensures consistent behavior when recipientIds and excludedActorIds are both provided.
 *
 * Policy: recipientIds and excludedActorIds are mutually exclusive.
 * If both are provided, the operation is aborted with an error (canonical 'error' mode).
 */
class RecipientRoutingPolicyService {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /** @type {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} */
  #dispatcher;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger - Logger instance.
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.dispatcher - Safe event dispatcher.
   */
  constructor({ logger, dispatcher }) {
    this.#logger = ensureValidLogger(logger, 'RecipientRoutingPolicyService');

    validateDependency(dispatcher, 'ISafeEventDispatcher', this.#logger, {
      requiredMethods: ['dispatch'],
    });

    this.#dispatcher = dispatcher;

    this.#logger.debug('RecipientRoutingPolicyService initialized');
  }

  /**
   * Validates that recipientIds and excludedActorIds are mutually exclusive.
   *
   * @param {string[]} recipientIds - Explicit recipient IDs (may be empty).
   * @param {string[]} excludedActorIds - Excluded actor IDs (may be empty).
   * @param {string} operationName - Name of the calling operation for error messages.
   * @returns {RoutingValidationResult} Validation result with valid flag and optional error.
   */
  validateRouting(recipientIds, excludedActorIds, operationName) {
    const hasRecipients = Array.isArray(recipientIds) && recipientIds.length > 0;
    const hasExclusions = Array.isArray(excludedActorIds) && excludedActorIds.length > 0;

    if (hasRecipients && hasExclusions) {
      return {
        valid: false,
        error: `${operationName}: recipientIds and excludedActorIds are mutually exclusive`,
      };
    }

    return { valid: true, error: null };
  }

  /**
   * Handles a validation failure by dispatching an error event.
   * This is the canonical error behavior - abort the operation.
   *
   * @param {string} errorMessage - The error message to dispatch.
   * @param {object} details - Additional details for the error event.
   * @returns {boolean} Always returns false to signal operation should abort.
   */
  handleValidationFailure(errorMessage, details = {}) {
    this.#logger.error(errorMessage, details);
    safeDispatchError(this.#dispatcher, errorMessage, details, this.#logger);
    return false;
  }

  /**
   * Validates routing and handles failure if invalid.
   * Convenience method combining validateRouting and handleValidationFailure.
   *
   * @param {string[]} recipientIds - Explicit recipient IDs.
   * @param {string[]} excludedActorIds - Excluded actor IDs.
   * @param {string} operationName - Name of the calling operation.
   * @returns {boolean} True if valid, false if invalid (error dispatched).
   */
  validateAndHandle(recipientIds, excludedActorIds, operationName) {
    const result = this.validateRouting(recipientIds, excludedActorIds, operationName);

    if (!result.valid) {
      return this.handleValidationFailure(result.error, {
        recipientIds,
        excludedActorIds,
      });
    }

    return true;
  }
}

export default RecipientRoutingPolicyService;
