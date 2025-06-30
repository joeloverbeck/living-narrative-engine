/**
 * @module assemblerValidation
 * @description Utility for validating required parameters for prompt assemblers.
 */

import { ensureValidLogger } from '../../utils/loggerUtils.js';

/**
 * Validates required parameters for an assembler.
 *
 * @param {object} options - Validation options.
 * @param {*} options.elementConfig - Element configuration.
 * @param {*} options.promptData - Prompt data object.
 * @param {*} options.placeholderResolver - Placeholder resolver instance.
 * @param {*} [options.allPromptElementsMap] - Map of all prompt elements.
 * @param {import('../../interfaces/coreServices.js').ILogger} [options.logger] - Logger used for error reporting.
 * @param {string} [options.functionName] - Name used in the error message.
 * @param {boolean} [options.requireAllPromptElementsMap] - Whether allPromptElementsMap is mandatory.
 * @returns {{ valid: boolean, paramsProvided: object }} Result of validation.
 */
export function validateAssemblerParams({
  elementConfig,
  promptData,
  placeholderResolver,
  allPromptElementsMap,
  logger,
  functionName = 'Assembler',
  requireAllPromptElementsMap = false,
}) {
  const log = ensureValidLogger(logger, 'validateAssemblerParams');
  const paramsProvided = {
    elementConfigProvided: !!elementConfig,
    promptDataProvider: !!promptData,
    placeholderResolverProvided: !!placeholderResolver,
  };
  if (requireAllPromptElementsMap) {
    paramsProvided.allPromptElementsMapProvided = !!allPromptElementsMap;
  }

  const missing =
    !elementConfig ||
    !promptData ||
    !placeholderResolver ||
    (requireAllPromptElementsMap && !allPromptElementsMap);

  if (missing) {
    log.error(`${functionName}: Missing required parameters.`, paramsProvided);
    return { valid: false, paramsProvided };
  }
  return { valid: true, paramsProvided };
}

export default validateAssemblerParams;
