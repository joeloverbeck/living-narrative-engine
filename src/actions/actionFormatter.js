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
import {
  safeDispatchError,
  dispatchValidationError,
} from '../utils/safeDispatchErrorUtils.js';
import { validateDependency } from '../utils/dependencyUtils.js';

import { targetFormatterMap } from './formatters/targetFormatters.js';

/**
 * @typedef {object} FormatActionOk
 * @property {true} ok - Indicates success.
 * @property {string} value - The formatted command string.
 */

/**
 * @typedef {object} FormatActionError
 * @property {false} ok - Indicates failure.
 * @property {string} error - The reason formatting failed.
 * @property {string} [details] - Additional error details.
 */

/**
 * @typedef {FormatActionOk | FormatActionError} FormatActionCommandResult
 */

/**
 * @typedef {Object.<string, (command: string, context: ActionTargetContext, deps: object) => FormatActionCommandResult>} TargetFormatterMap
 */

/**
 * @description Builds a standardized formatting error result.
 * @param {string} message - Human readable error message.
 * @param {object} [details] - Additional error details.
 * @returns {FormatActionError} Result object describing the error.
 */
function buildFormatError(message, details) {
  return { ok: false, error: message, ...(details && { details }) };
}

/**
 * @description Normalizes formatter results to a standard object shape.
 * @param {string | FormatActionCommandResult} result - Raw formatter result.
 * @returns {FormatActionCommandResult} Normalized result.
 */
function normalizeFormatResult(result) {
  return typeof result === 'string' ? { ok: true, value: result } : result;
}

/**
 * @description Checks required inputs for {@link formatActionCommand}.
 * @param {ActionDefinition} actionDefinition - Action definition to check.
 * @param {ActionTargetContext} targetContext - Target context for formatting.
 * @param {EntityManager} entityManager - Entity manager for lookups.
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} displayNameFn - Utility for entity names.
 * @param {ILogger} logger - Logger used for validation.
 * @returns {string | null} An error message string when invalid, otherwise `null`.
 */
function checkFormatInputs(
  actionDefinition,
  targetContext,
  entityManager,
  displayNameFn,
  logger
) {
  if (!actionDefinition || !actionDefinition.template) {
    return 'formatActionCommand: Invalid or missing actionDefinition or template.';
  }
  if (!targetContext) {
    return 'formatActionCommand: Invalid or missing targetContext.';
  }
  try {
    validateDependency(entityManager, 'entityManager', logger, {
      requiredMethods: ['getEntityInstance'],
    });
  } catch {
    return 'formatActionCommand: Invalid or missing entityManager.';
  }
  try {
    validateDependency(displayNameFn, 'displayNameFn', logger, {
      isFunction: true,
    });
  } catch {
    return 'formatActionCommand: getEntityDisplayName utility function is not available.';
  }

  return null;
}

/**
 * @description Applies the appropriate target formatter and handles errors.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} targetContext - Context describing the target.
 * @param {object} options - Bundled options.
 * @param {ActionDefinition} options.actionDefinition - The action definition.
 * @param {TargetFormatterMap} options.formatterMap - Map of available formatter functions.
 * @param {EntityManager} options.entityManager - Entity manager for lookups.
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} options.displayNameFn - Utility to resolve entity names.
 * @param {ILogger} options.logger - Logger for diagnostic output.
 * @param {boolean} options.debug - Debug flag.
 * @param {ISafeEventDispatcher} options.dispatcher - Dispatcher used for error events.
 * @returns {FormatActionCommandResult} The formatting result.
 */
