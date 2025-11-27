// src/interfaces/IActionCommandFormatter.js

/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */
/** @typedef {import('./coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../actions/formatters/formatActionTypedefs.js').FormatActionCommandResult} FormatActionCommandResult */

/**
 * @typedef {object} MultiTargetContext
 * @property {string} entityId - Target entity ID
 * @property {string} displayName - Display name for target
 * @property {string} [placeholder] - Template placeholder name
 */

/**
 * @typedef {object} ResolvedTarget
 * @property {string} id - Entity ID
 * @property {string} displayName - Display name for formatting
 * @property {object} entity - Full entity object
 */

/**
 * @typedef {object} FormattingOptions
 * @property {Function} [displayNameFn] - Custom display name resolver
 * @property {boolean} [debug] - Enable debug logging
 * @property {object} [logger] - Logger instance
 * @property {object} [safeEventDispatcher] - Event dispatcher
 * @property {object} [chanceCalculationService] - Service for calculating action success chances (for chance-based actions)
 * @property {string} [actorId] - Actor ID for chance calculations
 */

/**
 * @interface IActionCommandFormatter
 * @description Enhanced interface defining how action commands should be formatted, supporting both legacy single-target and multi-target actions.
 */
export class IActionCommandFormatter {
  /**
   * Formats an action command string given an action definition and target context (legacy compatibility).
   *
   * @param {ActionDefinition} actionDef - The action definition.
   * @param {ActionTargetContext} targetContext - The target context describing the action target.
   * @param {EntityManager} entityManager - The entity manager for lookups.
   * @param {object} options - Formatting options (e.g., logger, debug flags).
   * @param {object} extra - Additional dependencies such as formatter map or display name helpers.
   * @returns {FormatActionCommandResult} Result object containing the formatted command or error info.
   * @throws {Error} If the method is not implemented.
   */
  format(actionDef, targetContext, entityManager, options, extra) {
    throw new Error('IActionCommandFormatter.format method not implemented.');
  }

  /**
   * Formats an action command with multiple targets and placeholders.
   *
   * @param {ActionDefinition} actionDef - The action definition with multi-target template.
   * @param {Object<string, ResolvedTarget[]>} resolvedTargets - Targets organized by definition name.
   * @param {EntityManager} entityManager - The entity manager for lookups.
   * @param {FormattingOptions} options - Formatting options.
   * @param {object} [deps] - Additional dependencies including targetDefinitions.
   * @returns {FormatActionCommandResult} Result object containing the formatted command(s) or error info.
   * @throws {Error} If the method is not implemented.
   */
  formatMultiTarget(actionDef, resolvedTargets, entityManager, options, deps) {
    throw new Error(
      'IActionCommandFormatter.formatMultiTarget method not implemented.'
    );
  }
}
