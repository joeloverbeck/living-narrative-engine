import { resolveConditionRefs } from '../../utils/conditionRefResolver.js';

/** @typedef {import("../../interfaces/coreServices.js").ILogger} ILogger */
/** @typedef {import("../../data/gameDataRepository.js").GameDataRepository} GameDataRepository */
/**
 * @description Recursively resolves condition references inside a JSON Logic rule.
 * @param {object | any} logic - The logic tree or value to resolve.
 * @param {GameDataRepository} gameDataRepository - Repository providing condition definitions.
 * @param {ILogger} logger - Logger used for debug output. Only the `debug` method is utilized.
 * @param {Set<string>} [visited] - Set of visited condition IDs to detect cycles.
 * @returns {object | any} The resolved logic tree.
 * @throws {Error} If a referenced condition cannot be found or if a circular reference is detected.
 */
export function resolveReferences(
  logic,
  gameDataRepository,
  logger,
  visited = new Set()
) {
  return resolveConditionRefs(logic, gameDataRepository, logger, visited);
}