function applyTargetFormatter(command, targetContext, options) {
  const {
    actionDefinition,
    formatterMap,
    entityManager,
    displayNameFn,
    logger,
    debug,
    dispatcher,
  } = options;

  const formatter = formatterMap[targetContext.type];
  if (!formatter) {
    logger.warn(
      `formatActionCommand: Unknown targetContext type: ${targetContext.type} for action ${actionDefinition.id}. Returning template unmodified.`
    );
    return { ok: true, value: command };
  }

  try {
    let newCommand = formatter(command, targetContext, {
      actionId: actionDefinition.id,
      entityManager,
      displayNameFn,
      logger,
      debug,
    });

    newCommand = normalizeFormatResult(newCommand);
    if (!newCommand.ok) {
      return newCommand;
    }

    return { ok: true, value: newCommand.value };
  } catch (error) {
    safeDispatchError(
      dispatcher,
      `formatActionCommand: Error during placeholder substitution for action ${actionDefinition.id}:`,
      { error: error.message, stack: error.stack }
    );
    return buildFormatError('placeholder substitution failed', error.message);
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
 * @description Normalizes dependency inputs and handles the deprecated
 * positional signature.
 * @param {*} deps - Provided dependency object or legacy displayNameFn.
 * @param {ILogger} [logger] - Logger used for deprecation warnings.
 * @returns {{displayNameFn: Function, formatterMap: TargetFormatterMap}}
 * Resolved dependencies object.
 */
function normalizeDeps(deps, logger) {
  const callerArgs = arguments[2] || [];
  const depObj = deps && typeof deps === 'object' ? deps : {};
  let displayNameFn =
    'displayNameFn' in depObj ? depObj.displayNameFn : getEntityDisplayName;
  let formatterMap =
    'formatterMap' in depObj ? depObj.formatterMap : targetFormatterMap;

  if (typeof deps === 'function' || callerArgs.length > 5) {
    logger.warn(
      'DEPRECATION: formatActionCommand now expects a single dependency object after options.'
    );
    displayNameFn = deps || getEntityDisplayName;
    formatterMap = callerArgs[5] || targetFormatterMap;
  }

  return { displayNameFn, formatterMap };
}

/**
 * Formats a validated action and target into a user-facing command string.
 *
 * @param {ActionDefinition} actionDefinition - The validated action's definition. Must not be null/undefined.
 * @param {ActionTargetContext} targetContext - The validated target context. Must not be null/undefined.
 * @param {EntityManager} entityManager - The entity manager for lookups. Must not be null/undefined.
 * @param {object} [options] - Optional parameters.
 * @param {boolean} [options.debug] - If true, logs additional debug information.
 * @param {ILogger} options.logger - Logger instance used for diagnostic output.
 * @param {ISafeEventDispatcher} options.safeEventDispatcher - Dispatcher used for error events.
 * @param {object} [deps] - Additional dependencies.
 * @param {(entity: Entity, fallback: string, logger?: ILogger) => string} [deps.displayNameFn] -
 * Function used to resolve entity display names.
 * @param {TargetFormatterMap} [deps.formatterMap] - Map of target types to formatter functions.
 * @returns {FormatActionCommandResult} Result object containing the formatted command or an error.
 */
export function formatActionCommand(
  actionDefinition,
  targetContext,
  entityManager,
  options = {},
  deps = {}
) {
  const { debug = false, logger, safeEventDispatcher } = options;
  if (!logger) {
    throw new Error('formatActionCommand: logger is required.');
  }

  const { displayNameFn, formatterMap } = normalizeDeps(
    deps,
    logger,
    arguments
  );

  // --- 1. Input Validation ---
  const validationMessage = checkFormatInputs(
    actionDefinition,
    targetContext,
    entityManager,
    displayNameFn,
    logger
  );

  validateDependency(safeEventDispatcher, 'safeEventDispatcher', logger, {
    requiredMethods: ['dispatch'],
  });
  const dispatcher = safeEventDispatcher;

  if (validationMessage) {
    return dispatchValidationError(
      dispatcher,
      validationMessage,
      undefined,
      logger
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
  const formatResult = applyTargetFormatter(command, targetContext, {
    actionDefinition,
    formatterMap,
    entityManager,
    displayNameFn,
    logger,
    debug,
    dispatcher,
  });
  if (!formatResult.ok) {
    return formatResult;
  }

  command = formatResult.value;

  // --- 3. Return Formatted String ---
  return finalizeCommand(command, logger, debug);
}
