import {
  assertNonBlankString,
  validateDependency,
} from '../../../utils/dependencyUtils.js';

/**
 * Creates a helper that enforces consistent validator error logging.
 *
 * @param {object} params - Helper parameters.
 * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger instance.
 * @param {string} params.validatorName - Validator identifier (matches BaseValidator#name).
 * @returns {(error: Error) => void} Logger function bound to the validator.
 */
export function createValidatorLogger({ logger, validatorName }) {
  validateDependency(logger, 'ILogger', logger, {
    requiredMethods: ['error'],
  });
  assertNonBlankString(
    validatorName,
    'validatorName',
    'createValidatorLogger',
    logger
  );

  return (error) => {
    logger.error(`${validatorName} check failed`, error);
  };
}

export default createValidatorLogger;
