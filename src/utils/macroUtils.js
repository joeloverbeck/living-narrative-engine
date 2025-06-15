/**
 * @module macroUtils
 * @description Utility helpers for expanding macro references in rule actions.
 */

/**
 * Recursively expands macro references in an array of action objects.
 *
 * A macro reference takes the form `{ "macro": "modId:macroId" }` and will be
 * replaced by the macro's actions. Macros may reference other macros.
 *
 * @param {object[]} actions - Array of action or macro reference objects.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {object[]} A new array with all macros expanded.
 */
export function expandMacros(actions, registry, logger) {
  if (!Array.isArray(actions)) return [];
  /** @type {object[]} */
  const result = [];
  for (const action of actions) {
    if (
      action &&
      typeof action === 'object' &&
      typeof action.macro === 'string'
    ) {
      const macro = registry.get('macros', action.macro);
      if (!macro || !Array.isArray(macro.actions)) {
        logger &&
          logger.warn &&
          logger.warn(`expandMacros: macro '${action.macro}' not found.`);
        continue;
      }
      const expanded = expandMacros(macro.actions, registry, logger);
      result.push(...expanded);
    } else {
      result.push(action);
    }
  }
  return result;
}
