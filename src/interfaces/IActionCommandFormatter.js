// src/interfaces/IActionCommandFormatter.js

/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('./coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/formatters/formatActionTypedefs.js').FormatActionCommandResult} FormatActionCommandResult */

/**
 * @interface IActionCommandFormatter
 * @description Interface defining how action commands should be formatted.
 */
export class IActionCommandFormatter {
  /**
   * Formats an action command string given an action definition and target context.
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {ActionTargetContext} targetCtx - The target context describing the action target.
   * @param {EntityManager} entityManager - The entity manager for lookups.
   * @param {object} options - Formatting options (e.g., logger, debug flags).
   * @param {object} extra - Additional dependencies such as formatter map or display name helpers.
   * @returns {FormatActionCommandResult} Result object containing the formatted command or error info.
   * @throws {Error} If the method is not implemented.
   */
  format(actionDef, targetCtx, entityManager, options, extra) {
    throw new Error('IActionCommandFormatter.format method not implemented.');
  }
}
