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
import {
  ENTITY as TARGET_TYPE_ENTITY,
  DIRECTION as TARGET_TYPE_DIRECTION,
  NONE as TARGET_TYPE_NONE,
} from '../constants/actionTargetTypes.js';

/**
 * @typedef {object} FormatActionOk
 * @property {true} ok - Indicates success.
 * @property {string} value - The formatted command string.
 */

/**
 * @typedef {object} FormatActionError
 * @property {false} ok - Indicates failure.
 * @property {string} error - The reason formatting failed.
 */

/**
 * @typedef {FormatActionOk | FormatActionError} FormatActionCommandResult
 */

/**
 * @description Helper for reporting argument validation errors.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher for error events.
 * @param {string} message - Error message to send.
 * @param {object} [detail] - Optional error detail payload.
 * @returns {FormatActionError} Result object representing the failure.
 */
function reportValidationError(dispatcher, message, detail) {
  safeDispatchError(dispatcher, message, detail);
  return { ok: false, error: message };
}

/**
 * @typedef {Object.<string, (command: string, context: ActionTargetContext, deps: object) => FormatActionCommandResult>} TargetFormatterMap
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
 * @returns {FormatActionCommandResult} The result of formatting.
 */
function formatEntityTarget(
  command,
  context,
  { actionId, entityManager, displayNameFn, logger, debug }
) {
  const targetId = context.entityId;
  if (!targetId) {
    const message = `formatActionCommand: Target context type is '${TARGET_TYPE_ENTITY}' but entityId is missing for action ${actionId}. Template: "${command}"`;
    logger.warn(message);
    return { ok: false, error: message };
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

  return { ok: true, value: command.replace('{target}', targetName) };
}

/**
 * @description Replaces the `{direction}` placeholder.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} context - Target context with `direction`.
 * @param {{ actionId: string, logger: ILogger, debug: boolean }} deps - Logger and flags.
 * @returns {FormatActionCommandResult} The formatting result.
 */
function formatDirectionTarget(command, context, { actionId, logger, debug }) {
  const direction = context.direction;
  if (!direction) {
    const message = `formatActionCommand: Target context type is '${TARGET_TYPE_DIRECTION}' but direction string is missing for action ${actionId}. Template: "${command}"`;
    logger.warn(message);
    return { ok: false, error: message };
  }
  if (debug) {
    logger.debug(` -> Using direction: "${direction}"`);
  }
  return { ok: true, value: command.replace('{direction}', direction) };
}

/**
 * @description Handles templates without a target.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} _context - Context of type `none` (unused).
 * @param {{ actionId: string, logger: ILogger, debug: boolean }} deps - Logger and flags.
 * @returns {FormatActionCommandResult} The formatting result with the unchanged command.
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
  return { ok: true, value: command };
}

/**
 * @description Default mapping of target types to formatter functions.
 * @type {TargetFormatterMap}
 */
export const targetFormatterMap = {
  [TARGET_TYPE_ENTITY]: formatEntityTarget,
  [TARGET_TYPE_DIRECTION]: formatDirectionTarget,
  [TARGET_TYPE_NONE]: formatNoneTarget,
};

/**
 * @description Validates inputs for {@link formatActionCommand}.
 * @param {ActionDefinition} actionDefinition - Validated action definition.
 * @param {ActionTargetContext} targetContext - Validated target context.
 * @param {EntityManager} entityManager - Entity manager for lookups.
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} displayNameFn - Utility to resolve entity names.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used for error events.
 * @returns {FormatActionError | null} An error result if validation fails, otherwise `null`.
 * @throws {Error} If `entityManager` or `displayNameFn` are invalid.
 */
function validateFormatInputs(
  actionDefinition,
  targetContext,
  entityManager,
  displayNameFn,
  dispatcher
) {
  if (!actionDefinition || !actionDefinition.template) {
    return reportValidationError(
      dispatcher,
      'formatActionCommand: Invalid or missing actionDefinition or template.',
      { actionDefinition }
    );
  }
  if (!targetContext) {
    return reportValidationError(
      dispatcher,
      'formatActionCommand: Invalid or missing targetContext.',
      { targetContext }
    );
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

  return null;
}

/**
 * @description Applies the appropriate target formatter and handles errors.
 * @param {string} command - The command template string.
 * @param {ActionDefinition} actionDefinition - The action definition.
 * @param {ActionTargetContext} targetContext - Context describing the target.
 * @param {TargetFormatterMap} formatterMap - Map of available formatter functions.
 * @param {EntityManager} entityManager - Entity manager for lookups.
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} displayNameFn - Utility to resolve entity names.
 * @param {ILogger} logger - Logger for diagnostic output.
 * @param {boolean} debug - Debug flag.
 * @param {ISafeEventDispatcher} dispatcher - Dispatcher used for error events.
 * @returns {FormatActionCommandResult} The formatting result.
 */
function applyTargetFormatter(
  command,
  actionDefinition,
  targetContext,
  formatterMap,
  entityManager,
  displayNameFn,
  logger,
  debug,
  dispatcher
) {
  try {
    const formatter = formatterMap[targetContext.type];
    if (formatter) {
      let newCommand = formatter(command, targetContext, {
        actionId: actionDefinition.id,
        entityManager,
        displayNameFn,
        logger,
        debug,
      });
      if (typeof newCommand === 'string') {
        newCommand = { ok: true, value: newCommand };
      }
      if (!newCommand.ok) {
        return newCommand;
      }

      return { ok: true, value: newCommand.value };
    }

    logger.warn(
      `formatActionCommand: Unknown targetContext type: ${targetContext.type} for action ${actionDefinition.id}. Returning template unmodified.`
    );
    return { ok: true, value: command };
  } catch (error) {
    safeDispatchError(
      dispatcher,
      `formatActionCommand: Error during placeholder substitution for action ${actionDefinition.id}:`,
      { error: error.message, stack: error.stack }
    );
    return {
      ok: false,
      error: 'formatActionCommand: Error during placeholder substitution.',
    };
  }
}

/**
 * @description Finalizes a formatted command result.
 * @param {string} command - Command string to return.
 * @param {ILogger} logger - Logger for debug output.
 * @param {boolean} debug - If true, debug logging is enabled.
 * @returns {FormatActionOk} Result with the formatted command.
 */
function finalizeCommand(command, logger, debug) {
  if (debug) {
    logger.debug(` <- Final formatted command: "${command}"`);
  }
  return { ok: true, value: command };
}

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
 * @returns {FormatActionCommandResult} Result object containing the formatted command or an error.
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
  const validationError = validateFormatInputs(
    actionDefinition,
    targetContext,
    entityManager,
    displayNameFn,
    dispatcher
  );
  if (validationError) {
    return validationError;
  }

  let command = actionDefinition.template;
  const contextType = targetContext.type;

  if (debug) {
    logger.debug(
      `Formatting command for action: ${actionDefinition.id}, template: "${command}", targetType: ${contextType}`
    );
  }

  // --- 2. Placeholder Substitution based on Target Type ---
  const formatResult = applyTargetFormatter(
    command,
    actionDefinition,
    targetContext,
    formatterMap,
    entityManager,
    displayNameFn,
    logger,
    debug,
    dispatcher
  );
  if (!formatResult.ok) {
    return formatResult;
  }

  command = formatResult.value;

  // --- 3. Return Formatted String ---
  return finalizeCommand(command, logger, debug);
}
