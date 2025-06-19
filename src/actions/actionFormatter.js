// src/actions/actionFormatter.js

// --- Type Imports ---
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/**
 * @typedef {import('../interfaces/IGameDataRepository.js').ActionDefinition} ActionDefinition
 */

// --- Dependency Imports ---
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { safeDispatchError } from '../utils/safeDispatchErrorUtils.js';
import { resolveSafeDispatcher } from '../utils/dispatcherUtils.js';

/**
 * Formats a validated action and target into a user-facing command string.
 *
 * @param {ActionDefinition} actionDefinition - The validated action's definition. Must not be null/undefined.
 * @param {ActionTargetContext} targetContext - The validated target context. Must not be null/undefined.
 * @param {EntityManager} entityManager - The entity manager for lookups. Must not be null/undefined.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.debug] - If true, logs additional debug information.
 * @param {ILogger} [options.logger] - Logger instance used for diagnostic output. Defaults to console.
 * @param {ISafeEventDispatcher} options.safeEventDispatcher - Dispatcher used for error events.
 * @returns {string | null} The formatted command string, or null if inputs are invalid.
 * @throws {Error} If critical dependencies (entityManager, getEntityDisplayName) are missing or invalid during processing.
 */
export function formatActionCommand(
  actionDefinition,
  targetContext,
  entityManager,
  options = {}
) {
  const { debug = false, logger = console, safeEventDispatcher } = options;
  const dispatcher = resolveSafeDispatcher(null, safeEventDispatcher, logger);
  if (!dispatcher) {
    logger.warn(
      'formatActionCommand: safeEventDispatcher resolution failed; error events may not be dispatched.'
    );
  }

  // --- 1. Input Validation ---
  if (!actionDefinition || !actionDefinition.template) {
    safeDispatchError(
      dispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      { actionDefinition }
    );
    return null;
  }
  if (!targetContext) {
    safeDispatchError(
      dispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      { targetContext }
    );
    return null;
  }
  if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
    safeDispatchError(
      dispatcher,
      'formatActionCommand: Invalid or missing entityManager.',
      { entityManager }
    );
    throw new Error(
      'formatActionCommand: entityManager parameter must be a valid EntityManager instance.'
    );
  }
  if (typeof getEntityDisplayName !== 'function') {
    safeDispatchError(
      dispatcher,
      'formatActionCommand: getEntityDisplayName utility function is not available.'
    );
    throw new Error(
      'formatActionCommand: getEntityDisplayName parameter must be a function.'
    );
  }

  let command = actionDefinition.template;
  const contextType = targetContext.type;

  if (debug) {
    logger.debug(
      `Formatting command for action: ${actionDefinition.id}, template: "${command}", targetType: ${contextType}`
    );
  }

  // --- 2. Placeholder Substitution based on Target Type ---
  try {
    switch (contextType) {
      case 'entity': {
        const targetId = targetContext.entityId;
        if (!targetId) {
          logger.warn(
            `formatActionCommand: Target context type is 'entity' but entityId is missing for action ${actionDefinition.id}. Template: "${command}"`
          );
          // Decide how to handle this - return template as-is, or indicate error?
          // Returning template as-is might be misleading if {target} exists.
          // Returning null or throwing might be safer. Let's return null for now.
          return null; // Indicate failure due to inconsistent context
        }

        let targetName = targetId; // Default fallback is the ID itself
        const targetEntity = entityManager.getEntityInstance(targetId);

        if (targetEntity) {
          // Use getEntityDisplayName utility with ID as fallback and pass logger
          targetName = getEntityDisplayName(targetEntity, targetId, logger);
          if (debug) {
            logger.debug(
              ` -> Found entity ${targetId}, display name: "${targetName}"`
            );
          }
        } else {
          // If entity instance lookup fails (shouldn't happen if context is truly validated, but good to check)
          logger.warn(
            `formatActionCommand: Could not find entity instance for ID ${targetId} (action: ${actionDefinition.id}). Using ID as fallback name.`
          );
          // targetName remains targetId (our fallback)
        }

        // Replace {target} placeholder
        command = command.replace('{target}', targetName);
        break;
      }

      case 'direction': {
        const direction = targetContext.direction;
        if (!direction) {
          logger.warn(
            `formatActionCommand: Target context type is 'direction' but direction string is missing for action ${actionDefinition.id}. Template: "${command}"`
          );
          return null; // Indicate failure
        }
        if (debug) {
          logger.debug(` -> Using direction: "${direction}"`);
        }
        // Replace {direction} placeholder
        command = command.replace('{direction}', direction);
        break;
      }

      case 'none':
        // No placeholders expected, use the template directly.
        if (debug) {
          logger.debug(' -> No target type, using template as is.');
        }
        // Optional check: Warn if template *unexpectedly* contains placeholders?
        if (command.includes('{target}') || command.includes('{direction}')) {
          logger.warn(
            `formatActionCommand: Action ${actionDefinition.id} has target_domain 'none' but template "${command}" contains placeholders.`
          );
        }
        break;

      default:
        logger.warn(
          `formatActionCommand: Unknown targetContext type: ${contextType} for action ${actionDefinition.id}. Returning template unmodified.`
        );
        // Return template as-is for unknown types? Or null? Returning unmodified seems safer.
        break;
    }
  } catch (error) {
    safeDispatchError(
      dispatcher,
      `formatActionCommand: Error during placeholder substitution for action ${actionDefinition.id}:`,
      { error: error.message, stack: error.stack }
    );
    return null; // Return null on processing error
  }

  // --- 3. Return Formatted String ---
  if (debug) {
    logger.debug(` <- Final formatted command: "${command}"`);
  }
  return command;
}
