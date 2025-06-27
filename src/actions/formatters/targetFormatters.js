// src/actions/formatters/targetFormatters.js

// --- Type Imports ---
/** @typedef {import('../../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('../../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

// --- Dependency Imports ---
import { TARGET_DOMAIN_NONE } from '../../constants/targetDomains.js';
import {
  ENTITY as TARGET_TYPE_ENTITY,
  NONE as TARGET_TYPE_NONE,
} from '../../constants/actionTargetTypes.js';

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
export function formatEntityTarget(
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
 * @description Handles templates without a target.
 * @param {string} command - The command template string.
 * @param {ActionTargetContext} _context - Context of type `none` (unused).
 * @param {{ actionId: string, logger: ILogger, debug: boolean }} deps - Logger and flags.
 * @returns {FormatActionCommandResult} The formatting result with the unchanged command.
 */
export function formatNoneTarget(
  command,
  _context,
  { actionId, logger, debug }
) {
  if (debug) {
    logger.debug(' -> No target type, using template as is.');
  }
  if (command.includes('{target}')) {
    logger.warn(
      `formatActionCommand: Action ${actionId} has target_domain '${TARGET_DOMAIN_NONE}' but template "${command}" contains placeholders.`
    );
  }
  return { ok: true, value: command };
}

/**
 * Default mapping of target types to formatter functions.
 *
 * Each formatter receives `(command, context, deps)` and should return a
 * {@link FormatActionCommandResult} object or a plain string. Keys normally
 * correspond to constants in {@link ../constants/actionTargetTypes.js}.
 *
 * Consumers may provide their own map as the final argument to
 * {@link formatActionCommand} to customize how placeholders are resolved.
 *
 * Example:
 * ```js
 * const customMap = {
 *   entity: myEntityFormatter,
 *   none: formatNoneTarget,
 * };
 * formatActionCommand(def, ctx, manager, { logger }, getEntityDisplayName, customMap);
 * ```
 *
 * @type {TargetFormatterMap}
 */
export const targetFormatterMap = {
  [TARGET_TYPE_ENTITY]: formatEntityTarget,
  [TARGET_TYPE_NONE]: formatNoneTarget,
};
