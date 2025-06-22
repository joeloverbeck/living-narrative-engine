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
import { TARGET_DOMAIN_NONE } from '../constants/targetDomains.js';

/**
 * @typedef {Object.<string, (command: string, context: ActionTargetContext, deps: object) => (string|null)>} TargetFormatterMap
 */

/**
 * @description Replaces the `{target}` placeholder using entity information.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} context - Target context with `entityId`.
 * @param {{
 *   actionId: string,
 *   entityManager: EntityManager,
 *   displayNameFn: (entity: Entity, fallback: string, logger?: ILogger) => string,
 *   logger: ILogger,
 *   debug: boolean
 * }} deps - Supporting services and flags.
 * @returns {string | null} The formatted command or null on failure.
 */
function formatEntityTarget(
  command,
  context,
  { actionId, entityManager, displayNameFn, logger, debug }
) {
  const targetId = context.entityId;
  if (!targetId) {
    logger.warn(
      `formatActionCommand: Target context type is 'entity' but entityId is missing for action ${actionId}. Template: "${command}"`
    );
    return null;
  }

  let targetName = targetId;
  const targetEntity = entityManager.getEntityInstance(targetId);
  if (targetEntity) {
    targetName = displayNameFn(targetEntity, targetId, logger);
    if (debug) {
      logger.debug(
        ` -> Found entity ${targetId}, display name: "${targetName}"`
      );
    }
  } else {
    logger.warn(
      `formatActionCommand: Could not find entity instance for ID ${targetId} (action: ${actionId}). Using ID as fallback name.`
    );
  }

  return command.replace('{target}', targetName);
}

/**
 * @description Replaces the `{direction}` placeholder.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} context - Target context with `direction`.
 * @param {{ actionId: string, logger: ILogger, debug: boolean }} deps - Logger and flags.
 * @returns {string | null} The formatted command or null when direction is missing.
 */
function formatDirectionTarget(command, context, { actionId, logger, debug }) {
  const direction = context.direction;
  if (!direction) {
    logger.warn(
      `formatActionCommand: Target context type is 'direction' but direction string is missing for action ${actionId}. Template: "${command}"`
    );
    return null;
  }
  if (debug) {
    logger.debug(` -> Using direction: "${direction}"`);
  }
  return command.replace('{direction}', direction);
}

/**
 * @description Handles templates without a target.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} _context - Context of type `none` (unused).
 * @param {{ actionId: string, logger: ILogger, debug: boolean }} deps - Logger and flags.
 * @returns {string} The unmodified command string.
 */
function formatNoneTarget(command, _context, { actionId, logger, debug }) {
  if (debug) {
    logger.debug(' -> No target type, using template as is.');
  }
  if (command.includes('{target}') || command.includes('{direction}')) {
    logger.warn(
      `formatActionCommand: Action ${actionId} has target_domain '${TARGET_DOMAIN_NONE}' but template "${command}" contains placeholders.`
    );
  }
  return command;
}

/**
 * @description Default mapping of target types to formatter functions.
 * @type {TargetFormatterMap}
 */
export const targetFormatterMap = {
  entity: formatEntityTarget,
  direction: formatDirectionTarget,
  none: formatNoneTarget,
};

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
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} [displayNameFn] -
 *  Function used to resolve entity display names.
 * @param {TargetFormatterMap} [formatterMap] - Map of target types to formatter functions.
 * @returns {string | null} The formatted command string, or null if inputs are invalid.
 * @throws {Error} If critical dependencies (entityManager, displayNameFn) are missing or invalid during processing.
 */
export function formatActionCommand(
  actionDefinition,
  targetContext,
  entityManager,
  options = {},
  displayNameFn = getEntityDisplayName,
  formatterMap = targetFormatterMap
) {
  const { debug = false, logger = console, safeEventDispatcher } = options;
  const dispatcher = safeEventDispatcher || resolveSafeDispatcher(null, logger);
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
  if (typeof displayNameFn !== 'function') {
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
    const formatter = formatterMap[contextType];
    if (formatter) {
      const newCommand = formatter(command, targetContext, {
        actionId: actionDefinition.id,
        entityManager,
        displayNameFn,
        logger,
        debug,
      });

      if (newCommand === null) {
        return null;
      }

      command = newCommand;
    } else {
      logger.warn(
        `formatActionCommand: Unknown targetContext type: ${contextType} for action ${actionDefinition.id}. Returning template unmodified.`
      );
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
