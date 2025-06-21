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
    if (action && typeof action === 'object') {
      if (typeof action.macro === 'string') {
        const macro = registry.get('macros', action.macro);
        if (!macro || !Array.isArray(macro.actions)) {
          logger?.warn?.(`expandMacros: macro '${action.macro}' not found.`);
          continue;
        }
        const expanded = expandActionArray(macro.actions, registry, logger);
        result.push(...expanded);
        continue;
      }

      const params = action.parameters;
      if (params && typeof params === 'object') {
        const newParams = { ...params };
        let changed = false;

        if (Array.isArray(params.then_actions)) {
          newParams.then_actions = expandActionArray(
            params.then_actions,
            registry,
            logger
          );
          changed = true;
        }
        if (Array.isArray(params.else_actions)) {
          newParams.else_actions = expandActionArray(
            params.else_actions,
            registry,
            logger
          );
          changed = true;
        }
        if (Array.isArray(params.actions)) {
          newParams.actions = expandActionArray(
            params.actions,
            registry,
            logger
          );
          changed = true;
        }

        if (changed) {
          result.push({ ...action, parameters: newParams });
          continue;
        }
      }
    }
    result.push(action);
  }
  return result;
}

/**
 * Recursively expands macro references in an array of action objects.
 *
 * @param {object[]} actions - Array of action or macro reference objects.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {object[]} A new array with all macros expanded.
 */
export function expandActionArray(actions, registry, logger) {
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
        logger?.warn?.(`expandMacros: macro '${action.macro}' not found.`);
        continue;
      }
      const expanded = expandActionArray(macro.actions, registry, logger);
      result.push(...expanded);
    } else if (action && typeof action === 'object') {
      const [expanded] = expandMacros([action], registry, logger);
      result.push(expanded);
    } else {
      result.push(action);
    }
  }

  return result;
}
