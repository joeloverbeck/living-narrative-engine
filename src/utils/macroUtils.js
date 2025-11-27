/**
 * @module macroUtils
 * @description Utility helpers for expanding macro references in rule actions.
 *
 * FAIL-FAST: This module throws MacroExpansionError when a macro is not found,
 * rather than silently skipping. This makes debugging macro-related issues
 * immediately visible instead of causing cryptic timeout errors.
 */

// -----------------------------------------------------------------------------
//  Error class
// -----------------------------------------------------------------------------

/**
 * Error thrown when macro expansion fails due to a missing macro.
 * Includes diagnostic details to help identify the root cause.
 *
 * FAIL-FAST: This error is thrown immediately when a macro is not found,
 * rather than silently skipping the macro action.
 */
export class MacroExpansionError extends Error {
  /**
   * @param {string} message - Error message
   * @param {object} details - Diagnostic details about the failure
   */
  constructor(message, details = {}) {
    super(message);
    this.name = 'MacroExpansionError';
    this.details = details;
  }
}

/**
 * Internal recursive helper used by {@link expandMacros} and
 * {@link expandActionArray}.
 *
 * @param {Array<Record<string, any>>} actions - Array of action or macro reference objects.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {object[]} A new array with all macros expanded.
 */
function _expandActions(actions, registry, logger) {
  if (!Array.isArray(actions)) return [];

  const result = [];
  for (const action of actions) {
    if (action && action.macro) {
      /** @type {any} */
      const macro = registry.get('macros', action.macro);
      if (macro && Array.isArray(macro.actions)) {
        result.push(..._expandActions(macro.actions, registry, logger));
      } else {
        // FAIL-FAST: Throw error instead of silently skipping the macro
        const error = new MacroExpansionError(
          `Macro expansion failed: macro '${action.macro}' not found in registry. ` +
            'This usually means the macro file does not exist or was not loaded.',
          {
            macroId: action.macro,
            macroFound: !!macro,
            macroHasActions: macro ? Array.isArray(macro.actions) : false,
          }
        );
        logger?.error?.(error.message, error.details);
        throw error;
      }
    } else if (action && action.parameters) {
      const newParams = { ...action.parameters };
      for (const key of ['then_actions', 'else_actions', 'actions']) {
        if (Array.isArray(newParams[key])) {
          newParams[key] = _expandActions(newParams[key], registry, logger);
        }
      }
      result.push({ ...action, parameters: newParams });
    } else {
      result.push(action);
    }
  }

  return result;
}

/**
 * Recursively expands macro references in an array of action objects.
 *
 * A macro reference takes the form `{ "macro": "modId:macroId" }` and will be
 * replaced by the macro's actions. Macros may reference other macros.
 *
 * @param {Array<Record<string, any>>} actions - Array of action or macro reference objects.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {object[]} A new array with all macros expanded.
 */
export function expandMacros(actions, registry, logger) {
  return _expandActions(actions, registry, logger);
}

/**
 * Finds any unexpanded macro references in an actions tree.
 * Useful for validation after macro expansion.
 *
 * @param {Array<Record<string, any>>} actions - Array of action objects to check.
 * @param {string} [path] - Current path in the actions tree for debugging.
 * @returns {Array<{path: string, macro: string, action: object}>} Array of found macro references.
 */
export function findUnexpandedMacros(actions, path = 'actions') {
  if (!Array.isArray(actions)) return [];

  /** @type {Array<{path: string, macro: string, action: object}>} */
  let found = [];
  actions.forEach((action, idx) => {
    if (action && action.macro) {
      found.push({ path: `${path}[${idx}]`, macro: action.macro, action });
    }
    if (action && action.parameters) {
      for (const key of Object.keys(action.parameters)) {
        if (Array.isArray(action.parameters[key])) {
          found = found.concat(
            findUnexpandedMacros(
              action.parameters[key],
              `${path}[${idx}].parameters.${key}`
            )
          );
        }
      }
    }
  });
  return found;
}

/**
 * Validates that all macros have been properly expanded.
 * Logs warnings for any unexpanded macros found.
 *
 * @param {object[]} actions - Array of action objects to validate.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {boolean} True if no unexpanded macros found, false otherwise.
 */
export function validateMacroExpansion(actions, registry, logger) {
  const unexpanded = findUnexpandedMacros(actions);
  if (unexpanded.length > 0) {
    logger?.warn?.(
      `Found ${unexpanded.length} unexpanded macro references:`,
      unexpanded
    );
    return false;
  }
  return true;
}

/**
 * Recursively expands macro references in an array of action objects.
 * This is a legacy function maintained for backward compatibility.
 *
 * @deprecated Use expandMacros instead.
 * @param {object[]} actions - Array of action or macro reference objects.
 * @param {import('../interfaces/coreServices.js').IDataRegistry} registry - Data registry used to resolve macros.
 * @param {import('../interfaces/coreServices.js').ILogger} [logger] - Optional logger for warnings.
 * @returns {object[]} A new array with all macros expanded.
 */
export const expandActionArray = expandMacros;
