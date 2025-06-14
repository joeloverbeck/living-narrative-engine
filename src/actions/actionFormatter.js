// src/actions/actionFormatter.js

// --- Type Imports ---
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */

// --- Dependency Imports ---
import { getEntityDisplayName } from '../utils/entityUtils.js';
import { DISPLAY_ERROR_ID } from '../constants/eventIds.js';

/**
 * Formats a validated action and target into a user-facing command string.
 *
 * @param {ActionDefinition} actionDefinition - The validated action's definition. Must not be null/undefined.
 * @param {ActionTargetContext} validatedTargetContext - The validated target context. Must not be null/undefined.
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
  validatedTargetContext,
  entityManager,
  options = {}
) {
  const { debug = false, logger = console, safeEventDispatcher } = options;

  if (
    !safeEventDispatcher ||
    typeof safeEventDispatcher.dispatch !== 'function'
  ) {
    throw new Error('formatActionCommand requires ISafeEventDispatcher');
  }

  // --- 1. Input Validation ---
  if (!actionDefinition || !actionDefinition.template) {
    safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
      message:
        'formatActionCommand: Invalid or missing actionDefinition or template.',
      details: { actionDefinition },
    });
    return null;
  }
  if (!validatedTargetContext) {
    safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
      message:
        'formatActionCommand: Invalid or missing validatedTargetContext.',
      details: { validatedTargetContext },
    });
    return null;
  }
  if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
    safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
      message: 'formatActionCommand: Invalid or missing entityManager.',
      details: { entityManager },
    });
    throw new Error(
      'formatActionCommand requires a valid EntityManager instance.'
    );
  }
  if (typeof getEntityDisplayName !== 'function') {
    safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
      message:
        'formatActionCommand: getEntityDisplayName utility function is not available.',
    });
    throw new Error(
      'formatActionCommand requires the getEntityDisplayName utility function.'
    );
  }

  let command = actionDefinition.template;
  const contextType = validatedTargetContext.type;

  if (debug) {
    logger.debug(
      `Formatting command for action: ${actionDefinition.id}, template: "${command}", targetType: ${contextType}`
    );
  }

  // --- 2. Placeholder Substitution based on Target Type ---
  try {
    switch (contextType) {
      case 'entity': {
        const targetId = validatedTargetContext.entityId;
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
        const direction = validatedTargetContext.direction;
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
          `formatActionCommand: Unknown validatedTargetContext type: ${contextType} for action ${actionDefinition.id}. Returning template unmodified.`
        );
        // Return template as-is for unknown types? Or null? Returning unmodified seems safer.
        break;
    }
  } catch (error) {
    safeEventDispatcher.dispatch(DISPLAY_ERROR_ID, {
      message: `formatActionCommand: Error during placeholder substitution for action ${actionDefinition.id}:`,
      details: { error: error.message, stack: error.stack },
    });
    return null; // Return null on processing error
  }

  // --- 3. Return Formatted String ---
  if (debug) {
    logger.debug(` <- Final formatted command: "${command}"`);
  }
  return command;
}
